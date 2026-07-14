// Signup email verification, no external provider: confirm the domain can
// actually receive mail (MX record, falling back to A/AAAA per RFC 5321).
// This blocks typos and fake domains at the door. It is NOT a mailbox-level
// check — proving the inbox exists needs a real verification email, which
// needs an email-sending provider (see README challenges).

import { resolveMx, resolve4, resolve6 } from "node:dns/promises";

const CHECK_TIMEOUT_MS = 3500;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("dns-timeout")), CHECK_TIMEOUT_MS)),
  ]);
}

/**
 * True when the email's domain is plausibly deliverable.
 * Fail-open on resolver errors/timeouts — a flaky DNS resolver must never
 * block signups; the check is a tripwire for junk domains, not a gate of
 * last resort.
 */
export async function emailDomainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain || !domain.includes(".")) return false;

  try {
    const mx = await withTimeout(resolveMx(domain));
    if (mx.length > 0) return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOTFOUND" && (err as Error).message !== "dns-timeout") {
      // resolver hiccup — fail open
      return true;
    }
    if ((err as Error).message === "dns-timeout") return true;
  }

  // RFC 5321 fallback: no MX → try the domain's A/AAAA record
  try {
    const a = await withTimeout(resolve4(domain));
    if (a.length > 0) return true;
  } catch {}
  try {
    const aaaa = await withTimeout(resolve6(domain));
    if (aaaa.length > 0) return true;
  } catch {}

  return false;
}
