import type { Skill } from "./types";

export const responsibilities: Skill = {
  id: "responsibilities",
  name: "Responsibilities",
  oneLiner:
    "Who does what, this week. Assign, rotate, remind — without nagging.",
  systemPromptHint:
    "Help the family divide household responsibilities — who takes the kid to school, who pays the electricity bill, who calls the plumber. Support rotation (alternate weeks), assignment (one person owns it), and gentle reminders. Never scold a missed task; just check in.",
  examples: [
    "Ravi handles bills this month, I'll do school runs",
    "Whose turn is it to call the plumber?",
    "Rotate the weekend grocery run between us",
    "What's on Aaji's list this week?",
  ],
  slashCommands: ["/tasks", "/my-tasks", "/assign"],
  suggestedSchema: [
    "responsibilities(id, family_id, title, assignee_user_id, frequency 'one-off'|'weekly'|'monthly', due_at, status 'open'|'done'|'skipped', notes, created_at, completed_at)",
  ],
  status: "scaffold",
};
