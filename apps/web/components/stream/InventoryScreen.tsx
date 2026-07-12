"use client";

// Kitchen inventory — per the "Kitchen Inventory" mock: chip summary,
// expiring-soon banner section, category sections with item cards, and an
// add/update form. Backed by /api/app/inventory (shared with the MCP tools).

import { useEffect, useState } from "react";
import { Card, CardBanner, Chip, EmptyState, Icon, PrimaryButton, SectionLabel, Spinner } from "./kit";

export type InventoryRow = {
  id: string;
  name: string;
  quantity: string | null;
  category: string;
  expiryDate: string | null;
  updatedAt: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  pantry: "kitchen",
  fridge: "kitchen",
  freezer: "ac_unit",
  produce: "eco",
  dairy: "egg_alt",
  spices: "grain",
  staples: "rice_bowl",
  snacks: "cookie",
};
const CATEGORIES = ["pantry", "fridge", "freezer", "produce", "dairy", "spices", "snacks"];

export function daysToExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(`${expiryDate}T00:00:00`).getTime() - Date.now()) / 86400000);
}

function expiryLabel(d: number): { text: string; urgent: boolean } {
  if (d < 0) return { text: "expired", urgent: true };
  if (d === 0) return { text: "expires today", urgent: true };
  if (d === 1) return { text: "expires tomorrow", urgent: true };
  if (d <= 3) return { text: `expires in ${d} days`, urgent: true };
  return { text: `${d} days left`, urgent: false };
}

const inputCls =
  "rounded-xl border border-stream-line bg-stream-bg px-3 py-2 text-[14px] text-stream-ink outline-none placeholder:text-stream-mute focus:border-stream-primary";

export function InventoryScreen({ flash }: { flash: (m: string) => void }) {
  const [items, setItems] = useState<InventoryRow[] | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("pantry");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/app/inventory");
    const data = await res.json().catch(() => ({}));
    setItems(data.items ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!name.trim()) return flash("Give the item a name.");
    setSaving(true);
    const res = await fetch("/api/app/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        quantity: quantity.trim() || undefined,
        category,
        expiryDate: expiry || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return flash(data.error ?? "Couldn't save that item.");
    flash(data.created ? "Added to inventory ✓" : "Updated ✓");
    setName("");
    setQuantity("");
    setExpiry("");
    load();
  }

  async function remove(itemName: string) {
    const res = await fetch("/api/app/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: itemName, remove: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flash(data.error ?? "Couldn't remove that.");
    flash(`${itemName} removed`);
    load();
  }

  const all = items ?? [];
  const expiring = all.filter((i) => {
    const d = daysToExpiry(i.expiryDate);
    return d !== null && d <= 3;
  });
  const byCat = new Map<string, InventoryRow[]>();
  for (const i of all) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <section className="px-1">
        <h2 className="text-xl font-semibold">Kitchen inventory</h2>
        <p className="text-sm text-stream-mute">
          What&apos;s actually in the house — the assistant plans around it.
        </p>
      </section>

      {/* Add / update */}
      <Card className="overflow-hidden">
        <CardBanner icon="add_circle" label="Add or update an item" />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item (e.g. Toor dal)" className={`${inputCls} min-w-0 flex-[2]`} />
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty (e.g. 2 kg)" className={`${inputCls} min-w-0 flex-1`} />
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <Chip key={c} icon={CATEGORY_ICONS[c]} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12.5px] text-stream-mute">Expires</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={`${inputCls} flex-1`} />
          </div>
          <PrimaryButton icon="save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save item"}
          </PrimaryButton>
          <p className="text-[11.5px] text-stream-mute">
            Same name updates the existing item — quantities and dates stay fresh.
          </p>
        </div>
      </Card>

      {items === null ? (
        <Spinner label="Loading the pantry…" />
      ) : all.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="Nothing tracked yet"
          body="Add what's in the pantry above — or ask the assistant to do it."
        />
      ) : (
        <>
          {expiring.length > 0 && (
            <Card className="overflow-hidden border-t-4 border-t-stream-danger">
              <CardBanner icon="timer" label="Expiring soon" tone="danger" />
              <div className="divide-y divide-stream-line">
                {expiring.map((i) => {
                  const d = daysToExpiry(i.expiryDate)!;
                  const l = expiryLabel(d);
                  return (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{i.name}</span>
                      <span className="text-[12px] font-semibold text-stream-danger">{l.text}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip icon="inventory_2" active>
              {all.length} items
            </Chip>
            {[...byCat.entries()].map(([cat, catItems]) => (
              <Chip key={cat}>
                {cat} ({catItems.length})
              </Chip>
            ))}
          </div>

          {[...byCat.entries()].map(([cat, catItems]) => (
            <section key={cat} className="flex flex-col gap-2">
              <SectionLabel>
                {cat}
              </SectionLabel>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {catItems.map((i) => {
                  const d = daysToExpiry(i.expiryDate);
                  const l = d !== null ? expiryLabel(d) : null;
                  return (
                    <Card key={i.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stream-primary/10 text-stream-primary">
                          <Icon name={CATEGORY_ICONS[cat] ?? "shopping_bag"} className="text-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px]">{i.name}</p>
                          <p className={`text-[12px] ${l?.urgent ? "font-semibold text-stream-danger" : "text-stream-mute"}`}>
                            {i.quantity ?? "—"}
                            {l ? ` · ${l.text}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => remove(i.name)}
                        aria-label={`Remove ${i.name}`}
                        className="shrink-0 rounded-full p-1.5 text-stream-mute transition-colors hover:bg-stream-danger/10 hover:text-stream-danger"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

/** Compact expiring-soon widget for the Home feed. Renders nothing when clear. */
export function ExpiringSoonCard({ onOpenInventory }: { onOpenInventory: () => void }) {
  const [expiring, setExpiring] = useState<InventoryRow[]>([]);

  useEffect(() => {
    fetch("/api/app/inventory")
      .then((r) => r.json())
      .then((d) =>
        setExpiring(
          ((d.items ?? []) as InventoryRow[]).filter((i) => {
            const days = daysToExpiry(i.expiryDate);
            return days !== null && days <= 3;
          })
        )
      )
      .catch(() => {});
  }, []);

  if (expiring.length === 0) return null;
  return (
    <Card onClick={onOpenInventory} className="w-full overflow-hidden">
      <CardBanner icon="timer" label={`Expiring soon (${expiring.length})`} tone="danger" />
      <div className="flex flex-wrap gap-1.5 p-4">
        {expiring.slice(0, 6).map((i) => (
          <Chip key={i.id} icon="schedule">
            {i.name}
          </Chip>
        ))}
      </div>
    </Card>
  );
}
