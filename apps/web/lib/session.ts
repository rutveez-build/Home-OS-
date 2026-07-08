// Signed session cookie. The cookie carries only the userId, signed with
// SESSION_SECRET so a client cannot forge another user's identity.
// Set at onboarding via POST /api/session; read by /api/chat.

import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "fos_session";

const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  console.error("[session] SESSION_SECRET is not set — sessions will not verify in production.");
}
// ponytail: dev fallback keeps local setup zero-config; prod requires the env var.
const KEY = secret ?? "dev-only-insecure-secret";

function sign(value: string): string {
  return crypto.createHmac("sha256", KEY).update(value).digest("base64url");
}

export function sealSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function openSession(sealed: string | undefined): string | null {
  if (!sealed) return null;
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = sealed.slice(0, dot);
  const sig = sealed.slice(dot + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export async function sessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return openSession(jar.get(SESSION_COOKIE)?.value);
}
