import { NextResponse } from "next/server";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { requestApproval } from "@/lib/approvals";
import { generateWeeklyPlan } from "@/lib/kitchen/planner";
import { planEntries } from "@/db/kitchen-repo";

export const runtime = "nodejs";

// POST generates a fresh draft plan (mirrors "/plan week").
export async function POST() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "edit_plan")) {
    return NextResponse.json({ error: deniedReply("edit_plan") }, { status: 403 });
  }

  const res = await generateWeeklyPlan({ familyId: auth.familyId, userId: auth.userId });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 502 });

  await requestApproval({
    familyId: auth.familyId,
    subjectType: "meal_plan",
    subjectId: res.plan.id,
    requestedByUserId: auth.userId,
  });

  const entries = await planEntries(res.plan.id);
  return NextResponse.json({ plan: { ...res.plan, entries } });
}
