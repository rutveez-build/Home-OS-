// Data rights as product features, not support tickets (DPDP):
//   /export           — full household data as JSON (owner/parent/partner)
//   /delete           — two-step household deletion (owner only)
//   /privacy          — notice, processor register, your consents
//   /privacy withdraw <category> | grant <category>

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  approvals,
  families,
  familyMembers,
  householdProfiles,
  mealPlanEntries,
  mealPlans,
  memories,
  messages,
  sessions,
  shoppingLists,
  staff,
  users,
  CONSENT_CATEGORIES,
  type ConsentCategory,
} from "@/db/schema";
import { familiesForUser } from "@/db/repo";
import { can, deniedReply } from "./permissions";
import { listConsents, recordConsent, withdrawConsent } from "./consent";
import { logAudit } from "./audit";
import type { CommandResult } from "./family-commands";

const PROCESSORS = `Who processes household data (processor register):
• Your LLM provider (whatever LLM_BASE_URL points to) — chat + planning
• Your WhatsApp provider (Meta Cloud or Twilio) — staff/family messages
• Your Postgres host — all stored data
• Your hosting provider (e.g. Vercel) — runs the app
Self-hosted: you (the operator) are the Data Fiduciary for your household.`;

export async function runPrivacyCommand(args: {
  userId: string;
  cmd: string;
  sub?: string;
  tail: string;
}): Promise<CommandResult> {
  const fams = await familiesForUser(args.userId);
  if (!fams.length) return { handled: true, reply: "No family yet — nothing stored beyond your own chat." };
  const familyId = fams[0].family.id;
  const role = fams[0].member.role;

  if (args.cmd === "export") {
    if (!can(role, "export_data")) return { handled: true, reply: deniedReply("export_data") };
    const data = await exportHousehold(familyId, args.userId);
    await logAudit({
      familyId,
      actorUserId: args.userId,
      actor: "user",
      action: "data.exported",
      subjectType: "family",
      subjectId: familyId,
    });
    return {
      handled: true,
      reply: `Your household data (JSON — copy and save it):\n\n${JSON.stringify(data, null, 1).slice(0, 60000)}`,
    };
  }

  if (args.cmd === "delete") {
    if (!can(role, "delete_data")) return { handled: true, reply: deniedReply("delete_data") };
    if (args.sub !== "confirm") {
      return {
        handled: true,
        reply:
          "⚠️ This permanently deletes the family: profile, plans, lists, staff, consents, invitations — for every member. Chats of individual members remain theirs.\nIf you're sure: `/delete confirm`",
      };
    }
    // Tombstone first — the ledger survives with familyId nulled by FK.
    await logAudit({
      familyId: null,
      actorUserId: args.userId,
      actor: "user",
      action: "family.deleted",
      subjectType: "family",
      subjectId: familyId,
      detail: { name: fams[0].family.name },
    });
    await db.delete(families).where(eq(families.id, familyId)); // cascades
    return { handled: true, reply: "Family deleted. All household data is gone. Your personal chat history remains yours — `/export` before deleting next time if you want a copy." };
  }

  if (args.cmd === "privacy") {
    if (args.sub === "withdraw" || args.sub === "grant") {
      const cat = args.tail.trim() as ConsentCategory;
      if (!CONSENT_CATEGORIES.includes(cat)) {
        return { handled: true, reply: `Category must be one of: ${CONSENT_CATEGORIES.join(", ")}` };
      }
      if (args.sub === "withdraw") {
        const ok = await withdrawConsent({ familyId, userId: args.userId, category: cat });
        return { handled: true, reply: ok ? `Consent withdrawn: ${cat}. The feature is now off for you.` : `No active consent for ${cat}.` };
      }
      await recordConsent({ familyId, userId: args.userId, category: cat, purpose: "re-granted by user" });
      return { handled: true, reply: `Consent granted: ${cat} ✓` };
    }

    const cons = await listConsents(familyId, args.userId);
    const consLines = cons.length
      ? cons.map((c) => `• ${c.category}: ${c.withdrawnAt ? "withdrawn" : "active"} (notice ${c.noticeVersion})`).join("\n")
      : "• none recorded yet — consents are logged when you first use each feature";
    return {
      handled: true,
      reply:
        `Privacy at a glance\n\nWhat we store: household profile, meal plans, shopping lists, staff contacts, your chats, extracted memories, and an audit log of every action.\nWhat we never do: order groceries, message staff, or share data without your explicit approval.\n\n${PROCESSORS}\n\nYour consents:\n${consLines}\n\nCommands: \`/export\` · \`/delete\` · \`/privacy withdraw <category>\` · \`/privacy grant <category>\``,
    };
  }

  return { handled: false };
}

async function exportHousehold(familyId: string, userId: string) {
  const [family, mems, profile, cooks, plans, lists, myMemories, audit] = await Promise.all([
    db.query.families.findFirst({ where: eq(families.id, familyId) }),
    db.select().from(familyMembers).where(eq(familyMembers.familyId, familyId)),
    db.query.householdProfiles.findFirst({ where: eq(householdProfiles.familyId, familyId) }),
    db.select().from(staff).where(eq(staff.familyId, familyId)),
    db.select().from(mealPlans).where(eq(mealPlans.familyId, familyId)),
    db.select().from(shoppingLists).where(eq(shoppingLists.familyId, familyId)),
    db.select().from(memories).where(eq(memories.userId, userId)),
    db.select().from(auditLog).where(eq(auditLog.familyId, familyId)).orderBy(desc(auditLog.createdAt)).limit(200),
  ]);
  const planIds = plans.map((p) => p.id);
  const entries = planIds.length
    ? await db.select().from(mealPlanEntries).where(inArray(mealPlanEntries.planId, planIds))
    : [];
  // Requester's own recent messages only — other members' chats stay private.
  const mySessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  const myMessages = mySessions.length
    ? await db
        .select()
        .from(messages)
        .where(inArray(messages.sessionId, mySessions.map((s) => s.id)))
        .orderBy(desc(messages.createdAt))
        .limit(200)
    : [];
  return {
    exportedAt: new Date().toISOString(),
    family,
    members: mems,
    profile,
    staff: cooks,
    mealPlans: plans,
    mealPlanEntries: entries,
    shoppingLists: lists,
    myMemories,
    myRecentMessages: myMessages,
    auditLog: audit,
  };
}
