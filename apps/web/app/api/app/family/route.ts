import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/session";
import { createFamily, familiesForUser, listFamilyMembers } from "@/db/repo";
import { requireFamily, isAuthed } from "@/lib/app-api";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  const members = await listFamilyMembers(auth.familyId);
  return NextResponse.json({
    members: members.map((m) => ({
      name: m.member.displayName ?? m.user.name,
      role: m.member.role,
      isYou: m.user.id === auth.userId,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });

  const existing = await familiesForUser(userId);
  if (existing.length) {
    return NextResponse.json({ error: "You already have a family" }, { status: 409 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give your household a name" }, { status: 400 });

  const family = await createFamily({ name: parsed.data.name, ownerUserId: userId });
  return NextResponse.json({ family: { id: family.id, name: family.name, role: "owner" } });
}
