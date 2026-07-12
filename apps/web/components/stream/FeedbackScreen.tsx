"use client";

// Feedback + history, Kitchen Stream style — per the "Product & Meal
// Feedback" and "Meal Feedback & History" mocks: a banner form card with
// chip answers, then history as resting cards. Same API wiring as before.

import { useEffect, useState } from "react";
import { Card, CardBanner, Chip, EmptyState, PrimaryButton, SectionLabel, Spinner } from "./kit";
import { MEAL_LABEL, type Feedback } from "./types";

const VERDICTS = [
  { v: "liked", label: "😋 Liked it" },
  { v: "ok", label: "🙂 It was OK" },
  { v: "disliked", label: "😕 Not a hit" },
] as const;
const LEFTOVER_OPTS = [
  { v: "none", label: "None left" },
  { v: "some", label: "Some left" },
  { v: "lots", label: "Lots left" },
] as const;

function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mt-3 block text-[13px] font-semibold first:mt-0">{children}</label>;
}

export function FeedbackScreen({ flash }: { flash: (m: string) => void }) {
  const [history, setHistory] = useState<Feedback[] | null>(null);
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner">("dinner");
  const [cooked, setCooked] = useState<"cooked" | "skipped">("cooked");
  const [verdict, setVerdict] = useState<"liked" | "ok" | "disliked" | undefined>(undefined);
  const [leftovers, setLeftovers] = useState<"none" | "some" | "lots" | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/app/feedback");
    const data = await res.json().catch(() => ({}));
    setHistory(data.feedback ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/app/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meal,
        cooked,
        verdict: cooked === "cooked" ? verdict : undefined,
        leftovers: cooked === "cooked" ? leftovers : undefined,
        note: note.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      flash(data.reply ?? "Noted ✓");
      setVerdict(undefined);
      setLeftovers(undefined);
      setNote("");
      load();
    } else flash(data.error ?? "Couldn't save that");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <section className="px-1">
        <h2 className="text-xl font-semibold">What&apos;s working, what&apos;s not</h2>
        <p className="text-sm text-stream-mute">A quick note after any meal teaches next week&apos;s plan.</p>
      </section>

      <Card className="overflow-hidden">
        <CardBanner icon="star" label="Rate a meal" />
        <div className="p-4">
          <FieldLabel>Which meal?</FieldLabel>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["breakfast", "lunch", "dinner"] as const).map((m) => (
              <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
                {MEAL_LABEL[m]}
              </Chip>
            ))}
          </div>

          <FieldLabel>Did it happen?</FieldLabel>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Chip active={cooked === "cooked"} onClick={() => setCooked("cooked")}>Cooked</Chip>
            <Chip active={cooked === "skipped"} onClick={() => setCooked("skipped")}>Skipped</Chip>
          </div>

          {cooked === "cooked" && (
            <>
              <FieldLabel>How was it?</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {VERDICTS.map((o) => (
                  <Chip key={o.v} active={verdict === o.v} onClick={() => setVerdict(o.v)}>
                    {o.label}
                  </Chip>
                ))}
              </div>

              <FieldLabel>Leftovers?</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {LEFTOVER_OPTS.map((o) => (
                  <Chip key={o.v} active={leftovers === o.v} onClick={() => setLeftovers(o.v)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </>
          )}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else? (optional)"
            className="mt-4 block w-full rounded-xl border border-stream-line bg-stream-bg px-4 py-2.5 text-[14px] text-stream-ink outline-none placeholder:text-stream-mute focus:border-stream-primary"
          />
          <PrimaryButton className="mt-3 w-full" icon="send" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Share feedback"}
          </PrimaryButton>
        </div>
      </Card>

      <SectionLabel>Recent feedback</SectionLabel>
      {history === null ? (
        <Spinner />
      ) : history.length === 0 ? (
        <EmptyState
          icon="rate_review"
          title="Nothing shared yet"
          body="The first note above will show up here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((f) => (
            <Card key={f.id} className="p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold">{f.dish}</span>
                <span className="shrink-0 text-[11px] text-stream-mute">{relativeDay(f.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-stream-mute">
                {MEAL_LABEL[f.meal]} ·{" "}
                {f.cooked === "skipped" ? "skipped" : VERDICTS.find((v) => v.v === f.verdict)?.label ?? "cooked"}
                {f.leftovers && f.leftovers !== "none"
                  ? ` · ${LEFTOVER_OPTS.find((l) => l.v === f.leftovers)?.label.toLowerCase()}`
                  : ""}
              </p>
              {f.note && <p className="mt-1 text-[13px] italic">&ldquo;{f.note}&rdquo;</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
