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
export async function consumeCode(args: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ConsumedCode | null> {
  // Atomic claim: the UPDATE only matches an unused row, so two concurrent
  // exchanges of the same code can't both succeed.
  const [row] = await db
    .update(oauthAuthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthAuthCodes.code, args.code), isNull(oauthAuthCodes.usedAt)))
    .returning();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.clientId !== args.clientId) return null;
  if (row.redirectUri !== args.redirectUri) return null;

  const expectedChallenge = base64url(crypto.createHash("sha256").update(args.codeVerifier).digest());
  const a = Buffer.from(expectedChallenge);
  const b = Buffer.from(row.codeChallenge);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return { clientId: row.clientId, familyId: row.familyId, userId: row.userId };
}
