"use client";

// Purchases (receipt memory), Kitchen Stream style — per the "Kitchen
// Purchases" mock: capture card (camera / manual), editable extraction
// preview, "did we already buy…?" search, recent purchases, known deals.
// All handlers and API wiring carried over from the cream version.

import { useEffect, useRef, useState } from "react";
import { Card, CardBanner, Chip, EmptyState, Icon, PrimaryButton, SectionLabel, Spinner, ScreenHero } from "./kit";
import { relativeDay } from "./types";

type PurchaseItem = { id: string; name: string; quantity: string | null; unitPrice: string | null; lineTotal: string | null };
type Purchase = { id: string; store: string; purchaseDate: string; subtotal: string | null; tax: string | null; total: string; source: string; items: PurchaseItem[] };
type ReceiptExtraction = {
  store: string;
  date?: string;
  items: { name: string; quantity?: string; unitPrice?: number; lineTotal?: number }[];
  subtotal?: number;
  tax?: number;
  total: number;
};
type KnownDeal = { id: string; itemName: string; store: string; price: string; createdAt: string };

// Downscale + re-encode client-side before upload — Vercel serverless
// functions cap request bodies around 4.5MB, and a raw phone photo (often
// 3-8MB) plus base64's ~33% overhead would blow past that.
function downscaleImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type DraftItem = { name: string; quantity: string; unitPrice: string; lineTotal: string };
type Draft = { store: string; date: string; items: DraftItem[]; subtotal: string; tax: string; total: string };
const EMPTY_DRAFT: Draft = { store: "", date: "", items: [{ name: "", quantity: "", unitPrice: "", lineTotal: "" }], subtotal: "", tax: "", total: "" };

function extractionToDraft(x: ReceiptExtraction): Draft {
  return {
    store: x.store,
    date: x.date ?? "",
    items: x.items.map((i) => ({
      name: i.name,
      quantity: i.quantity ?? "",
      unitPrice: i.unitPrice !== undefined ? String(i.unitPrice) : "",
      lineTotal: i.lineTotal !== undefined ? String(i.lineTotal) : "",
    })),
    subtotal: x.subtotal !== undefined ? String(x.subtotal) : "",
    tax: x.tax !== undefined ? String(x.tax) : "",
    total: String(x.total),
  };
}

const inputCls =
  "rounded-xl border border-stream-line bg-stream-bg px-3 py-2 text-[14px] text-stream-ink outline-none placeholder:text-stream-mute focus:border-stream-primary";

