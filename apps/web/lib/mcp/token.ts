// Per-household MCP tokens — mint, verify, revoke.
//
// A token is high-entropy random data, not a human password, so it's hashed
// with a fast keyed HMAC (not bcrypt/scrypt) and looked up by exact match on
// an indexed column — the same pattern GitHub/Stripe-style API keys use.
// The plaintext is returned to the caller exactly once, at mint time, and
// never stored or retrievable again; only the hash lives in the database.

import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { householdTokens, type HouseholdToken } from "@/db/schema";
import { roleInFamily } from "../permissions";
import { logAudit } from "../audit";
import type { McpIdentity } from "./context";

const TOKEN_PREFIX = "hos_";

// Lazy, not module-top-level: Next.js's build step imports every route
// module to statically analyze it (with NODE_ENV=production, even locally),
// so throwing here unconditionally would break `next build` itself. Checking
// on first real use means the throw only fires when a live request actually
// tries to mint/verify a token without the secret set.
function getKey(): string {
  const secret = process.env.MCP_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    // Hard-fail, unlike the SESSION_SECRET dev-fallback pattern elsewhere: a
    // shared, public fallback key here means anyone who can insert a row into
    // household_tokens (e.g. via a DB compromise) can compute a working token
    // hash themselves. A forged session cookie still needs a device to
    // receive it; a bearer token doesn't.
    throw new Error("[mcp-token] MCP_TOKEN_SECRET must be set in production — refusing to mint or verify tokens with a public fallback key.");
  }
  return "dev-only-insecure-mcp-secret";
}

function hash(token: string): string {
  return crypto.createHmac("sha256", getKey()).update(token).digest("hex");
}

export async function mintToken(args: {
  familyId: string;
  mintedByUserId: string;
  label: string;
}): Promise<{ token: string; record: HouseholdToken }> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${raw}`;
  const [record] = await db
    .insert(householdTokens)
    .values({ familyId: args.familyId, mintedByUserId: args.mintedByUserId, label: args.label, tokenHash: hash(token) })
    .returning();
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.mintedByUserId,
    actor: "user",
    action: "mcp_token.minted",
    subjectType: "household_token",
    subjectId: record.id,
    channel: "web",
    detail: { label: args.label },
  });
  return { token, record };
}

export async function listTokens(familyId: string): Promise<HouseholdToken[]> {
  return db.query.householdTokens.findMany({
    where: eq(householdTokens.familyId, familyId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}

export async function revokeToken(args: { familyId: string; tokenId: string; revokedByUserId: string }): Promise<boolean> {
  const [row] = await db
    .update(householdTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(householdTokens.id, args.tokenId), eq(householdTokens.familyId, args.familyId), isNull(householdTokens.revokedAt)))
    .returning();
  if (!row) return false;
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.revokedByUserId,
    actor: "user",
    action: "mcp_token.revoked",
    subjectType: "household_token",
    subjectId: args.tokenId,
    channel: "web",
  });
  return true;
}

// Verifies a bearer token and resolves the identity an MCP call should act
// as. Constant-time only matters for the DB lookup key derivation, not the
// lookup itself — this is an indexed exact-match query, not a loop compare.
export async function verifyToken(bearer: string): Promise<McpIdentity | null> {
  if (!bearer.startsWith(TOKEN_PREFIX)) return null;
  const tokenHash = hash(bearer);
  const record = await db.query.householdTokens.findFirst({
    where: and(eq(householdTokens.tokenHash, tokenHash), isNull(householdTokens.revokedAt)),
  });
  if (!record) return null;

  const role = await roleInFamily(record.mintedByUserId, record.familyId);
  if (!role) return null; // minting user left the household since — token is dead

  // Best-effort, non-blocking — a failed timestamp update should never break
  // an otherwise-valid call.
  db.update(householdTokens)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(householdTokens.id, record.id), isNull(householdTokens.revokedAt)))
    .catch(() => {});

  return { userId: record.mintedByUserId, familyId: record.familyId, role };
}
