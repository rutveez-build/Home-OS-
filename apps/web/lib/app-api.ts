// Shared auth/session helper for the structured JSON API (apps/web/app/api/app/*).
// These routes back the card-based web UI; the slash-command path
// (lib/kitchen-commands.ts) stays untouched for WhatsApp and power users —
// both call the same underlying db/kitchen-repo + lib/kitchen/* functions.

import { NextResponse } from "next/server";
import { familiesForUser } from "@/db/repo";
import type { FamilyRole } from "@/db/schema";
import { sessionUserId } from "./session";

export type AuthedFamily = {
  userId: string;
  familyId: string;
  familyName: string;
  role: FamilyRole;
};

export async function requireFamily(): Promise<AuthedFamily | NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
  const fams = await familiesForUser(userId);
  if (!fams.length) return NextResponse.json({ error: "No family yet" }, { status: 404 });
  return {
    userId,
    familyId: fams[0].family.id,
    familyName: fams[0].family.name,
    role: fams[0].member.role,
  };
}

export function isAuthed(x: AuthedFamily | NextResponse): x is AuthedFamily {
  return !(x instanceof NextResponse);
}
