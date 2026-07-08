import type { Skill } from "./types";

export const groceries: Skill = {
  id: "groceries",
  name: "Grocery list",
  oneLiner:
    "Keep one running list across the family. Recurring essentials. Last-mile order to your local chain.",
  systemPromptHint:
    "Help the family maintain one shared grocery list. Anyone can add items. Recurring staples (milk, atta, rice) should be tracked separately so they get re-ordered without being re-mentioned. When ready, offer to place an order via the configured grocery partner.",
  examples: [
    "Add dahi and besan to the list",
    "What's on the grocery list right now?",
    "Order everything for delivery tomorrow morning",
    "We always run out of milk by Wednesday",
  ],
  slashCommands: ["/grocery", "/grocery add", "/grocery list"],
  suggestedSchema: [
    "groceries(id, family_id, item, qty, unit, status 'open'|'bought'|'cancelled', added_by_user_id, recurring boolean, created_at, completed_at)",
    "grocery_orders(id, family_id, vendor, total_inr, status, placed_at, delivered_at)",
  ],
  status: "scaffold",
};
