// Kitchen data access: household profile, staff, meal plans, shopping lists.

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./client";
import {
  householdProfiles,
  mealPlanEntries,
  mealPlans,
  shoppingLists,
  staff,
  type HouseholdMember,
  type HouseholdProfile,
  type MealPlan,
  type MealPlanEntry,
  type MealScope,
  type MealSlot,
  type ShoppingItem,
  type ShoppingList,
  type Staff,
} from "./schema";

/* ─────────── household profile ─────────── */

export async function getProfile(familyId: string): Promise<HouseholdProfile | null> {
  const p = await db.query.householdProfiles.findFirst({
    where: eq(householdProfiles.familyId, familyId),
  });
  return p ?? null;
}

export async function upsertProfile(
  familyId: string,
  patch: Partial<{
    members: HouseholdMember[];
    diets: string[];
    allergies: string[];
    dislikes: string[];
    cuisines: string[];
    budgetBand: string;
    mealScope: MealScope;
  }>
): Promise<HouseholdProfile> {
  const [p] = await db
    .insert(householdProfiles)
    .values({ familyId, ...patch })
    .onConflictDoUpdate({
      target: householdProfiles.familyId,
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return p;
}

/* ─────────── staff ─────────── */

export async function getCook(familyId: string): Promise<Staff | null> {
  const s = await db.query.staff.findFirst({
    where: eq(staff.familyId, familyId),
    orderBy: asc(staff.createdAt),
  });
  return s ?? null;
}

export async function upsertCook(args: {
  familyId: string;
  name: string;
  phone?: string;
  language?: string;
  frequency?: string;
  workingDays?: number[];
}): Promise<Staff> {
  const existing = await getCook(args.familyId);
  if (existing) {
    const [s] = await db
      .update(staff)
      .set({
        name: args.name,
        ...(args.phone !== undefined ? { phone: args.phone } : {}),
        ...(args.language ? { language: args.language } : {}),
        ...(args.frequency ? { frequency: args.frequency } : {}),
        ...(args.workingDays ? { workingDays: args.workingDays } : {}),
      })
      .where(eq(staff.id, existing.id))
      .returning();
    return s;
  }
  const [s] = await db.insert(staff).values(args).returning();
  return s;
}

/* ─────────── meal plans ─────────── */

export async function latestPlan(familyId: string): Promise<MealPlan | null> {
  const p = await db.query.mealPlans.findFirst({
    where: and(eq(mealPlans.familyId, familyId)),
    orderBy: desc(mealPlans.createdAt),
  });
  return p ?? null;
}

export async function planEntries(planId: string): Promise<MealPlanEntry[]> {
  return db.query.mealPlanEntries.findMany({
    where: eq(mealPlanEntries.planId, planId),
    orderBy: [asc(mealPlanEntries.day), asc(mealPlanEntries.meal)],
  });
}

export async function createDraftPlan(args: {
  familyId: string;
  weekStart: string;
  createdByUserId?: string;
  entries: Array<{ day: number; meal: MealSlot; dish: string; notes?: string }>;
}): Promise<MealPlan> {
  return db.transaction(async (tx) => {
    // One draft at a time: discard any older unapproved drafts.
    await tx
      .update(mealPlans)
      .set({ status: "discarded" })
      .where(and(eq(mealPlans.familyId, args.familyId), eq(mealPlans.status, "draft")));
    const [plan] = await tx
      .insert(mealPlans)
      .values({
        familyId: args.familyId,
        weekStart: args.weekStart,
        createdByUserId: args.createdByUserId ?? null,
      })
      .returning();
    if (args.entries.length) {
      await tx.insert(mealPlanEntries).values(
        args.entries.map((e) => ({
          planId: plan.id,
          day: e.day,
          meal: e.meal,
          dish: e.dish,
          notes: e.notes ?? null,
        }))
      );
    }
    return plan;
  });
}

// Approval gate: only a draft flips to approved, and only once.
export async function approvePlan(planId: string, userId: string): Promise<MealPlan | null> {
  const [p] = await db
    .update(mealPlans)
    .set({ status: "approved", approvedByUserId: userId, approvedAt: new Date() })
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.status, "draft")))
    .returning();
  return p ?? null;
}

export async function updateEntryDish(args: {
  planId: string;
  day: number;
  meal: MealSlot;
  dish: string;
}): Promise<MealPlanEntry | null> {
  const [e] = await db
    .update(mealPlanEntries)
    .set({ dish: args.dish, notes: "changed by family" })
    .where(
      and(
        eq(mealPlanEntries.planId, args.planId),
        eq(mealPlanEntries.day, args.day),
        eq(mealPlanEntries.meal, args.meal)
      )
    )
    .returning();
  return e ?? null;
}

/* ─────────── shopping lists ─────────── */

export async function saveShoppingList(args: {
  planId: string;
  familyId: string;
  items: ShoppingItem[];
}): Promise<ShoppingList> {
  const [l] = await db.insert(shoppingLists).values(args).returning();
  return l;
}

export async function latestShoppingList(planId: string): Promise<ShoppingList | null> {
  const l = await db.query.shoppingLists.findFirst({
    where: eq(shoppingLists.planId, planId),
    orderBy: desc(shoppingLists.createdAt),
  });
  return l ?? null;
}
