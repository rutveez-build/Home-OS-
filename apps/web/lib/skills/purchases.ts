import type { Skill } from "./types";

export const purchases: Skill = {
  id: "purchases",
  name: "Purchase memory",
  oneLiner:
    "Log receipts and ask \"did we already buy X?\" — a searchable record of what the household actually bought.",
  systemPromptHint:
    "When the user mentions a purchase or receipt, or asks whether something was already bought, use log_purchase / find_purchases. Receipt photos are uploaded through the web app's Purchases tab, not sent through chat — over MCP/chat, log_purchase takes structured data (store, items, total) rather than an image. Mention a cheaper known deal if find_purchases or log_purchase turns one up.",
  examples: [
    "Did we already buy sugar this month?",
    "Log a purchase: Whole Foods, milk and bread, ₹450",
    "Where did we last buy batteries?",
    "We saw detergent for ₹120 at DMart — remember that",
  ],
  suggestedSchema: [
    "purchases(id, family_id, store, purchase_date, subtotal, tax, total, source, created_at)",
    "purchase_items(id, purchase_id, name, normalized_name, quantity, unit_price, line_total)",
    "known_deals(id, family_id, item_name, normalized_name, store, price, added_by_user_id, created_at)",
  ],
  // Unlike most entries in this registry, this one is genuinely end-to-end
  // wired (schema, lib/purchases/*, REST routes, web UI tab, MCP tools) —
  // "live" is accurate here, not aspirational.
  status: "live",
};
