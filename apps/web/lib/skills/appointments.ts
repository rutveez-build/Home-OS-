import type { Skill } from "./types";

export const appointments: Skill = {
  id: "appointments",
  name: "Doctor appointments",
  oneLiner:
    "Book consults and lab tests, remember follow-ups, surface reports back in chat.",
  systemPromptHint:
    "Help the family book medical appointments — doctor consults, lab tests, follow-ups. Match the right specialist to the symptom. Track who has what coming up, who's overdue. After a consult, surface the doctor's note and any prescribed tests back in the chat. Never diagnose or prescribe — only triage and route.",
  examples: [
    "Book a thyroid panel for me tomorrow",
    "Papa's BP follow-up is overdue",
    "Pediatrician for our daughter's cough",
    "Any tests pending for anyone this week?",
  ],
  slashCommands: ["/appointment", "/book", "/health-due"],
  suggestedSchema: [
    "appointments(id, family_id, member_user_id, kind 'consult'|'lab'|'follow-up', provider_id, scheduled_for, status 'scheduled'|'attended'|'missed'|'cancelled', notes, created_at)",
    "providers(id, name, type, specialization, languages, location, cost_inr, partner_org)",
  ],
  status: "scaffold",
};
