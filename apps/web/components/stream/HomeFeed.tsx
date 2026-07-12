"use client";

// Home, Kitchen Stream style — mirrors the "Home: Flexible Management" mock:
// greeting, a prominent meal-plan status card with a banner strip, a feedback
// prompt card, quick-entry grid (chat + status), and management rows.

import { Card, CardBanner, Icon, PrimaryButton, SecondaryButton, SectionLabel } from "./kit";
import type { Plan } from "./types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeFeed({
  userName,
  familyName,
  plan,
  busy,
  canManage,
  onAsk,
  onOpenPlan,
  onOpenChat,
  onOpenConnect,
  onOpenFeedback,
}: {
  userName: string;
  familyName: string;
  plan: Plan;
  busy: boolean;
  canManage: boolean;
  onAsk: () => void;
  onOpenPlan: () => void;
  onOpenChat: () => void;
  onOpenConnect: () => void;
  onOpenFeedback: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <section className="px-1">
        <h2 className="text-xl font-semibold">{greeting()}, {userName}!</h2>
        <p className="text-sm text-stream-mute">{familyName}</p>
      </section>

      {/* Weekly plan status — the screen's centerpiece */}
      <Card className="overflow-hidden border-t-4 border-t-stream-primary">
        <CardBanner icon="calendar_today" label="Weekly Meal Plan" />
        <div className="flex flex-col gap-4 p-5">
          {plan?.status === "approved" ? (
            <>
              <div>
                <h3 className="text-xl font-semibold">This week&apos;s plan is approved ✓</h3>
                <p className="mt-1 text-sm leading-relaxed text-stream-mute">
                  Week of {plan.weekStart}. The cook message and shopping list are unlocked.
                </p>
              </div>
              <PrimaryButton icon="restaurant_menu" onClick={onOpenPlan}>
                View plan
              </PrimaryButton>
            </>
          ) : plan?.status === "draft" ? (
            <>
              <div>
                <h3 className="text-xl font-semibold">A draft is waiting for you.</h3>
                <p className="mt-1 text-sm leading-relaxed text-stream-mute">
                  Review the week, change any meal, and approve when it looks right.
                </p>
              </div>
              <PrimaryButton icon="fact_check" onClick={onOpenPlan}>
                Review &amp; approve
              </PrimaryButton>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-xl font-semibold">No plan yet for this week.</h3>
                <p className="mt-1 text-sm leading-relaxed text-stream-mute">
                  Your kitchen is quiet. I&apos;ll draft the week from your household profile —
                  diets, allergies, and everything else you told me.
                </p>
              </div>
              <PrimaryButton icon="restaurant_menu" onClick={onAsk} disabled={busy}>
                {busy ? "Drafting your plan…" : "Plan your week"}
              </PrimaryButton>
            </>
          )}
        </div>
      </Card>

      {/* Feedback prompt */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stream-accent/10 text-stream-primary">
            <Icon name="star" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold">How was your last meal?</h4>
            <p className="text-[13px] text-stream-mute">
              Rating meals teaches me what to plan more (and less) of.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <SecondaryButton className="flex-1 !py-2" onClick={onOpenFeedback}>
            Share feedback
          </SecondaryButton>
        </div>
      </Card>

      {/* Quick entry */}
      <Card onClick={onOpenChat} className="group flex flex-col gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stream-primary/10 text-stream-primary">
          <Icon name="chat" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">Ask me anything else</h4>
          <p className="text-[13px] text-stream-mute">
            Pantry questions, dietary notes, meal history — or just talk it through.
          </p>
        </div>
        <Icon
          name="arrow_forward"
          className="self-end text-sm text-stream-mute transition-transform group-hover:translate-x-1"
        />
      </Card>

      {canManage && (
        <section className="mt-2 border-t border-stream-line pt-5">
          <SectionLabel>Advanced connectivity</SectionLabel>
          <button
            onClick={onOpenConnect}
            className="mt-3 flex items-center gap-2 rounded-full border border-stream-line bg-stream-surface px-4 py-2 text-[13px] font-medium shadow-card transition-colors hover:bg-stream-primary/5"
          >
            <Icon name="hub" className="text-sm text-stream-primary" />
            Connect ChatGPT, Claude, or Codex
          </button>
        </section>
      )}
    </div>
  );
}
