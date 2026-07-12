"use client";

// Daily cook handoff, Kitchen Stream style — per the "Handoff: Cook Message"
// mock, the drafted menu reads as a real chat message. Three unmistakable
// states: drafting (spinner), draft ready (outgoing bubble + approve bar),
// sent (bubble with read ticks + confirmation note).

import { useEffect, useState } from "react";
import { Bubble, Card, CardBanner, PrimaryButton, SecondaryButton, Spinner, SystemNote } from "./kit";
import type { Cook } from "./types";

export function HandoffScreen({
  cook,
  busy,
  flash,
  onBack,
  onNext,
}: {
  cook: Cook;
  busy: boolean;
  flash: (m: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [draft, setDraft] = useState<{ text: string; cookName: string; cookPhone: string | null } | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/cook-message")
      .then((r) => r.json())
      .then((d) => {
        if (d.draft) setDraft(d.draft);
        else flash(d.error ?? "Couldn't draft the message");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const res = await fetch("/api/app/cook-message", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sent) {
      setSent(true);
      flash(`Sent to ${data.cookName} ✓`);
    } else flash(data.error ?? "Couldn't send — copy the message instead");
  }

  function copy() {
    if (draft) navigator.clipboard?.writeText(draft.text).catch(() => {});
    flash("Copied — paste it into WhatsApp");
  }

  return (
    <div className="min-h-full art-chat bg-stream-chat">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-5">
        <SystemNote>Daily handoff · {cook?.name ?? "your cook"}</SystemNote>

        {loading ? (
          <Spinner label="Drafting the cook message…" />
        ) : draft ? (
          <>
            <Bubble direction="in" time="Just now">
              Here&apos;s tomorrow&apos;s menu for {draft.cookName}, in their language. Review it —
              nothing is sent until you approve.
            </Bubble>
            <Bubble direction="out" time={sent ? "Delivered" : "Draft"} ticks={sent ? "read" : undefined}>
              {draft.text}
            </Bubble>

            {sent ? (
              <SystemNote>Sent on WhatsApp · logged to the audit trail</SystemNote>
            ) : (
              <Card className="mt-2 overflow-hidden">
                <CardBanner icon="outgoing_mail" label="Ready to hand off" />
                <div className="flex flex-col gap-2 p-4">
                  {draft.cookPhone ? (
                    <PrimaryButton icon="send" onClick={send} disabled={busy}>
                      Approve &amp; send to cook
                    </PrimaryButton>
                  ) : (
                    <p className="text-[13px] text-stream-mute">
                      No WhatsApp number saved for {draft.cookName} — copy the message and send it
                      yourself.
                    </p>
                  )}
                  <SecondaryButton icon="content_copy" onClick={copy}>
                    Copy message
                  </SecondaryButton>
                </div>
              </Card>
            )}
            {sent && (
              <SecondaryButton icon="content_copy" className="mt-2" onClick={copy}>
                Copy message
              </SecondaryButton>
            )}
          </>
        ) : (
          <Bubble direction="in">
            No draft available yet — approve a weekly plan first, then I&apos;ll write the daily
            handoff from it.
          </Bubble>
        )}

        <div className="mt-4 flex gap-2">
          <SecondaryButton icon="arrow_back" className="flex-1" onClick={onBack}>
            Plan
          </SecondaryButton>
          <SecondaryButton icon="shopping_basket" className="flex-1" onClick={onNext}>
            Shopping list
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