export function PurchasesScreen({ flash }: { flash: (m: string) => void }) {
  const [history, setHistory] = useState<Purchase[] | null>(null);
  const [deals, setDeals] = useState<KnownDeal[] | null>(null);
  const [mode, setMode] = useState<"upload" | "manual" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Array<{ purchase: Purchase; item: PurchaseItem }> | null>(null);
  const [dealItem, setDealItem] = useState("");
  const [dealStore, setDealStore] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadHistory() {
    const res = await fetch("/api/app/purchases");
    const data = await res.json().catch(() => ({}));
    setHistory(data.purchases ?? []);
  }
  async function loadDeals() {
    const res = await fetch("/api/app/deals");
    const data = await res.json().catch(() => ({}));
    setDeals(data.deals ?? []);
  }
  useEffect(() => {
    loadHistory();
    loadDeals();
  }, []);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const dataUrl = await downscaleImage(file);
      const res = await fetch("/api/app/purchases/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash(data.error ?? "Couldn't read that receipt.");
        return;
      }
      setDraft(extractionToDraft(data.extraction));
      setMode("upload");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't process that image.");
    } finally {
      setExtracting(false);
    }
  }

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setDraft((d) => ({ ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function addItem() {
    setDraft((d) => ({ ...d, items: [...d.items, { name: "", quantity: "", unitPrice: "", lineTotal: "" }] }));
  }
  function removeItem(i: number) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));
  }

  async function savePurchase() {
    const items = draft.items
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        quantity: it.quantity.trim() || undefined,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : undefined,
        lineTotal: it.lineTotal ? Number(it.lineTotal) : undefined,
      }));
    if (!draft.store.trim()) return flash("Give the store a name.");
    if (!items.length) return flash("Add at least one item.");
    if (!draft.total) return flash("Give a total.");

    setSaving(true);
    const res = await fetch("/api/app/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store: draft.store.trim(),
        purchaseDate: draft.date || undefined,
        items,
        subtotal: draft.subtotal ? Number(draft.subtotal) : undefined,
        tax: draft.tax ? Number(draft.tax) : undefined,
        total: Number(draft.total),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return flash(data.error ?? "Couldn't save that purchase.");
    flash(data.notes?.length ? data.notes.join(" ") : "Purchase logged ✓");
    setMode(null);
    setDraft(EMPTY_DRAFT);
    loadHistory();
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      setMatches(null);
      return;
    }
    const res = await fetch(`/api/app/purchases?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    setMatches(data.matches ?? []);
  }

  async function addDeal() {
    if (!dealItem.trim() || !dealStore.trim() || !dealPrice) return flash("Give an item, store, and price.");
    const res = await fetch("/api/app/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: dealItem.trim(), store: dealStore.trim(), price: Number(dealPrice) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flash(data.error ?? "Couldn't save that deal.");
    setDealItem("");
    setDealStore("");
    setDealPrice("");
    flash("Deal saved ✓");
    loadDeals();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <ScreenHero
        title="What did we actually buy?"
        sub="Upload a receipt or log one manually — search it back later with a plain question."
      />

      {/* Capture */}
      <Card className="overflow-hidden">
        <CardBanner icon="receipt_long" label="Log a purchase" />
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            <Chip icon="photo_camera" active={mode === "upload"} onClick={() => fileInputRef.current?.click()}>
              {extracting ? "Reading…" : "Upload receipt"}
            </Chip>
            <Chip
              icon="edit"
              active={mode === "manual"}
              onClick={() => {
                setMode("manual");
                setDraft(EMPTY_DRAFT);
              }}
            >
              Enter manually
            </Chip>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} className="hidden" />

          {mode && (
            <div className="mt-4 space-y-3 border-t border-stream-line pt-3">
              <div className="flex gap-2">
                <input
                  value={draft.store}
                  onChange={(e) => setDraft((d) => ({ ...d, store: e.target.value }))}
                  placeholder="Store"
                  className={`${inputCls} flex-1`}
                />
                <input
                  value={draft.date}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                  placeholder="YYYY-MM-DD"
                  className={`${inputCls} w-32`}
                />
              </div>

              <div className="space-y-1.5">
                {draft.items.map((it, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="Item" className={`${inputCls} min-w-0 flex-[2]`} />
                    <input value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} placeholder="Qty" className={`${inputCls} w-16 px-2`} />
                    <input value={it.lineTotal} onChange={(e) => updateItem(i, { lineTotal: e.target.value })} placeholder="₹" className={`${inputCls} w-16 px-2`} />
                    <button
                      onClick={() => removeItem(i)}
                      aria-label="Remove item"
                      className="shrink-0 rounded-xl border border-stream-danger/40 px-2 text-stream-danger"
                    >
                      <Icon name="close" className="text-[16px]" />
                    </button>
                  </div>
                ))}
                <button onClick={addItem} className="text-[13px] font-semibold text-stream-primary">
                  + Add item
                </button>
              </div>

              <div className="flex gap-2">
                <input value={draft.subtotal} onChange={(e) => setDraft((d) => ({ ...d, subtotal: e.target.value }))} placeholder="Subtotal" className={`${inputCls} min-w-0 flex-1`} />
                <input value={draft.tax} onChange={(e) => setDraft((d) => ({ ...d, tax: e.target.value }))} placeholder="Tax" className={`${inputCls} min-w-0 flex-1`} />
                <input value={draft.total} onChange={(e) => setDraft((d) => ({ ...d, total: e.target.value }))} placeholder="Total *" className={`${inputCls} min-w-0 flex-1`} />
              </div>

              <PrimaryButton className="w-full" icon="save" onClick={savePurchase} disabled={saving}>
                {saving ? "Saving…" : "Save purchase"}
              </PrimaryButton>
            </div>
          )}
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <label className="block text-[13px] font-semibold">Did we already buy…?</label>
        <div className="mt-1.5 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="e.g. sugar"
            className={`${inputCls} min-w-0 flex-1`}
          />
          <button
            onClick={runSearch}
            className="shrink-0 rounded-xl border border-stream-primary/20 bg-stream-primary/5 px-3 text-[13px] font-semibold text-stream-primary"
          >
            Find
          </button>
        </div>
        {matches !== null &&
          (matches.length === 0 ? (
            <p className="mt-2 text-[13px] text-stream-mute">Nothing found for &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {matches.map((m) => (
                <p key={m.item.id} className="text-[13px]">
                  <strong>{m.item.name}</strong>{" "}
                  <span className="text-stream-mute">
                    — {m.purchase.store}, {relativeDay(m.purchase.purchaseDate)} (₹{m.item.lineTotal ?? m.purchase.total})
                  </span>
                </p>
              ))}
            </div>
          ))}
      </Card>

      <SectionLabel>Recent purchases</SectionLabel>
      {history === null ? (
        <Spinner />
      ) : history.length === 0 ? (
        <EmptyState icon="receipt_long" title="Nothing logged yet" body="Upload or enter your first receipt above." />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((p) => (
            <Card key={p.id} className="p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold">{p.store}</span>
                <span className="shrink-0 text-[13px] font-bold text-stream-primary">₹{p.total}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-stream-mute">{relativeDay(p.purchaseDate)}</p>
              <p className="mt-1 text-[12.5px] text-stream-mute">{p.items.map((it) => it.name).join(", ")}</p>
            </Card>
          ))}
        </div>
      )}

      <SectionLabel>Known deals</SectionLabel>
      <p className="-mt-2 px-1 text-[12px] text-stream-mute">
        Manually tracked — teach the household a price you saw, and future purchases get compared
        against it.
      </p>
      <Card className="p-3">
        <div className="flex gap-1.5">
          <input value={dealItem} onChange={(e) => setDealItem(e.target.value)} placeholder="Item" className={`${inputCls} min-w-0 flex-1 px-2.5`} />
          <input value={dealStore} onChange={(e) => setDealStore(e.target.value)} placeholder="Store" className={`${inputCls} min-w-0 flex-1 px-2.5`} />
          <input value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} placeholder="₹" className={`${inputCls} w-16 px-2`} />
          <button
            onClick={addDeal}
            className="shrink-0 rounded-xl border border-stream-primary/20 bg-stream-primary/5 px-2.5 text-[13px] font-semibold text-stream-primary"
          >
            Add
          </button>
        </div>
        {deals && deals.length > 0 && (
          <div className="mt-2 space-y-1">
            {deals.map((d) => (
              <p key={d.id} className="text-[12.5px] text-stream-mute">
                {d.itemName} — ₹{d.price} at {d.store}
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
