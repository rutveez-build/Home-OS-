// Email + password accounts for the hosted demo. One endpoint, two modes:
// POST { mode: "signup" | "login", ... } → sets the same signed session
// cookie the rest of the app already trusts. Multi-device by design.
// Device-cookie guests (/api/session) keep working as the zero-friction path.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { SESSION_COOKIE, sealSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { masterTestAccount } from "@/lib/admin";
import { emailDomainAcceptsMail } from "@/lib/email-verify";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("signup"),
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(8).max(200),
    language: z.enum(["en", "hi", "kn"]).catch("en"),
    phone: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  }),
  z.object({
    mode: z.literal("login"),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(1).max(200),
  }),
]);

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the form — email, and a password of 8+ characters." }, { status: 400 });
  }
  const body = parsed.data;

  const master = masterTestAccount();

  if (body.mode === "signup") {
    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) {
      return NextResponse.json({ error: "That email already has an account — log in instead." }, { status: 409 });
    }
    if (master && body.email === master.email) {
      return NextResponse.json({ error: "That email is reserved — log in instead." }, { status: 409 });
    }
    // Email verification: the domain must be able to receive mail (MX/A
    // lookup). Blocks typos and junk domains; the master test account is
    // exempt so the login loop stays testable.
    if (body.email !== master?.email && !(await emailDomainAcceptsMail(body.email))) {
      return NextResponse.json(
        { error: "That email's domain can't receive mail — double-check the address." },
        { status: 400 }
      );
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    let user;
    try {
      [user] = await db
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          name: body.name,
          language: body.language,
          // phone stored unverified — used later for WhatsApp linking, never for auth
          ...(body.phone ? { phone: body.phone } : {}),
        })
        .returning();
    } catch {
      // unique collision on phone: register without it rather than failing signup
      [user] = await db
        .insert(users)
        .values({ email: body.email, passwordHash, name: body.name, language: body.language })
        .returning();
    }
    await logAudit({ actorUserId: user.id, actor: "user", action: "account.created", channel: "web" });
    return withSession(user.id, { ok: true, name: user.name });
  }

  // Master test account (env-gated, never hardcoded): when MASTER_TEST_EMAIL
  // + MASTER_TEST_PASSWORD are configured, that email always logs in with
  // that password — regardless of stored state, auto-created on first use.
  // Exists so the operator can re-verify the login loop repeatedly.
  if (master && body.email === master.email) {
    // Timing-safe compare (hash both sides to equalize length first).
    const given = createHash("sha256").update(body.password).digest();
    const expected = createHash("sha256").update(master.password).digest();
    if (!timingSafeEqual(given, expected)) {
      // While the master account is enabled, the master password is the ONLY
      // way into this email — a squatter who signed the address up earlier
      // with their own password is locked out, not silently co-tenanting.
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }
    let user = await db.query.users.findFirst({ where: eq(users.email, master.email) });
    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email: master.email, name: "Master Tester", language: "en" })
        .returning();
    }
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
    await logAudit({ actorUserId: user.id, actor: "user", action: "account.master_login", channel: "web" });
    return withSession(user.id, { ok: true, name: user.name, language: user.language });
  }

  // login
  const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
  if (!user?.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
  return withSession(user.id, { ok: true, name: user.name, language: user.language });
}

function withSession(userId: string, payload: Record<string, unknown>) {
  const res = NextResponse.json(payload);
  res.cookies.set(SESSION_COOKIE, sealSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
