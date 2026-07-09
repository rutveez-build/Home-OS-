import { NextResponse } from "next/server";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { hasActiveConsent } from "@/lib/consent";
import { requestApproval, resolveApproval } from "@/lib/approvals";
import { logAudit } from "@/lib/audit";
import { draftCookMessage } from "@/lib/kitchen/cook-message";
import { getProvider } from "@/lib/whatsapp";

export const runtime = "nodejs";

// GET drafts the message and opens an approval (mirrors "/plan cook").
export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const draft = await draftCookMessage(auth.familyId);
  if ("error" in draft) return NextResponse.json({ error: draft.error }, { status: 404 });

  await requestApproval({
    familyId: auth.familyId,
    subjectType: "cook_message",
    subjectId: draft.planId,
    requestedByUserId: auth.userId,
  });

  return NextResponse.json({ draft });
}

// POST sends it via the configured WhatsApp provider (mirrors "/plan cook send").
export async function POST() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "approve")) {
    return NextResponse.json({ error: deniedReply("approve") }, { status: 403 });
  }
  if (!(await hasActiveConsent(auth.familyId, auth.userId, "staff_messaging"))) {
    return NextResponse.json(
      { error: "Staff messaging consent is withdrawn or missing." },
      { status: 403 }
    );
  }

  const draft = await draftCookMessage(auth.familyId);
  if ("error" in draft) return NextResponse.json({ error: draft.error }, { status: 404 });
  if (!draft.cookPhone) {
    return NextResponse.json(
      { error: "No cook phone saved — add one to send directly, or copy the message and forward it yourself.", draft },
      { status: 200 }
    );
  }

  await resolveApproval({
    familyId: auth.familyId,
    subjectType: "cook_message",
    subjectId: draft.planId,
    resolvedByUserId: auth.userId,
    decision: "approved",
    channel: "web",
  });
  await getProvider().sendText(draft.cookPhone, draft.text);
  await logAudit({
    familyId: auth.familyId,
    actorUserId: auth.userId,
    actor: "user",
    action: "cook_message.sent",
    subjectType: "cook_message",
    subjectId: draft.planId,
    channel: "whatsapp",
    detail: { to: draft.cookPhone, text: draft.text },
  });

  return NextResponse.json({ sent: true, cookName: draft.cookName });
}
