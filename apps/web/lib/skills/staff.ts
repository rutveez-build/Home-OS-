import type { Skill } from "./types";

export const staff: Skill = {
  id: "staff",
  name: "Household staff",
  oneLiner:
    "Maid, cook, driver, ayah — attendance, salaries, leave, advance, all in one place.",
  systemPromptHint:
    "Help the family manage household staff — track who's working today, who took leave, monthly salaries, advances given, festival bonuses. Be respectful: staff are people, not assets. Keep the language warm. Surface salary day in advance so it never slips.",
  examples: [
    "Geeta took leave on Tuesday",
    "What's pending for the cook this month?",
    "Driver's salary is due tomorrow",
    "Mark the maid present for today",
  ],
  slashCommands: ["/staff", "/staff attendance", "/staff salary"],
  suggestedSchema: [
    "staff(id, family_id, name, role 'maid'|'cook'|'driver'|'ayah'|'gardener'|'other', monthly_salary_inr, joined_on, active boolean, notes)",
    "staff_attendance(id, staff_id, date, status 'present'|'absent'|'half-day'|'leave', notes)",
    "staff_payments(id, staff_id, kind 'salary'|'advance'|'bonus', amount_inr, for_month, paid_at)",
  ],
  status: "scaffold",
};
