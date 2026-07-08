# Family OS — Privacy Notice & Processor Register

Plain-English notice for households, and the operator's DPDP checklist.
Self-hosters and forkers: **you are the Data Fiduciary** for the households
you serve under India's Digital Personal Data Protection Act, 2023. This
repo ships the primitives; the legal posture is yours.

## What Family OS stores

| Data | Where | Why |
|---|---|---|
| Household profile (diets, allergies, dislikes, cuisines, budget, meal scope) | `household_profiles` | So plans are safe and personal. Allergies are treated as health-adjacent data |
| Family members and roles | `users`, `family_members` | Who's in the household and who may approve things |
| Cook/helper name, phone, language, schedule | `staff` | Drafting and sending the daily cook message |
| Meal plans and shopping lists | `meal_plans`, `shopping_lists` | The product |
| Chats | `messages` | Context for the assistant. **Purged after `RETENTION_DAYS` (default 90)** |
| Extracted memories (0–3 facts/exchange) | `memories` | Long-term personalization; user-scoped |
| Audit log | `audit_log` | Append-only record of every approval, send, and export |
| Consents | `consents` | Provable notice + consent per member per category |

## What Family OS never does

- Places orders or payments anywhere.
- Messages staff or anyone outside the household without explicit approval.
- Stores quick-commerce credentials.
- Shares one member's private chat with another member.

## Member rights (built in, not tickets)

- `/privacy` — this notice, live consent status
- `/privacy withdraw <category>` — turns the feature off for that member
- `/export` — full household JSON (owner/parent/partner)
- `/delete` → `/delete confirm` — permanent household deletion (owner), tombstoned in the audit log

## Consent categories

`household_data`, `health_data` (allergies), `staff_messaging`, `child_data`.
Recorded contextually on first use, versioned against this notice (v1),
withdrawal timestamped, never deleted.

## Processor register (self-host default)

| Processor | Data it sees | Configured by |
|---|---|---|
| LLM provider (`LLM_BASE_URL`) | chat text, profile constraints for planning | operator |
| WhatsApp provider (Meta Cloud / Twilio) | staff + family message content, phone numbers | operator |
| Postgres host | everything stored | operator |
| Hosting (Vercel/Railway/VPS) | runtime traffic | operator |
| ASR provider (optional) | voice notes | operator |

Operators must keep this table current for their deployment.

## Operator checklist before real households

- [ ] `SESSION_SECRET` set; `ALLOW_UNSIGNED_WEBHOOKS` unset
- [ ] `CRON_SECRET` + retention cron live (vercel.json ships a 03:00 daily purge)
- [ ] Processor register above updated for your actual vendors
- [ ] Privacy notice reachable by your users (link this file or your own)
- [ ] Child members flagged with the `child` role (read-only by design)
