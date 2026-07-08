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
        </div>
      </div>

      <section className="px-5 pb-7 pt-9">
        <div className="mx-auto max-w-md">
          <h1 className="text-[36px] font-semibold leading-[1.05] tracking-tight">
            Never wonder
            <br />
            <span className="text-brand dark:text-brand-soft">what&apos;s for dinner</span>
            <br />
            again.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink/75 dark:text-white/75">
            {brand.name} plans your week, checks it with you, and writes out the cook&apos;s
            instructions and the shopping list — in plain chat. You approve everything before
            it goes anywhere.
          </p>
          <Link
            href="/chat"
            className="mt-7 block w-full rounded-2xl bg-brand py-4 text-center text-[17px] font-semibold text-white shadow-sm transition active:bg-brand-deep active:scale-[0.99]"
          >
            Try it now →
          </Link>
          <p className="mt-3 text-center text-[13px] text-ink/50 dark:text-white/45">
            Free to try. Takes under a minute to set up.
          </p>
        </div>
      </section>

      <section className="px-5">
        <div className="mx-auto max-w-md space-y-2.5">
          <Card heading="Tell it about your household" body="Diets, allergies, favourite cuisines, budget, who's cooking and how often. Say it in plain words — no forms." />
          <Card heading="A weekly plan you approve" body="It drafts the week's meals around what you told it. You review, tweak any day, then approve — nothing happens before that." />
          <Card heading="Ready to forward on WhatsApp" body="Once approved, it writes the cook's message in their language and a shopping list grouped for Blinkit / Zepto / Instamart. Copy, paste, send — from your own WhatsApp." />
          <Card heading="Gets better each week" body="Tell it what was cooked, skipped, or had leftovers. Next week's plan quietly adjusts." />
        </div>
      </section>

      <section className="mt-12 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]">
        <p className="mx-auto max-w-md text-center text-[11.5px] text-ink/35 dark:text-white/30">
          Open source, MIT licensed.
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
