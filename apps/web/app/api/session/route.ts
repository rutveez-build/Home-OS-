// Establish a signed session from the onboarding profile.
// The client sends its profile once; identity for all later requests comes
// from the httpOnly cookie, never from request bodies.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { upsertUserByDeviceId } from "@/db/repo";
import { SESSION_COOKIE, sealSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  deviceId: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
  language: z.enum(["en", "hi", "kn"]).catch("en"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }
  const user = await upsertUserByDeviceId(parsed.data);
  const res = NextResponse.json({ ok: true, name: user.name });
  res.cookies.set(SESSION_COOKIE, sealSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
