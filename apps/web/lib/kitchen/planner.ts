// Weekly meal plan generation. Allergies and diets are injected as hard
// constraints — data, not vibes. Output is always a draft; approval is a
// separate human step (lib/approvals.ts).

import { llm, LLM_MODEL_FAST } from "../llm";
import { logAudit } from "../audit";
import {
  createDraftPlan,
  getCook,
  getProfile,
  latestPlan,
  planEntries,
} from "@/db/kitchen-repo";
import type { MealPlan, MealScope, MealSlot } from "@/db/schema";

const SLOTS: Record<MealScope, MealSlot[]> = {
  d: ["dinner"],
  ld: ["lunch", "dinner"],
  bld: ["breakfast", "lunch", "dinner"],
};

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const delta = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function generateWeeklyPlan(args: {
  familyId: string;
  userId: string;
}): Promise<{ plan: MealPlan; text: string } | { error: string }> {
  const profile = await getProfile(args.familyId);
  const cook = await getCook(args.familyId);
  const scope: MealScope = profile?.mealScope ?? "ld";
  const slots = SLOTS[scope];

  // Repeat avoidance: dishes from the family's last plan.
  const prev = await latestPlan(args.familyId);
  const prevDishes = prev ? (await planEntries(prev.id)).map((e) => e.dish) : [];

  // Cook's working days: skip days the cook is off (0=Sun in workingDays).
  const workingDays = cook?.workingDays ?? [1, 2, 3, 4, 5, 6];

  const prompt = `Plan Indian home-cooked meals for one household for a week (Mon..Sun).

HARD CONSTRAINTS (never violate):
- Allergies / never serve: ${profile?.allergies?.join(", ") || "none"}
- Diets: ${profile?.diets?.join(", ") || "no restriction"}

PREFERENCES:
- Disliked: ${profile?.dislikes?.join(", ") || "none"}
- Favourite cuisines (rotate them): ${profile?.cuisines?.join(", ") || "Indian home food"}
- Budget: ${profile?.budgetBand || "moderate"}
- Do NOT repeat these recent dishes: ${prevDishes.join(", ") || "none"}

MEALS per day: ${slots.join(", ")}.
ONLY these days (cook's working days, 0=Sun..6=Sat): ${workingDays.join(",")}.

Return JSON: {"entries":[{"day":0..6 (0=Mon..6=Sun),"meal":"breakfast"|"lunch"|"dinner","dish":"...","notes":"short reason/tag or empty"}]}
Simple, realistic home dishes a household cook can make. No dish name twice.`;

  let entries: Array<{ day: number; meal: MealSlot; dish: string; notes?: string }>;
  try {
    const res = await llm.chat.completions.create({
      model: LLM_MODEL_FAST,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
    });
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? "{}");
    const valid = (Array.isArray(parsed?.entries) ? parsed.entries : []).filter(
      (e: { day?: unknown; meal?: unknown; dish?: unknown }) =>
        typeof e.day === "number" &&
        e.day >= 0 &&
        e.day <= 6 &&
        typeof e.dish === "string" &&
        slots.includes(e.meal as MealSlot)
    );
    if (!valid.length) return { error: "The planner came back empty. Try again in a moment." };
    entries = valid;
  } catch (err) {
    console.error("[planner] generation failed", err);
    return { error: "I couldn't reach the meal planner just now. Try again in a moment." };
  }

  const plan = await createDraftPlan({
    familyId: args.familyId,
    weekStart: nextMonday(),
    createdByUserId: args.userId,
    entries,
  });
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.userId,
    actor: "system",
    action: "plan.drafted",
    subjectType: "meal_plan",
    subjectId: plan.id,
    detail: { entryCount: entries.length, scope },
  });

  return { plan, text: formatPlan(plan.weekStart, entries) };
}

export function formatPlan(
  weekStart: string,
  entries: Array<{ day: number; meal: string; dish: string; notes?: string | null }>
): string {
  const byDay = new Map<number, string[]>();
  for (const e of entries) {
    const line = `  ${cap(e.meal)}: ${e.dish}${e.notes ? ` (${e.notes})` : ""}`;
    byDay.set(e.day, [...(byDay.get(e.day) ?? []), line]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  return (
    `Meal plan · week of ${weekStart}\n` +
    days.map((d) => `${DAY_NAMES[d]}\n${(byDay.get(d) ?? []).join("\n")}`).join("\n") +
    `\n\nReply "/plan approve" to approve, or "/plan change <day> <meal> <dish>" to edit.`
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
