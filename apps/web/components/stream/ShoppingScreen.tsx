"use client";

// Shopping list, Kitchen Stream style — per the "Shopping List" mock:
// summary chip cloud, category sections with check-off item cards, and the
// copy-for-quick-commerce action. Check state is local only, a shopping-trip
// aid; the source of truth stays the approved plan.

import { useEffect, useState } from "react";
import { Card, CheckToggle, Chip, EmptyState, Icon, PrimaryButton, SecondaryButton, Spinner, ScreenHero } from "./kit";
import type { ShoppingItem } from "./types";

const CATEGORY_ICONS: Record<string, string> = {
  produce: "eco",
  dairy: "egg_alt",
  pantry: "kitchen",
  staples: "rice_bowl",
  spices: "grain",
  meat: "set_meal",
  snacks: "cookie",
  frozen: "ac_unit",
  bakery: "bakery_dining",
  beverages: "local_cafe",
};

function catIcon(cat: string): string {
  return CATEGORY_ICONS[cat.toLowerCase()] ?? "shopping_bag";
}

export function ShoppingScreen({
  shoppingList,
  busy,
  onLoad,
  onBack,
  flash,
}: {
  shoppingList: { items: ShoppingItem[] } | null;
  busy: boolean;
  onLoad: () => void;
  onBack: () => void;
  flash: (m: string) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!shoppingList) onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = shoppingList?.items ?? [];
  const byCat = new Map<string, ShoppingItem[]>();
  for (const i of items) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);

  function toggle(name: string, next: boolean) {
    setChecked((prev) => {
      const s = new Set(prev);
      if (next) s.add(name);
      else s.delete(name);
      return s;
    });
  }

  function copyAll() {
    const text = [...byCat.entries()]
      .map(
        ([cat, catItems]) =>
          `${cat.toUpperCase()}\n` +
          catItems
            .map((i) => `• ${i.name} — ${i.qty}${i.substitute ? ` (sub: ${i.substitute})` : ""}`)
            .join("\n")
      )
      .join("\n\n");
    navigator.clipboard?.writeText(text).catch(() => {});
    flash("Copied — paste into Blinkit, Zepto or Instamart");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <ScreenHero
        title="Shopping list"
        sub="Built from the approved plan. We never order on our own."
      />

      {busy && !shoppingList ? (
        <Spinner label="Building the list from your plan…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="shopping_basket"
          title="No list yet"
          body="Approve a weekly plan and the shopping list builds itself."
        />
      ) : (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip icon="shopping_basket" active>
              {items.length} items
            </Chip>
            {[...byCat.entries()].map(([cat, catItems]) => (
              <Chip key={cat}>
                {cat} ({catItems.length})
              </Chip>
            ))}
          </div>

          {[...byCat.entries()].map(([cat, catItems]) => (
            <section key={cat} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold capitalize">
                  <Icon name={catIcon(cat)} className="text-[18px] text-stream-primary" />
                  {cat}
                </h3>
                <span className="rounded bg-stream-surface-2 px-2 py-0.5 text-[12px] text-stream-mute">
                  {catItems.filter((i) => checked.has(i.name)).length}/{catItems.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {catItems.map((i) => {
                  const done = checked.has(i.name);
                  return (
                    <Card key={i.name} className={`flex items-center justify-between gap-3 p-3 ${done ? "opacity-60" : ""}`}>
                      <div className="min-w-0">
                        <p className={`truncate text-[15px] ${done ? "line-through" : ""}`}>{i.name}</p>
                        <p className="text-[12px] text-stream-mute">
                          {i.qty}
                          {i.substitute && ` · sub OK: ${i.substitute}`}
                        </p>
                      </div>
                      <CheckToggle checked={done} onChange={(v) => toggle(i.name, v)} label={`Mark ${i.name}`} />
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}

          <PrimaryButton icon="content_copy" onClick={copyAll}>
            Copy list for Blinkit / Zepto
          </PrimaryButton>
        </>
      )}

      <SecondaryButton icon="arrow_back" onClick={onBack}>
        Back to plan
      </SecondaryButton>
    </div>
  );
}
