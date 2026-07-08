# Skills

Each file in this folder is a **skill** — a named capability the assistant knows about. Skills are intentionally lightweight metadata: a description, system prompt hint, examples, and a suggested table schema for adopters to flesh out.

## How the assistant learns about them

`lib/system-prompt.ts` calls `skillsPromptBlock()` from `skills/index.ts`, which iterates every registered skill and appends a one-line description to the system prompt. So the moment you add a new skill file and register it in `index.ts`, the assistant starts offering it in conversations.

## Implementing a skill end-to-end

Each shipped skill is `status: 'scaffold'` — the bot can *talk* about it but can't persist or act on it yet. To make one real:

1. **Schema** — read the `suggestedSchema` array in the skill file, translate to Drizzle in `db/schema.ts`, run `pnpm db:generate && pnpm db:migrate`.
2. **Repo** — add CRUD helpers in `db/repo.ts`.
3. **Handler** — extend `lib/family-commands.ts` (for slash commands) or wire tool-calls into `lib/chat-core.ts` (for natural-language triggers).
4. **UI** — if the web app needs to render the skill's data (a meals list, a grocery list, a bills table), add a sheet/section in `components/`.
5. Update the skill's `status` to `'beta'` or `'live'`.

## What ships today

| Skill | Status | Notes |
|---|---|---|
| Meals & cooking | scaffold | Meal planning, dietary preferences |
| Grocery list | scaffold | Shared running list, recurring staples |
| Responsibilities | scaffold | Task assignment, rotation, reminders |
| Doctor appointments | scaffold | Consults, lab tests, follow-ups |
| Health records vault | scaffold | All reports per family member, queryable |
| Household staff | scaffold | Attendance, salaries, leave |
| School & PTAs | scaffold | Kid schedules, exam dates, forms |
| Bills & renewals | scaffold | Recurring payments, insurance, subscriptions |
| Celebrations & gifting | scaffold | Birthdays, anniversaries, festivals |

## Adding a new skill

```ts
// lib/skills/finances.ts
import type { Skill } from "./types";

export const finances: Skill = {
  id: "finances",
  name: "Family finances",
  oneLiner: "Income, expenses, savings goals — for the whole household.",
  systemPromptHint: "Help track family income and expenses…",
  examples: ["How much did we spend last month?", "Set a savings goal for the kids' college"],
  suggestedSchema: [
    "transactions(id, family_id, member_user_id, amount_inr, kind, category, occurred_on)",
  ],
  status: "scaffold",
};
```

Then register it in `lib/skills/index.ts`:

```ts
import { finances } from "./finances";
export const skills: Skill[] = [..., finances];
```

Done. The bot now offers it.
