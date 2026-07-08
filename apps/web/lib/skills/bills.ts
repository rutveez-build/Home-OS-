import type { Skill } from "./types";

export const bills: Skill = {
  id: "bills",
  name: "Bills & renewals",
  oneLiner:
    "Electricity, gas, society dues, insurance, subscriptions — paid before they're overdue.",
  systemPromptHint:
    "Help track recurring bills and one-off renewals — electricity, water, gas, internet, society maintenance, insurance premiums, school fees, OTT subscriptions. Surface what's due in the next 7 days. Auto-detect recurring patterns. Never let a renewal lapse silently.",
  examples: [
    "When is the electricity bill due?",
    "Insurance renewals coming up?",
    "Mark BESCOM paid for May",
    "What recurring stuff am I spending on?",
  ],
  slashCommands: ["/bills", "/bills due", "/bills paid"],
  suggestedSchema: [
    "bills(id, family_id, name, vendor, amount_inr, due_on, recurring 'one-off'|'monthly'|'quarterly'|'yearly', status 'due'|'paid'|'overdue', paid_at, paid_by_user_id, autopay boolean, notes)",
  ],
  status: "scaffold",
};
