# Home OS — MCP Tool Contract (Segment 1)

The contract an external assistant surface (ChatGPT, Claude, Codex, or any
other MCP-capable client) uses to drive Home OS without knowing repo
internals. Defined in code at `apps/web/lib/mcp/tools.ts` — this file is the
human-readable mirror of that module, kept in sync by hand. Every tool maps
1:1 onto an existing REST route (`apps/web/app/api/app/*`), which is the same
backend the web UI and WhatsApp slash-commands already use. One set of rules,
three surfaces.

## Principles

- **Approval-first.** No tool sends messages to staff or writes outside the
  household. `approve_meal_plan` and `send_cook_message` must only be called
  after the human has seen the actual content and said yes in the same
  conversation — never on the assistant's own judgement.
- **Household-scoped.** Every call is authenticated by a per-household token
  (see Auth below); tools never cross households.
- **Audited.** Every mutating call lands in `audit_log` with actor, action,
  channel = `assistant`.

## Tools

| Tool | REST route | Permission | Notes |
|---|---|---|---|
| `get_household_state()` | `GET /api/app/state` | view | Call first — profile, cook, plan (+entries), shopping list in one shot |
| `create_household(name)` | `POST /api/app/family` | — (no household yet) | Only for a brand-new user; `get_household_state` returns `family: null` in that case |
| `update_household_profile(patch)` | `POST /api/app/profile` | manage_household | members, diets, allergies, dislikes, cuisines, budgetBand, mealScope — send only changed fields |
| `set_cook(name, phone?, language?, frequency?, workingDays?)` | `POST /api/app/cook` | manage_household | |
| `create_meal_plan()` | `POST /api/app/plan` | edit_plan | Returns a **draft** — show it, get a yes, then `approve_meal_plan` |
| `change_plan_entry(day, meal, dish)` | `POST /api/app/plan/entry` | edit_plan | Works on draft or approved plans; doesn't un-approve |
| `approve_meal_plan()` | `POST /api/app/plan/approve` | approve | Human-confirmed surfaces only |
| `draft_cook_message()` | `GET /api/app/cook-message` | view | Text only, nothing sent |
| `send_cook_message()` | `POST /api/app/cook-message` | approve | Requires the human to have seen the exact draft |
| `get_shopping_list()` | `POST /api/app/shopping` | view | Builds once per plan, then returns the saved list |
| `list_feedback()` | `GET /api/app/feedback` | — (any member) | |
| `record_feedback(meal, cooked, verdict?, leftovers?, note?)` | `POST /api/app/feedback` | — (any member) | Same as the `/feedback` chat command — no role gate |

## Auth

Per-household API token, minted and revocable from the web app, one token
per household, logged on every use. Build tracked as its own unit (MCP Unit
3) — this is the one part of the plugin that gets an adversarial review
before it ships, since a leaked or mis-scoped token is the actual attack
surface here.
