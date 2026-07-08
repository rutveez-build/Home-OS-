// DPDP consent ledger. Consent is recorded the first time a member uses a
// feature in a category (contextual consent), and can be withdrawn with
// /privacy withdraw <category>. Withdrawal gates the feature off.

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { consents, type ConsentCategory } from "@/db/schema";
import { logAudit } from "./audit";

export const NOTICE_VERSION = "v1";

export async function recordConsent(args: {
  familyId: string;
  userId: string;
  category: ConsentCategory;
  purpose: string;
}): Promise<void> {
  // Re-grant after withdrawal reactivates the row (withdrawnAt cleared);
  // the audit log preserves the grant/withdraw history the Act cares about.
  await db
    .insert(consents)
    .values({ ...args, noticeVersion: NOTICE_VERSION })
    .onConflictDoUpdate({
      target: [consents.familyId, consents.userId, consents.category],
      set: { withdrawnAt: null, grantedAt: new Date(), purpose: args.purpose, noticeVersion: NOTICE_VERSION },
    });
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.userId,
    actor: "user",
    action: "consent.granted",
    subjectType: "consent",
    subjectId: args.category,
  });
}

export async function hasActiveConsent(
  familyId: string,
  userId: string,
  category: ConsentCategory
): Promise<boolean> {
  const c = await db.query.consents.findFirst({
    where: and(
      eq(consents.familyId, familyId),
      eq(consents.userId, userId),
      eq(consents.category, category),
      isNull(consents.withdrawnAt)
    ),
  });
  return !!c;
}

export async function withdrawConsent(args: {
  familyId: string;
  userId: string;
  category: ConsentCategory;
}): Promise<boolean> {
  const [row] = await db
    .update(consents)
    .set({ withdrawnAt: new Date() })
    .where(
      and(
        eq(consents.familyId, args.familyId),
        eq(consents.userId, args.userId),
        eq(consents.category, args.category),
        isNull(consents.withdrawnAt)
      )
    )
    .returning();
  if (row) {
    await logAudit({
      familyId: args.familyId,
      actorUserId: args.userId,
      actor: "user",
      action: "consent.withdrawn",
      subjectType: "consent",
      subjectId: args.category,
    });
  }
  return !!row;
}

export async function listConsents(familyId: string, userId: string) {
  return db.query.consents.findMany({
    where: and(eq(consents.familyId, familyId), eq(consents.userId, userId)),
  });
}
