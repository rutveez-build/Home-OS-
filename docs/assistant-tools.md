# Family OS — Assistant Tool Contract (Segment 1)

The contract an external assistant surface (ChatGPT app, Claude skill, hosted
chatbot wrapper) uses to drive Family OS without knowing repo internals.
Phase 2 defines the contract; an HTTP surface for it lands when the first
integration is built. Internally each tool maps 1:1 onto an existing
slash-command flow, so behaviour is identical across web, WhatsApp, and
assistant surfaces — including the approval gates.

## Principles

- **Approval-first.** No tool sends messages to staff, exports lists, or
  writes outside Family OS. Mutating tools return a draft plus an approval
  handle; a human resolves it.
- **Household-scoped.** Every call carries a household token; tools never
  cross households.
- **Audited.** Every mutating call lands in `audit_log` with actor, action,
  channel = `assistant`.

## Tools

| Tool | Maps to | Returns |
|---|---|---|
| `get_setup_status()` | `/setup` | checklist of configured/missing steps |
| `get_household_profile()` | `/household show` | diets, allergies, dislikes, cuisines, budget, meal scope |
| `update_household_profile(patch)` | `/household <field> …` | updated profile |
| `set_cook(name, phone?, language?, frequency?)` | `/cook set` | cook record |
| `create_meal_plan()` | `/plan week` | draft plan + `approval_id` |
| `get_meal_plan()` | `/plan show` | latest plan + status |
| `change_plan_entry(day, meal, dish)` | `/plan change` | updated entry |
| `approve_meal_plan()` | `/plan approve` | approved plan (human-confirmed surfaces only) |
| `draft_cook_message()` | `/plan cook` | draft text + `approval_id` |
| `send_cook_message()` | `/plan cook send` | send receipt (requires prior draft approval) |
| `build_shopping_list()` | `/plan shopping` | categorized list, copy-ready text |

## Approval semantics for assistant surfaces

`approve_meal_plan` and `send_cook_message` MUST only be called after the
assistant has shown the draft to the human and received an explicit yes in
the same conversation. Assistants must not auto-approve. Surfaces that cannot
guarantee a human in the loop get read-only tools plus `create_meal_plan`.

## Auth (planned)

Per-household API token minted from the web app (Phase 4 admin screen),
scoped to one household, revocable, logged. Until then, Segment 1 runs
through the WhatsApp/web chat directly.
