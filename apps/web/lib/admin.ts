// Admin + master-test-account configuration. Everything here is env-driven:
// nothing is hardcoded, so a fork of this open-source repo has no admin and
// no master account until its operator sets the variables.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/** The master test account: only exists when BOTH env vars are set. */
export function masterTestAccount(): { email: string; password: string } | null {
  const email = process.env.MASTER_TEST_EMAIL?.trim().toLowerCase();
  const password = process.env.MASTER_TEST_PASSWORD;
  if (!email || !password || password.length < 12) return null;
  return { email, password };
}
