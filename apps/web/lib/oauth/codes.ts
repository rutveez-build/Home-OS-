// One-time-use authorization codes with mandatory PKCE (S256 only — no
// "plain" method, per OAuth 2.1 guidance for public clients). The code
// carries the household/user the consent screen resolved; the token
// exchange never re-derives them from anything the client supplies.

import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAuthCodes } from "@/db/schema";

const CODE_TTL_MS = 60_000;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export async function issueCode(args: {
  clientId: string;
  familyId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<string> {
  const code = base64url(crypto.randomBytes(32));
  await db.insert(oauthAuthCodes).values({
    code,
    clientId: args.clientId,
    familyId: args.familyId,
    userId: args.userId,
    redirectUri: args.redirectUri,
    codeChallenge: args.codeChallenge,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

export type ConsumedCode = { clientId: string; familyId: string; userId: string };

// Returns null for ANY failure (expired, already used, wrong client/redirect,
// bad PKCE verifier) — deliberately no distinguishing signal back to the
// caller beyond "invalid_grant", so a bad guess can't be used as an oracle.
//
// Validate-then-claim, in that order: an attacker who has a code but not the
// right verifier (or client_id, or redirect_uri) must not be able to burn it
// for the legitimate holder just by trying and failing once. Only a fully
// valid exchange performs the atomic claim — which still exists, to stop two
// concurrent *valid* exchanges of the same code both succeeding.
export async function consumeCode(args: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ConsumedCode | null> {
  const row = await db.query.oauthAuthCodes.findFirst({ where: eq(oauthAuthCodes.code, args.code) });
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.clientId !== args.clientId) return null;
  if (row.redirectUri !== args.redirectUri) return null;

  const expectedChallenge = base64url(crypto.createHash("sha256").update(args.codeVerifier).digest());
  const a = Buffer.from(expectedChallenge);
  const b = Buffer.from(row.codeChallenge);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const [claimed] = await db
    .update(oauthAuthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthAuthCodes.code, args.code), isNull(oauthAuthCodes.usedAt)))
    .returning();
  if (!claimed) return null; // lost a race to a concurrent valid exchange

  return { clientId: claimed.clientId, familyId: claimed.familyId, userId: claimed.userId };
}
