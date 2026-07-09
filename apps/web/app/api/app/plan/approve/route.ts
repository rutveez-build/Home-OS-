import { NextResponse } from "next/server";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { resolveApproval } from "@/lib/approvals";
import { logAudit } from "@/lib/audit";
import { approvePlan, latestPlan } from "@/db/kitchen-repo";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "approve")) {
    return NextResponse.json({ error: deniedReply("approve") }, { status: 403 });
  }

  const plan = await latestPlan(auth.familyId);
  if (!plan) return NextResponse.json({ error: "Nothing to approve yet" }, { status: 404 });
  if (plan.status === "approved") return NextResponse.json({ error: "Already approved" }, { status: 409 });

  const approved = await approvePlan(plan.id, auth.userId);
  if (!approved) return NextResponse.json({ error: "Couldn't approve — try again" }, { status: 409 });

  const resolved = await resolveApproval({
    familyId: auth.familyId,
    subjectType: "meal_plan",
    subjectId: plan.id,
    resolvedByUserId: auth.userId,
    decision: "approved",
    channel: "web",
  });
  if (!resolved) {
    await logAudit({
      familyId: auth.familyId,
      actorUserId: auth.userId,
      actor: "user",
      action: "meal_plan.approved",
      subjectType: "meal_plan",
      subjectId: plan.id,
      channel: "web",
    });
  }

  return NextResponse.json({ plan: approved });
}
