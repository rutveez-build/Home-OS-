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

No `create_household` — MCP tokens are minted from an *existing* household,
so a caller with no household could never hold a valid token to invoke one
with. Onboarding happens on the web app; MCP picks up after.

| Tool | REST route | Permission | Notes |
|---|---|---|---|
| `get_household_state()` | `GET /api/app/state` | view | Call first — profile, cook, plan (+entries), shopping list in one shot |
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

Permission is enforced once, centrally, in `app/api/mcp/route.ts` before any
handler runs — not left for each of the 11 handlers to remember individually.

## Auth

Per-household bearer token (`hos_...`), minted and revocable from the web
app's Connect screen, HMAC-SHA256 hashed at rest (`MCP_TOKEN_SECRET`, hard
-required in production — no insecure fallback), logged on every use.
Effective permissions are the minting user's *live* role — a role change,
member removal, or household deletion takes effect immediately, no stale
grants.

Adversarially reviewed (`/codex challenge`) before shipping. Findings fixed:
production-secret hard-fail, centralized role enforcement at the MCP
boundary, revocation-safe `lastUsedAt` update. Accepted as by-design (matches
GitHub/Stripe-style bearer tokens): a token revoked mid-request still
completes that one in-flight request; the one-time plaintext reveal lives in
browser state until the Connect screen is left.
