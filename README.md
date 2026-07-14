<div align="center">

# 🏡 Home OS

**The open-source household concierge.**
Meal planning · cook coordination · shopping lists · pantry inventory · recipes · purchase memory — in one chat-style app your whole family (and your AI assistants) can use.

*WhatsApp-ready · family-member-aware · approval-first · persistent memory · **bring your own keys***

[**Live demo**](https://home-os-sunflower-test.vercel.app) · [MCP setup](docs/mcp-setup.md) · [Assistant tool contract](docs/assistant-tools.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frutveez-build%2FHome-OS-&project-name=family-os&repository-name=family-os&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D&env=LLM_API_KEY%2CLLM_BASE_URL%2CLLM_MODEL%2CSESSION_SECRET%2CBRAND_NAME%2CBRAND_TAGLINE&envDescription=See%20.env.example%20for%20the%20full%20list&envLink=https%3A%2F%2Fgithub.com%2Frutveez-build%2FHome-OS-%2Fblob%2Fmain%2Fapps%2Fweb%2F.env.example)

</div>

---

## Why this exists

Every household runs on the same loop — *what are we eating, who's cooking it, what do we need to buy, what's going bad in the fridge* — and it usually runs on someone's mental load. Home OS turns that loop into software: an AI plans, **a human approves**, and only then does anything reach the cook or the shopping list.

Clone it, drop in your keys (LLM / WhatsApp / voice / vision), rebrand it, and ship a "house manager" product for your city in a weekend, not a year.

## The interface: Kitchen Stream

The whole app reads like a messaging thread — because that's the mental model every family already has. Designed in Google Stitch, built 1:1:

- **Chat-stream UI** — bubbles, chips, banner cards, a fixed bottom nav (Home · Inventory · Plan · Purchases · Feedback)
- **Two hand-designed themes** — deep-emerald light and obsidian dark, with an in-app toggle (defaults to your OS setting)
- **Conversational onboarding** — setup is a chat with the assistant, not a form
- **Approval as the loudest moment on screen** — nothing ships to your cook or your list without a human yes
- Brand-owned generated artwork throughout — no stock photos

## What you get out of the box

| Capability | Status | What's inside |
|---|---|---|
| **Kitchen loop** | ✅ | Weekly plan → your approval → cook message (in the cook's language) → shopping list |
| **Kitchen inventory** | ✅ | Pantry/fridge tracking, expiry alerts on the home feed, add/update by chat or UI |
| **Recipe guide** | ✅ | Household recipe book with **three importers**: YouTube link (captions → recipe), pasted note (Google Keep / Notes / WhatsApp), PDF upload |
| **Purchase memory** | ✅ | Photograph a receipt → editable extraction → "did we already buy sugar?", duplicate flags, household deal list |
| **Feedback loop** | ✅ | Rate meals in two taps — verdicts feed next week's plan |
| **Family & roles** | ✅ | Invite by WhatsApp from the Hub; roles from `owner` to `helper` gate who can approve and connect |
| **MCP for AI assistants** | ✅ | 18 tools — connect ChatGPT, Claude, or Codex to your household via OAuth or token |
| **Chat (web)** | ✅ | Streaming assistant with slash commands, persistent memory (0–3 durable facts per exchange) |
| **WhatsApp chat** | 🟡 | Webhook + send for Meta Cloud API **and** Twilio — slot in your keys |
| **Voice notes** | 🟡 | ASR abstraction: Sarvam (Indic) + OpenAI Whisper |
| **LLM** | ✅ | Any OpenAI-compatible API: Moonshot/Kimi, OpenAI, Mistral, Together, Groq |

🟡 = the code and data flow are in the repo; the feature lights up when you add the corresponding key.

## Quickstart

```bash
git clone https://github.com/rutveez-build/Home-OS-
cd Home-OS-
cp apps/web/.env.example apps/web/.env.local   # add your keys
pnpm install
pnpm db:migrate
pnpm dev                                        # http://localhost:3000
```

Or click the Vercel button above — it provisions Postgres, prompts for the minimum keys, runs migrations on first build, and you're live in ~3 minutes.

**Minimum keys:** `DATABASE_URL` (any Postgres), `SESSION_SECRET` (`openssl rand -hex 32`), and `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL`. Everything else degrades gracefully with a clear log line — see [`apps/web/.env.example`](apps/web/.env.example), every key has a one-line explanation.

## Architecture in 30 seconds

```
   Mobile web            WhatsApp             ChatGPT / Claude / Codex
      │                     │                          │
      ▼                     ▼                          ▼
  /api/chat      /api/whatsapp/webhook          /api/mcp (OAuth 2.1 / token)
      │                     │                          │
      └────────► lib/chat-core.ts ◄────────────────────┘
                        │
        ┌───────────────┼──────────────────┐
        ▼               ▼                  ▼
   LLM provider     Postgres          Memory extractor
   (any OpenAI-     (Drizzle:         (LLM, JSON-out)
    compatible)      plans, pantry,
                     recipes, receipts,
                     families, audit)
```

One brain, three transports, one Postgres. Every approval, send, and export lands in an append-only `audit_log`. The assistant never orders groceries, never messages staff unprompted, never acts without a human yes.

## The kitchen loop

From the app, from WhatsApp, or from your AI assistant over MCP:

```
/setup                          → checklist: what's configured, what's next
/family create The Sharmas      → your household
/household diets vegetarian     → hard constraints the planner obeys
/household allergies peanuts    →   (allergies are never violated)
/cook set Sunita +91... hi      → cook's name, WhatsApp, language, frequency
/plan week                      → AI drafts the week — as a DRAFT
/plan change TUE dinner Dosa    → edit any slot
/plan approve                   → nothing happens without this
/plan cook send                 → cook's message, their language — after you say so
/plan shopping                  → grocery list grouped for Blinkit/Zepto/Instamart
```

## Connect your AI assistant (MCP)

Mint a per-household token from **Home → Hub → Connect**, or let ChatGPT/Claude connect via OAuth 2.1 (auth-code + PKCE, dynamic client registration). Your assistant gets all **18 tools** — household state, planning, approval, cook messaging, shopping, feedback, purchases, deals, inventory, recipes — permission-gated by your family role, centrally enforced. Details: [`docs/mcp-setup.md`](docs/mcp-setup.md) · [`docs/assistant-tools.md`](docs/assistant-tools.md).

## Recipes: three ways in

1. **YouTube** — paste a video link; the captions are read and distilled into ingredients + numbered steps
2. **Any note** — share from Google Keep / Apple Notes / WhatsApp → copy → paste
3. **PDF** — upload up to 4MB; text is extracted and structured

All land as searchable household recipes, linked from every meal on the plan (📖), and available to your AI assistants.

## Rebrand without touching components

```env
BRAND_NAME="Hugli OS"
BRAND_TAGLINE="Your family, on one chat."
BRAND_CITY="Pune"
BRAND_LANGUAGES="English, मराठी, हिन्दी"
SYSTEM_PROMPT_OVERRIDE="You are the Hugli OS assistant — a warm friend for families in Pune…"
```

The entire palette lives as CSS variables in [`apps/web/app/globals.css`](apps/web/app/globals.css) (`--ks-*`, light and dark blocks) — change a handful of RGB triplets and every screen re-tones. Artwork sits in `apps/web/public/art/` — swap the six images for your own brand's.

## Project layout

```
family-os/
├── apps/web/                       Next.js 15 app
│   ├── app/
│   │   ├── page.tsx                Landing
│   │   ├── chat/page.tsx           The app (auth → onboarding → Kitchen Stream)
│   │   └── api/
│   │       ├── app/                REST for every screen (plan, shopping, feedback,
│   │       │                       purchases, inventory, recipes + importers, family)
│   │       ├── chat/               Web chat (streaming)
│   │       ├── mcp/  oauth/        MCP server + OAuth 2.1 for AI assistants
│   │       └── whatsapp/           Inbound webhook
│   ├── components/
│   │   ├── stream/                 Kitchen Stream UI: kit.tsx (primitives),
│   │   │                           one file per screen, Wizard, types
│   │   ├── Onboarding.tsx          Account screen
│   │   └── HouseholdApp.tsx        Shell: state, routing, chrome
│   ├── lib/
│   │   ├── chat-core.ts            One brain, all transports
│   │   ├── kitchen/                Planner, cook message, shopping, feedback
│   │   ├── inventory.ts            Pantry (shared by REST + MCP)
│   │   ├── recipes.ts              Recipe book (shared by REST + MCP)
│   │   ├── recipes-import.ts       YouTube captions + LLM extraction
│   │   ├── purchases/              Receipts, memory, search, deals
│   │   ├── mcp/                    18 tools + handlers + auth context
│   │   ├── oauth/                  Client registry, auth codes
│   │   ├── llm/  whatsapp/  asr/  vision/    Swappable providers
│   │   └── permissions.ts          Role → action gates
│   └── db/                         Drizzle schema, repos, migrations
└── LICENSE                         MIT
```

## What this is *not*

- **Not a SaaS.** It's a scaffold — fork it, run it, charge for it. Or don't.
- **Not a finished app.** Voice and image paths are wired but light on polish. Harden them for your market.
- **Not opinionated about your category.** Elder-care, fertility, post-natal, household admin — anywhere a family-aware assistant matters.

## What to build next (good first PRs)

- [ ] Family invites via QR / link (the Hub invites by phone/WhatsApp today)
- [ ] Vector-based memory retrieval (pgvector + embeddings)
- [ ] WhatsApp receipt capture (inbound image → the existing extraction pipeline)
- [ ] OCR for scanned/photo PDFs in the recipe importer (text PDFs only today)
- [ ] Real deal-lookup provider behind `lib/purchases/deals.ts`
- [ ] Phone-OTP login · message templates for Meta · Inngest/Trigger.dev inbound queue
- [ ] More LLM providers (Anthropic, Bedrock, local llama.cpp)

## Credits & license

MIT. Use it, fork it, sell it, change the name. No attribution required, but a star ⭐ is appreciated.

Born out of a Bangalore weekend, vibes-driven. Redesigned with Google Stitch; artwork generated with Higgsfield.
