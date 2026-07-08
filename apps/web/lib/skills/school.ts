import type { Skill } from "./types";

export const school: Skill = {
  id: "school",
  name: "School & PTAs",
  oneLiner:
    "Kids' schedules, exam dates, PTA forms, school holidays — never miss a slip again.",
  systemPromptHint:
    "Help track each kid's school life — class schedule, exam dates, PTA meetings, holidays, fees due, project deadlines, the dozen forms that come home in the bag. Surface what's coming up this week. Quietly remind parents of fee deadlines before the school does.",
  examples: [
    "Aarav's term exams start Monday",
    "PTA on Friday for both kids",
    "Field trip permission form is due tomorrow",
    "Term fees pending?",
  ],
  slashCommands: ["/school", "/school today", "/school week"],
  suggestedSchema: [
    "school_events(id, family_id, child_user_id, kind 'exam'|'pta'|'holiday'|'event'|'fee'|'form', title, scheduled_for, status 'upcoming'|'done'|'missed', action_required text)",
  ],
  status: "scaffold",
};
