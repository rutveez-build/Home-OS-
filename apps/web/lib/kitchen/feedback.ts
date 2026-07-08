// Meal feedback — the retention flywheel. One command after dinner; the
// planner reads recent rows so next week visibly learns.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mealFeedback, type MealSlot } from "@/db/schema";
import { latestPlan, planEntries } from "@/db/kitchen-repo";
import { logAudit } from "../audit";

export async function recordMealFeedback(args: {
  familyId: string;
  userId: string;
  meal: MealSlot;
  cooked: "cooked" | "skipped";
  verdict?: "liked" | "ok" | "disliked";
  leftovers?: "none" | "some" | "lots";
  note?: string;
}): Promise<{ reply: string }> {
  // Attach to the dish on the most recent plan for that meal slot —
  // today's if the week is in progress, else the latest entry.
  const plan = await latestPlan(args.familyId);
  let dish = "unknown dish";
  let planId: string | undefined;
  if (plan) {
    const entries = (await planEntries(plan.id)).filter((e) => e.meal === args.meal);
    if (entries.length) {
      const weekStart = new Date(plan.weekStart + "T00:00:00");
      const today = Math.floor((Date.now() - weekStart.getTime()) / 86400000);
      const match =
        entries.find((e) => e.day === today) ??
        [...entries].reverse().find((e) => e.day <= today) ??
        entries[entries.length - 1];
      dish = match.dish;
      planId = plan.id;
    }
  }

  await db.insert(mealFeedback).values({
    familyId: args.familyId,
    planId,
    userId: args.userId,
    dish,
    meal: args.meal,
    cooked: args.cooked,
    verdict: args.verdict,
    leftovers: args.leftovers,
    note: args.note,
  });
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.userId,
    actor: "user",
    action: "feedback.recorded",
    subjectType: "meal_feedback",
    subjectId: planId,
    detail: { dish, ...args },
  });

  const ack =
    args.verdict === "disliked"
      ? `Noted — I'll steer away from ${dish}.`
      : args.leftovers === "lots"
        ? `Noted — I'll plan smaller portions of ${dish} next time.`
        : `Noted for ${dish} ✓ Next week's plan will use this.`;
  return { reply: ack };
}

// Compact digest for the planner prompt.
export async function feedbackDigest(familyId: string, limit = 20): Promise<string> {
  const rows = await db
    .select()
    .from(mealFeedback)
    .where(eq(mealFeedback.familyId, familyId))
    .orderBy(desc(mealFeedback.createdAt))
    .limit(limit);
  if (!rows.length) return "";
  const lines = rows.map((r) => {
    const bits = [r.cooked === "skipped" ? "was skipped" : null, r.verdict, r.leftovers ? `leftovers: ${r.leftovers}` : null, r.note]
      .filter(Boolean)
      .join(", ");
    return `- ${r.dish}: ${bits}`;
  });
  return lines.join("\n");
}
