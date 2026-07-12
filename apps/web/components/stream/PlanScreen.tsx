"use client";

// Weekly plan + review/approve, Kitchen Stream style — per the "Meal
// Planner" and "Meal Plan: Review & Approve" mocks. Approval is a full-width
// banner card, deliberately the loudest element on the screen.

import { useState } from "react";
import { Card, CardBanner, Chip, Icon, PrimaryButton, SecondaryButton } from "./kit";
import { DAY_NAMES, MEAL_LABEL, MEAL_ORDER, type Plan, type PlanEntry } from "./types";

const MEAL_ICONS: Record<string, string> = {
  breakfast: "bakery_dining",
  lunch: "lunch_dining",
  dinner: "dinner_dining",
};

export function PlanScreen({
  plan,
  busy,
  onChangeEntry,
  onApprove,
  onCook,
  onShopping,
  onRecipe,
}: {
  plan: NonNullable<Plan>;
  busy: boolean;
  onChangeEntry: (day: number, meal: PlanEntry["meal"], dish: string) => void;
  onApprove: () => void;
  onCook: () => void;
  onShopping: () => void;
  onRecipe: (dish: string) => void;
}) {
  const [editing, setEditing] = useState<{ day: number; meal: PlanEntry["meal"] } | null>(null);
  const [draft, setDraft] = useState("");
  const [editMode, setEditMode] = useState(false);
  const canChange = plan.status === "draft" || editMode;

  const byDay = new Map<number, PlanEntry[]>();
  for (const e of plan.entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <section className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-semibold">Week of {plan.weekStart}</h2>
          <p className="text-sm text-stream-mute">
            {plan.status === "approved"
              ? editMode
                ? "Editing the approved plan — changes save immediately."
                : "Approved. Tap Edit below to make changes."
              : "Nothing is final until you approve."}
          </p>
        </div>
        <Chip icon={plan.status === "approved" ? "check_circle" : "hourglass_top"} active={plan.status === "approved"}>
          {plan.status === "approved" ? "Approved" : "Draft"}
        </Chip>
      </section>

      {/* Approval — the unmissable moment */}
      {plan.status === "draft" && (
        <Card className="overflow-hidden border-t-4 border-t-stream-primary">
          <CardBanner icon="fact_check" label="Approval needed" />
          <div className="flex flex-col gap-3 p-5">
            <p className="text-sm leading-relaxed text-stream-mute">
              Approving unlocks the daily cook message and the shopping list. Change any meal
              first — nothing goes out without you.
            </p>
            <PrimaryButton icon="check" onClick={onApprove} disabled={busy}>
              {busy ? "Approving…" : "Approve this plan"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {days.map((d) => (
        <Card key={d} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stream-line px-4 py-2.5">
            <span className="text-[13px] font-bold uppercase tracking-wider text-stream-primary">
              {DAY_NAMES[d]}
            </span>
            <span className="text-[12px] text-stream-mute">{byDay.get(d)!.length} meals</span>
          </div>
          <div className="divide-y divide-stream-line">
            {byDay
              .get(d)!
              .sort((a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal])
              .map((e) => (
                <div key={e.meal} className="flex items-center gap-3 px-4 py-3">
                  <Icon name={MEAL_ICONS[e.meal]} className="text-[20px] text-stream-mute" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stream-mute">
                      {MEAL_LABEL[e.meal]}
                    </p>
                    <p className="truncate text-[15px] font-medium">{e.dish}</p>
                  </div>
                  <button
                    onClick={() => onRecipe(e.dish)}
                    aria-label={`Recipe for ${e.dish}`}
                    title="Recipe guide"
                    className="shrink-0 rounded-full p-1.5 text-stream-mute transition-colors hover:bg-stream-primary/10 hover:text-stream-primary"
                  >
                    <Icon name="menu_book" className="text-[18px]" />
                  </button>
                  {canChange && (
                    <button
                      onClick={() => {
                        setEditing({ day: d, meal: e.meal });
                        setDraft(e.dish);
                      }}
                      className="shrink-0 rounded-lg border border-stream-primary/20 bg-stream-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-stream-primary transition-colors hover:bg-stream-primary/10"
                    >
                      Change
                    </button>
                  )}
                </div>
              ))}
          </div>
        </Card>
      ))}

      {plan.status !== "draft" && (
        <div className="flex flex-col gap-2">
          <SecondaryButton
            icon={editMode ? "check" : "edit_calendar"}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "Done editing" : "Edit plan"}
          </SecondaryButton>
          <div className="flex gap-2">
            <PrimaryButton icon="outgoing_mail" className="flex-1" onClick={onCook}>
              Cook message
            </PrimaryButton>
            <PrimaryButton icon="shopping_basket" className="flex-1" onClick={onShopping}>
              Shopping list
            </PrimaryButton>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="w-full rounded-t-2xl bg-stream-surface p-5 shadow-sheet">
            <p className="text-[15px] font-semibold">
              Change {DAY_NAMES[editing.day]}&apos;s {MEAL_LABEL[editing.meal].toLowerCase()}
            </p>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-3 block w-full rounded-xl border border-stream-line bg-stream-bg px-4 py-3 text-[15px] text-stream-ink outline-none focus:border-stream-primary"
            />
            <div className="mt-4 flex gap-2">
              <SecondaryButton className="flex-1" onClick={() => setEditing(null)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                className="flex-1"
                onClick={() => {
                  onChangeEntry(editing.day, editing.meal, draft);
                  setEditing(null);
                }}
              >
                Save
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
