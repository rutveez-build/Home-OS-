# Family OS

> Open-source scaffold to launch your own family-OS startup.
> WhatsApp-ready, family-member-aware, persistent memory. **Bring your own keys.**

A chat-first operating system for the household — clone, drop in your keys for WhatsApp / LLM / voice / vision, rebrand, and ship. Built so you can stand up a "house manager" product for your city in a weekend, not a year.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAbhiK24%2Ffamily-os&project-name=family-os&repository-name=family-os&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D&env=LLM_API_KEY%2CLLM_BASE_URL%2CLLM_MODEL%2CBRAND_NAME%2CBRAND_TAGLINE&envDescription=See%20.env.example%20for%20the%20full%20list&envLink=https%3A%2F%2Fgithub.com%2FAbhiK24%2Ffamily-os%2Fblob%2Fmain%2Fapps%2Fweb%2F.env.example)

The Vercel button provisions a Postgres database, prompts you for the minimum keys (LLM key + base URL + model + brand text), and runs migrations on first build. You're live in ~3 minutes.

Prefer the local-dev path:

```
git clone https://github.com/AbhiK24/family-os
cd family-os
cp apps/web/.env.example apps/web/.env.local   # add your keys
pnpm install
pnpm db:migrate
pnpm dev   # http://localhost:3000
```

---

## What you get out of the box

| Capability | Status | What's inside |
|---|---|---|
| **Chat (web)** | ✅ Working | Streaming Next.js app, mobile-first, onboarding, dark mode |
| **Persistent memory** | ✅ Working | Postgres + Drizzle. Auto-extracts 0–3 durable facts per exchange |
| **WhatsApp chat** | 🟡 Scaffolded | Webhook + send for Meta Cloud API **and** Twilio. Slot in your keys |
| **Family members** | 🟡 Scaffolded | Create families, invite via WhatsApp, roles. Slash-commands wired |
| **Voice notes** | 🟡 Scaffolded | ASR abstraction with Sarvam (Indic) + OpenAI Whisper drivers |
| **Image input** | 🟡 Scaffolded | Vision abstraction (lab reports, prescriptions, photos) |
| **LLM** | ✅ Working | Any OpenAI-compatible: Moonshot/Kimi, OpenAI, Mistral, Together, Groq |

🟡 means the code is in the repo and the data flow works — but the feature lights up when you add the corresponding key in `.env.local`.

---

## Architecture in 30 seconds

```
   Mobile web                       WhatsApp
      │                                │
      └──► /api/chat        /api/whatsapp/webhook ◄──┐
                │                       │            │
                └──────► lib/chat-core.ts ◄──────────┘
                                │
                  ┌─────────────┼─────────────────┐
                  ▼             ▼                 ▼
              LLM provider   Postgres        Memory extractor
              (Kimi/OpenAI)  (Drizzle)       (LLM, JSON-out)
```

One brain (`lib/chat-core.ts`), two transports (web + WhatsApp), one Postgres of users / sessions / messages / memories / families. Everything else is a swappable provider.

---

## Bring your own keys

Open [`apps/web/.env.example`](apps/web/.env.example) — every key has a one-line explanation. Leave anything blank and that capability degrades gracefully (you'll see a clear log line).

**Minimum to run the demo:**
- `DATABASE_URL` — any Postgres (Neon, Supabase, Railway, local docker)
- `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` — any OpenAI-compatible API

**Add WhatsApp** (recommended for India: Meta Cloud, direct):
- `WHATSAPP_PROVIDER=meta_cloud`
- `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`
- Point your Meta webhook at `/api/whatsapp/webhook`

**Prefer Twilio?**
- `WHATSAPP_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`

**Voice notes:**
- `ASR_PROVIDER=sarvam` (Indic) or `whisper` (English-strong)
- `SARVAM_API_KEY` or `OPENAI_API_KEY`

**Images (lab reports, prescriptions):**
- `VISION_PROVIDER=kimi` or `openai`

---

## Rebrand without touching components

```env
BRAND_NAME="Hugli OS"
BRAND_TAGLINE="Your family, on one chat."
BRAND_CITY="Pune"
BRAND_LANGUAGES="English, मराठी, हिन्दी"
```

CSS brand colour lives in `apps/web/app/globals.css` as RGB triplets — change three lines and the whole UI re-tones.

Override the assistant's voice with a single env var:
```env
SYSTEM_PROMPT_OVERRIDE="You are the Hugli OS assistant — a warm friend for Marathi-speaking families in Pune…"
```

---

## Family members + WhatsApp slash commands

A user can be part of one or more families. The owner invites others by phone — they get a WhatsApp message, reply `YES`, and they're in. Each member has their own private chat, but the assistant knows they're related.

In any WhatsApp chat:
```
/family                          → show your family
/family create The Sharmas       → start a new family (you're the owner)
/family invite Asha +91987… as parent
/family list                     → list everyone you're connected to
YES                              → accept a pending invitation
```

The schema (`apps/web/db/schema.ts`) supports roles: `owner`, `parent`, `partner`, `child`, `elder`, `helper`, `member`. Extend at will.

---

## Deploy

The repo includes `railway.json` for one-click Railway deploys. Otherwise it's a stock Next.js app — Vercel, Fly, Render, your VPS, anywhere.

```bash
# Railway:
railway init -n your-product
railway add --database postgres
railway up
```

---

## Project layout

```
family-os/
├── apps/web/                     Next.js 15 app
│   ├── app/
│   │   ├── page.tsx              Landing
│   │   ├── chat/page.tsx         Chat UI
│   │   └── api/
│   │       ├── chat/             Web chat (streaming)
│   │       └── whatsapp/         Inbound webhook
│   ├── components/               Chat, Onboarding, Logo
│   ├── lib/
│   │   ├── chat-core.ts          One brain, both transports
│   │   ├── system-prompt.ts      Configurable via env
│   │   ├── extract-memories.ts   Background memory writer
│   │   ├── family-commands.ts    /family slash commands
│   │   ├── brand.ts              Rebrand without code
│   │   ├── llm/                  OpenAI-compatible client
│   │   ├── whatsapp/             meta-cloud + twilio
│   │   ├── asr/                  sarvam + whisper
│   │   └── vision/               kimi + openai
│   └── db/                       Drizzle schema, repo, migrations
├── pnpm-workspace.yaml
├── package.json
├── railway.json
└── LICENSE                       MIT
```

---

## What this is *not*

- **Not a SaaS.** It's a scaffold — fork it, run it, charge for it. Or don't.
- **Not a finished app.** The voice / image / family-invite paths are wired but light on polish. You'll harden them for your market.
- **Not opinionated about your category.** Use it for elder-care, fertility, household admin, post-natal, queer-friendly mental health — anything where a family-aware assistant matters.

---

## What to build next (good first PRs)

- [ ] Add a `Family` tab in the web UI (invite via QR / link, not just WhatsApp)
- [ ] Vector-based memory retrieval (pgvector + embeddings)
- [ ] Message templates for Meta (welcome, daily check-in, appointment reminder)
- [ ] Inngest/Trigger.dev queue for inbound message processing
- [ ] Phone-OTP login for the web app (currently anonymous device-id)
- [ ] More LLM providers (Anthropic, Bedrock, local llama.cpp)
- [ ] Multi-language welcome screens

---

## Credits & license

MIT. Use it, fork it, sell it, change the name. No attribution required, but a star ⭐ is appreciated.

Born out of a Bangalore weekend, vibes-driven.
