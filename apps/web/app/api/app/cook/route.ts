import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { recordConsent } from "@/lib/consent";
import { upsertCook } from "@/db/kitchen-repo";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  language: z.enum(["en", "hi", "kn", "mr", "ta", "te", "bn"]).optional(),
  frequency: z.enum(["occasionally", "once_daily", "twice_daily", "thrice_daily", "live_in"]).optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "manage_household")) {
    return NextResponse.json({ error: deniedReply("manage_household") }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the cook's details" }, { status: 400 });

  const cook = await upsertCook({ familyId: auth.familyId, ...parsed.data });
  await recordConsent({ familyId: auth.familyId, userId: auth.userId, category: "staff_messaging", purpose: "cook coordination on WhatsApp" });

  return NextResponse.json({ cook });
}
