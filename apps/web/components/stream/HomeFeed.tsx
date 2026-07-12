"use client";

// Home — built 1:1 against the "Home: Flexible Management" mock: greeting,
// border-top plan status card with primary + secondary actions, feedback
// prompt with Not-now/Share buttons, the ask-anything + pantry-status grid,
// the Home Management "Update Home Setup" row, the connectivity pill, and
// the ambient state panel. Only the mock's stock photos are replaced with
// icon tiles (those assets are Stitch demo images, not ours to ship).

import { useState } from "react";
import { Card, CardBanner, Icon, PrimaryButton, SecondaryButton, SectionLabel } from "./kit";
import { PantryStatusCard } from "./InventoryScreen";
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
  onOpenInventory,
  onOpenHub,
  onOpenRecipes,
  onAskRecipe,
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
  onOpenInventory: () => void;
  onOpenHub: () => void;
  onOpenRecipes: () => void;
  onAskRecipe: () => void;
}) {
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      {/* Greeting on the hero wash */}
      <section className="art-hero relative -mx-4 -mt-5 px-5 pb-6 pt-6">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-stream-bg/40 to-stream-bg" />
        <div className="relative">
          <h2 className="text-2xl font-semibold">{greeting()}, {userName}!</h2>
          <p className="text-sm text-stream-mute">{familyName}</p>
        </div>
      </section>

      {/* Primary status card — banner strip + border-top accent, per mock */}
      <Card className="overflow-hidden border-t-4 border-t-stream-primary">
        <CardBanner icon="calendar_today" label="Weekly Meal Plan" />
        <div className="flex flex-col gap-4 p-6">
          {plan?.status === "approved" ? (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold">This week&apos;s plan is approved ✓</h3>
                <p className="text-sm leading-relaxed text-stream-mute">
                  Week of {plan.weekStart}. The cook message and shopping list are unlocked.
                </p>
              </div>
              <PrimaryButton icon="restaurant_menu" onClick={onOpenPlan}>
                View plan
              </PrimaryButton>
              <SecondaryButton icon="edit_calendar" className="-mt-2" onClick={onOpenPlan}>
                Change plan
              </SecondaryButton>
            </>
          ) : plan?.status === "draft" ? (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold">A draft is waiting for you.</h3>
                <p className="text-sm leading-relaxed text-stream-mute">
                  Review the week, change any meal, and approve when it looks right.
                </p>
              </div>
              <PrimaryButton icon="fact_check" onClick={onOpenPlan}>
                Review &amp; approve
              </PrimaryButton>
              <SecondaryButton icon="edit_calendar" className="-mt-2" onClick={onOpenPlan}>
                Change plan
              </SecondaryButton>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold">No plan yet for this week.</h3>
                <p className="text-sm leading-relaxed text-stream-mute">
                  Your kitchen is quiet. Start a conversation with {familyName} to organize your
                  meals, generate shopping lists, and coordinate with the family.
                </p>
              </div>
              <PrimaryButton icon="restaurant_menu" onClick={onAsk} disabled={busy}>
                {busy ? "Drafting your plan…" : "Plan your week"}
              </PrimaryButton>
            </>
          )}
        </div>
      </Card>

      {/* Recipes — guide + altered-recipe chat, right under the plan */}
      <div className="grid grid-cols-2 gap-4">
        <Card onClick={onOpenRecipes} className="group flex w-full flex-col gap-2 p-4 text-left">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stream-primary/10 text-stream-primary">
            <Icon name="menu_book" />
          </div>
          <h4 className="text-sm font-semibold">Recipe guide</h4>
          <p className="text-[12.5px] text-stream-mute">What&apos;s the recipe for the food items?</p>
        </Card>
        <Card onClick={onAskRecipe} className="group flex w-full flex-col gap-2 p-4 text-left">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stream-accent/10 text-stream-primary">
            <Icon name="tips_and_updates" />
          </div>
          <h4 className="text-sm font-semibold">Alter a recipe</h4>
          <p className="text-[12.5px] text-stream-mute">Chat for swaps, healthier or spicier versions.</p>
        </Card>
      </div>

      {/* Feedback prompt — Not now / Share, per mock */}
      {!feedbackDismissed && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stream-accent/10 text-stream-primary">
              <Icon name="star" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold">How was your last meal?</h4>
              <p className="text-[13px] text-stream-mute">
                Rate your last dinner to improve future suggestions.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <SecondaryButton className="flex-1 !py-2" onClick={() => setFeedbackDismissed(true)}>
              Not now
            </SecondaryButton>
            <PrimaryButton className="flex-1 !py-2" onClick={onOpenFeedback}>
              Share feedback
            </PrimaryButton>
          </div>
        </Card>
      )}

      {/* Ask-anything + pantry status grid, per mock */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card onClick={onOpenChat} className="group flex w-full flex-col gap-3 p-5 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stream-primary/10 text-stream-primary">
            <Icon name="chat" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Ask me anything else</h4>
            <p className="text-[13px] text-stream-mute">
              Check pantry stock, dietary notes, or meal history.
            </p>
          </div>
          <Icon
            name="arrow_forward"
            className="self-end text-sm text-stream-mute transition-transform group-hover:translate-x-1"
          />
        </Card>
        <PantryStatusCard onOpenInventory={onOpenInventory} />
      </div>

      {/* Home Management, per mock */}
      {canManage && (
        <section className="mt-2 border-t border-stream-line pt-5">
          <SectionLabel>Home Management</SectionLabel>
          <Card onClick={onOpenHub} className="group mt-3 flex w-full items-center justify-between p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stream-accent/10 text-stream-primary">
                <Icon name="manage_accounts" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Update Home Setup</h4>
                <p className="text-[13px] text-stream-mute">
                  Manage members, roles, and kitchen preferences.
                </p>
              </div>
            </div>
            <Icon
              name="arrow_forward"
              className="text-stream-mute transition-transform group-hover:translate-x-1"
            />
          </Card>
        </section>
      )}

      {/* Advanced Connectivity, per mock */}
      {canManage && (
        <section className="mt-2 border-t border-stream-line pt-5">
          <SectionLabel>Advanced Connectivity</SectionLabel>
          <button
            onClick={onOpenConnect}
            className="mt-3 flex items-center gap-2 rounded-full border border-stream-line bg-stream-surface px-4 py-2 text-[13px] font-medium shadow-card transition-colors hover:bg-stream-primary/5"
          >
            <Icon name="hub" className="text-sm text-stream-primary" />
            Connect ChatGPT, Claude, or Codex
          </button>
        </section>
      )}

      {/* Ambient state panel, per mock */}
      <div className="art-ambient relative mt-4 h-32 w-full overflow-hidden rounded-xl border border-stream-line shadow-card">
        <div className="absolute inset-0 bg-gradient-to-t from-stream-bg via-stream-bg/30 to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-stream-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stream-mute">
            Kitchen ambient state: Calm
          </span>
        </div>
      </div>
    </div>
  );
}
