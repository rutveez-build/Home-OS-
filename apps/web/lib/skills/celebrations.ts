import type { Skill } from "./types";

export const celebrations: Skill = {
  id: "celebrations",
  name: "Celebrations & gifting",
  oneLiner:
    "Birthdays, anniversaries, festivals — gifts, sweets, prep, never forgotten.",
  systemPromptHint:
    "Help the family stay ahead of birthdays, anniversaries and festivals — gifts to buy, sweets to order, decorations, prep lists. Surface what's coming up 1-2 weeks ahead. Remember who likes what from previous years (sweet preferences, gifting history) so suggestions don't feel generic.",
  examples: [
    "Diwali is in 3 weeks — what should we plan?",
    "Mom's birthday next Tuesday, ideas?",
    "Anniversary dinner reservation for Saturday",
    "What did we gift Tina for Rakhi last year?",
  ],
  slashCommands: ["/celebrate", "/upcoming", "/gift-log"],
  suggestedSchema: [
    "celebrations(id, family_id, kind 'birthday'|'anniversary'|'festival'|'milestone', title, for_member_user_id, on_date, plan_status 'planning'|'ready'|'done', notes)",
    "gifts(id, family_id, recipient_user_id, occasion_id, item, cost_inr, given_on, notes)",
  ],
  status: "scaffold",
};
