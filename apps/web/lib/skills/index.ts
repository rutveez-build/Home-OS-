// The skill registry. Add new skills here; the chat-core picks them up
// automatically via `skillsPromptBlock()` and the landing page lists them.

import { meals } from "./meals";
import { groceries } from "./groceries";
import { responsibilities } from "./responsibilities";
import { appointments } from "./appointments";
import { healthRecords } from "./health-records";
import { staff } from "./staff";
import { school } from "./school";
import { bills } from "./bills";
import { celebrations } from "./celebrations";
import type { Skill } from "./types";

export const skills: Skill[] = [
  meals,
  groceries,
  responsibilities,
  appointments,
  healthRecords,
  staff,
  school,
  bills,
  celebrations,
];

export function getSkill(id: string): Skill | undefined {
  return skills.find((s) => s.id === id);
}

// One block of text to append to the assistant's system prompt so it
// knows what it can offer to the family on day one.
export function skillsPromptBlock(): string {
  const lines = skills.map(
    (s) => `- **${s.name}** — ${s.systemPromptHint}`
  );
  return `\n\nSKILLS YOU CAN OFFER\nWhen a user's request matches one of these, lean into it. You're not limited to chat — these are real things the family can ask you to do.\n${lines.join(
    "\n"
  )}`;
}

export type { Skill, SkillStatus } from "./types";
