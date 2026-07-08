import type { Skill } from "./types";

export const meals: Skill = {
  id: "meals",
  name: "Meals & cooking",
  oneLiner:
    "Plan breakfast, lunch and dinner — respecting dietary preferences and what's in the kitchen.",
  systemPromptHint:
    "When the user asks about food, cooking or meal planning, help them think through breakfast / lunch / dinner for the day or week. Respect dietary preferences in the family profile (Jain, vegetarian, diabetic-friendly, post-natal, etc.). Suggest simple Indian meals first. If ingredients are missing, offer to add them to the grocery list.",
  examples: [
    "What should we make for dinner?",
    "Plan this week's lunches",
    "My in-laws are visiting Saturday — they're Jain",
    "Something light for kids tonight",
  ],
  slashCommands: ["/meal", "/meal today", "/meal week"],
  suggestedSchema: [
    "meals(id, family_id, slot 'breakfast'|'lunch'|'dinner', dish, ingredients_json, planned_for, created_by, created_at)",
  ],
  status: "scaffold",
};
