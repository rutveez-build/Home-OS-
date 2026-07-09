// Approval primitives — the product's core covenant: the assistant drafts,
// a human approves, only then does anything leave the household.
// Built for meal plans first; every future skill reuses the same table.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvals, type Approval } from "@/db/schema";
import { logAudit } from "./audit";

export async function requestApproval(args: {
  familyId: string;
  subjectType: string;
  subjectId: string;
  requestedByUserId?: string;
}): Promise<Approval> {
  const [a] = await db
    .insert(approvals)
    .values({
      familyId: args.familyId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      requestedByUserId: args.requestedByUserId ?? null,
    })
    .returning();
  await logAudit({
    familyId: args.familyId,
    actor: "system",
    action: `${args.subjectType}.approval_requested`,
    subjectType: args.subjectType,
    subjectId: args.subjectId,
  });
  return a;
}

// Resolve the latest pending approval for a subject. Guarded on status so
// two concurrent replies can't both win.
export async function resolveApproval(args: {
  familyId: string;
  subjectType: string;
  subjectId: string;
  resolvedByUserId: string;
  decision: "approved" | "declined";
  channel?: "web" | "whatsapp" | "assistant";
}): Promise<Approval | null> {
  const pending = await db.query.approvals.findFirst({
    where: and(
      eq(approvals.familyId, args.familyId),
      eq(approvals.subjectType, args.subjectType),
      eq(approvals.subjectId, args.subjectId),
      eq(approvals.status, "pending")
    ),
    orderBy: desc(approvals.createdAt),
  });
  if (!pending) return null;
  const [resolved] = await db
    .update(approvals)
    .set({
      status: args.decision,
      resolvedByUserId: args.resolvedByUserId,
      resolvedAt: new Date(),
    })
    .where(and(eq(approvals.id, pending.id), eq(approvals.status, "pending")))
    .returning();
  if (!resolved) return null; // raced
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.resolvedByUserId,
    actor: "user",
    action: `${args.subjectType}.${args.decision}`,
    subjectType: args.subjectType,
    subjectId: args.subjectId,
    channel: args.channel,
  });
  return resolved;
}
