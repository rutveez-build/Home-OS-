import type { Skill } from "./types";

export const healthRecords: Skill = {
  id: "health-records",
  name: "Health records vault",
  oneLiner:
    "Every lab report, prescription and consult note for every family member — searchable, queryable.",
  systemPromptHint:
    "The family can upload medical records — lab reports (PDFs / images), prescriptions, doctor's notes — one vault per family member. When the user asks about a past test, a medication, a value (e.g. 'what was my mother's last vitamin D?'), look it up and answer with the date, value, and source document. If a report indicates a trend or a flag, gently surface it without diagnosing. Always cite the source document by date.",
  examples: [
    "What was Papa's last HbA1c reading?",
    "Show me my daughter's allergy report from last year",
    "Mom's blood pressure trend over the last 6 months",
    "What medications is my father on right now?",
  ],
  slashCommands: ["/records", "/records add", "/records member NAME"],
  suggestedSchema: [
    "health_records(id, family_id, member_user_id, kind 'lab'|'prescription'|'consult_note'|'imaging'|'vaccination', file_url, ocr_text, structured_findings_json, taken_on, uploaded_by_user_id, uploaded_at)",
    "medications(id, family_id, member_user_id, name, dosage, frequency, prescribed_by, start_date, end_date, active boolean)",
  ],
  status: "scaffold",
};
