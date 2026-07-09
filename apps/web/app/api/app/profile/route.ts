import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { recordConsent } from "@/lib/consent";
import { upsertProfile } from "@/db/kitchen-repo";

export const runtime = "nodejs";

const Body = z.object({
  members: z.array(z.object({ name: z.string().trim().min(1).max(60), note: z.string().trim().max(60).optional() })).max(20).optional(),
  diets: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dislikes: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  cuisines: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  budgetBand: z.string().trim().max(60).optional(),
  mealScope: z.enum(["d", "ld", "bld"]).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "manage_household")) {
    return NextResponse.json({ error: deniedReply("manage_household") }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile update" }, { status: 400 });

  const profile = await upsertProfile(auth.familyId, parsed.data);

  await recordConsent({ familyId: auth.familyId, userId: auth.userId, category: "household_data", purpose: "meal planning" });
  if (parsed.data.allergies) {
    await recordConsent({ familyId: auth.familyId, userId: auth.userId, category: "health_data", purpose: "allergy-safe meal planning" });
  }

  return NextResponse.json({ profile });
}
