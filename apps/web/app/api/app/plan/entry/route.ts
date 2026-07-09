import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { latestPlan, updateEntryDish } from "@/db/kitchen-repo";

export const runtime = "nodejs";

const Body = z.object({
  day: z.number().int().min(0).max(6),
  meal: z.enum(["breakfast", "lunch", "dinner"]),
  dish: z.string().trim().min(2).max(120),
});

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "edit_plan")) {
    return NextResponse.json({ error: deniedReply("edit_plan") }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid entry" }, { status: 400 });

  const plan = await latestPlan(auth.familyId);
  if (!plan) return NextResponse.json({ error: "No plan yet" }, { status: 404 });

  const entry = await updateEntryDish({ planId: plan.id, ...parsed.data });
  if (!entry) return NextResponse.json({ error: "That day/meal isn't in the plan" }, { status: 404 });

  await logAudit({
    familyId: auth.familyId,
    actorUserId: auth.userId,
    actor: "user",
    action: "plan.entry_changed",
    subjectType: "meal_plan",
    subjectId: plan.id,
    channel: "web",
    detail: parsed.data,
  });

  return NextResponse.json({ entry });
}
