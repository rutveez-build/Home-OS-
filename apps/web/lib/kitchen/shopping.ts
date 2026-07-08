// Shopping list: aggregate ingredients from the approved plan, grouped for
// quick-commerce. Export-only — we format text for the family to paste into
// Blinkit/Zepto/Instamart. We never order, scrape, or store credentials.

import { llm, LLM_MODEL_FAST } from "../llm";
import { logAudit } from "../audit";
import {
  getProfile,
  latestPlan,
  latestShoppingList,
  planEntries,
  saveShoppingList,
} from "@/db/kitchen-repo";
import type { ShoppingItem } from "@/db/schema";

// ponytail: fixed staples list instead of pantry inventory — inventory is a
// data-entry burden the research says to defer (add Grocy later if asked).
const PANTRY_STAPLES = [
  "salt", "sugar", "turmeric", "chilli powder", "cumin", "mustard seeds",
  "cooking oil", "ghee", "atta", "rice (daily)", "tea", "garam masala",
];

export async function buildShoppingList(args: {
  familyId: string;
  userId: string;
}): Promise<{ text: string } | { error: string }> {
  const plan = await latestPlan(args.familyId);
  if (!plan || plan.status !== "approved") {
    return { error: "No approved plan yet. Run `/plan week`, then `/plan approve` first." };
  }

  const existing = await latestShoppingList(plan.id);
  if (existing) return { text: formatList(existing.items) };

  const entries = await planEntries(plan.id);
  const profile = await getProfile(args.familyId);

  const prompt = `Build a weekly grocery shopping list for these Indian home-cooked meals:
${entries.map((e) => `- ${e.dish}`).join("\n")}

Rules:
- Skip pantry staples the household already has: ${PANTRY_STAPLES.join(", ")}.
- Respect allergies (never include): ${profile?.allergies?.join(", ") || "none"}.
- Realistic quantities for one family for one week. Merge duplicates across dishes.
- category must be one of: "Vegetables & Fruits", "Dairy", "Staples & Grains", "Masala & Dry", "Other".
- Where a common substitute exists, name ONE.

Return JSON: {"items":[{"name":"...","qty":"e.g. 500 g / 2 bunches","category":"...","substitute":"optional"}]}`;

  let items: ShoppingItem[];
  try {
    const res = await llm.chat.completions.create({
      model: LLM_MODEL_FAST,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
    });
    const parsed = JSON.parse(res.choices?.[0]?.message?.content ?? "{}");
    items = (Array.isArray(parsed?.items) ? parsed.items : []).filter(
      (i: { name?: unknown; qty?: unknown; category?: unknown }) =>
        typeof i.name === "string" && typeof i.qty === "string" && typeof i.category === "string"
    );
    if (!items.length) return { error: "List came back empty — try again in a moment." };
  } catch (err) {
    console.error("[shopping] generation failed", err);
    return { error: "Couldn't build the list just now. Try again in a moment." };
  }

  await saveShoppingList({ planId: plan.id, familyId: args.familyId, items });
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.userId,
    actor: "user",
    action: "list.exported",
    subjectType: "shopping_list",
    subjectId: plan.id,
    detail: { itemCount: items.length },
  });

  return { text: formatList(items) };
}

function formatList(items: ShoppingItem[]): string {
  const byCat = new Map<string, ShoppingItem[]>();
  for (const i of items) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
  const blocks = [...byCat.entries()].map(
    ([cat, list]) =>
      `${cat.toUpperCase()}\n` +
      list
        .map((i) => `• ${i.name} — ${i.qty}${i.substitute ? ` (sub: ${i.substitute})` : ""}`)
        .join("\n")
  );
  return (
    `Shopping list (copy into Blinkit / Zepto / Instamart):\n\n` +
    blocks.join("\n\n") +
    `\n\nI never place orders myself — you stay in charge of the cart.`
  );
}
