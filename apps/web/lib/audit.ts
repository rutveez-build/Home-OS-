// Append-only trust ledger. Every external message, approval, and export
// goes through here. This is also the product's event stream — metrics roll
// up from audit entries, not a separate analytics pipe.

import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

export async function logAudit(args: {
  familyId?: string | null;
  actorUserId?: string | null;
  actor: "user" | "system";
  action: string; // dot-namespaced: 'plan.approved', 'cook_message.sent', 'list.exported'
  subjectType?: string;
  subjectId?: string;
  channel?: "web" | "whatsapp" | "system";
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      familyId: args.familyId ?? null,
      actorUserId: args.actorUserId ?? null,
      actor: args.actor,
      action: args.action,
      subjectType: args.subjectType ?? null,
      subjectId: args.subjectId ?? null,
      channel: args.channel ?? null,
      detail: args.detail ?? null,
    });
  } catch (err) {
    // The ledger must never take down the action it records — but a silent
    // ledger is worse than a noisy log.
    console.error("[audit] write failed", args.action, err);
  }
}
