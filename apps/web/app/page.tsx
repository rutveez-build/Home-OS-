import Link from "next/link";
import { Logo } from "@/components/Logo";
import { brand } from "@/lib/brand";

export default function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-ink dark:bg-bg-dark dark:text-white">
      <div className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white">
            <Logo size={17} />
          </span>
          <span className="text-[14px] font-semibold tracking-tight">{brand.name}</span>
          <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-brand dark:bg-white/10 dark:text-white/80">
            Open source · MIT
          </span>
        </div>
      </div>

      <section className="px-5 pb-7 pt-9">
        <div className="mx-auto max-w-md">
          <h1 className="text-[36px] font-semibold leading-[1.05] tracking-tight">
            Launch a
            <br />
            <span className="text-brand dark:text-brand-soft">family-OS</span>
            <br />
            startup in a weekend.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink/75 dark:text-white/75">
            Open-source scaffold. Bring your own keys. WhatsApp-ready, family-member-aware, persistent memory, runs on any OpenAI-compatible LLM.
          </p>
          <Link
            href="/chat"
            className="mt-7 block w-full rounded-2xl bg-brand py-4 text-center text-[17px] font-semibold text-white shadow-sm transition active:bg-brand-deep active:scale-[0.99]"
          >
            Try the demo →
          </Link>
          <a
            href="https://github.com/AbhiK24/family-os"
            className="mt-3 block w-full rounded-2xl border border-line py-4 text-center text-[15px] font-medium text-ink/75 dark:border-line-dark dark:text-white/75"
          >
            View on GitHub →
          </a>
        </div>
      </section>

      <section className="px-5">
        <div className="mx-auto max-w-md space-y-2.5">
          <Card heading="Bring your own keys" body="The scaffold ships with placeholders for everything. Drop in your Meta / Twilio / Sarvam / OpenAI / Moonshot keys and the corresponding feature comes alive. No vendor lock-in." />
          <Card heading="WhatsApp ready" body="One inbound webhook, two providers (Meta Cloud + Twilio), voice-note transcription, family slash-commands. Replace the brand and ship in your city." />
          <Card heading="Family members" body="A user can be in one or more families, with roles (owner, parent, partner, child, elder, helper). Invitations land on WhatsApp; reply YES to join. Each member's chat stays private." />
          <Card heading="Memory that grows" body="Postgres + Drizzle. Every exchange extracts 0–3 durable facts and writes them back. Next time they message, the assistant knows them. Embeddings come later — recency works first." />
        </div>
      </section>

      <section className="mt-10 px-5">
        <div className="mx-auto max-w-md">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink/55 dark:text-white/55">
            Get started
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-surface p-4 text-[12.5px] leading-relaxed text-ink/80 shadow-bubble dark:bg-surface-dark dark:text-white/80">
{`git clone https://github.com/AbhiK24/family-os
cd family-os
cp apps/web/.env.example apps/web/.env.local
# fill in your keys
pnpm install
pnpm db:migrate
pnpm dev`}
          </pre>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/60 dark:text-white/60">
            Default port: 3000. Database: any Postgres (Neon / Supabase / Railway / local docker). LLM: any OpenAI-compatible endpoint.
          </p>
        </div>
      </section>

      <section className="mt-12 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]">
        <p className="mx-auto max-w-md text-center text-[11.5px] text-ink/35 dark:text-white/30">
          MIT licensed. Build something kind.
        </p>
      </section>
    </div>
  );
}

function Card({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <h2 className="text-[14px] font-semibold tracking-tight">{heading}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink/75 dark:text-white/75">{body}</p>
    </div>
  );
}
