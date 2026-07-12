// Purchase memory — the deterministic half of receipt handling. Extraction
// (lib/purchases/receipt.ts) is the only LLM-touched step; everything here
// is plain SQL, on purpose, so the household's financial record never
// depends on a model's judgement (same rationale as approvals.ts).

import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { purchases, purchaseItems, type Purchase, type PurchaseItem } from "@/db/schema";
import { logAudit } from "../audit";
import { recordConsent } from "../consent";
import { checkDeal } from "./deals";

const RECENCY_WINDOW_DAYS = 14;

export type PurchaseItemInput = {
  name: string;
  quantity?: string;
  unitPrice?: number;
  lineTotal?: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function money(n: number): string {
  return n.toFixed(2);
}

export async function recordPurchase(args: {
  familyId: string;
  userId: string;
  store: string;
  purchaseDate?: string; // ISO-ish; defaults to now
  items: PurchaseItemInput[];
  subtotal?: number;
  tax?: number;
  total: number;
  source: "web" | "assistant";
}): Promise<{ purchase: Purchase; items: PurchaseItem[]; notes: string[] }> {
  const notes: string[] = [];
  const parsedDate = args.purchaseDate ? new Date(args.purchaseDate) : new Date();
  const purchaseDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  // Duplicate check is advisory only — a heads-up note, not a hard
  // constraint (two genuinely separate same-store same-total same-day
  // purchases are plausible, so there's no unique key to enforce). That
  // means a race between concurrent submits (double-click, two devices)
  // can log two rows before either sees the other; accepted for a
  // household-scale informational record, not worth locking/serializing
  // for. The client already disables the Save button while a save is in
  // flight, which covers the common single-user double-click case.
  const possibleDup = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.familyId, args.familyId),
      eq(purchases.store, args.store),
      eq(purchases.total, money(args.total)),
      gte(purchases.purchaseDate, startOfDay(purchaseDate)),
      lt(purchases.purchaseDate, new Date(endOfDay(purchaseDate).getTime() + 1))
    ),
  });
  if (possibleDup) {
    notes.push(`Heads up — this looks like it might be a duplicate of a ${args.store} purchase already logged the same day for the same total.`);
  }

  // Recency per item: was this bought in the last two weeks? Checked against
  // existing rows only, before this purchase is inserted.
  const recencyCutoff = new Date(purchaseDate.getTime() - RECENCY_WINDOW_DAYS * 86400000);
  for (const item of args.items) {
    const normalized = item.name.trim().toLowerCase();
    if (!normalized) continue;
    const [recent] = await db
      .select({ purchaseDate: purchases.purchaseDate, store: purchases.store })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
      .where(
        and(
          eq(purchases.familyId, args.familyId),
          eq(purchaseItems.normalizedName, normalized),
          gte(purchases.purchaseDate, recencyCutoff),
          lt(purchases.purchaseDate, purchaseDate)
        )
      )
      .orderBy(desc(purchases.purchaseDate))
      .limit(1);
    if (recent) {
      const days = Math.round((purchaseDate.getTime() - recent.purchaseDate.getTime()) / 86400000);
      notes.push(`You already bought ${item.name} ${days === 0 ? "earlier today" : `${days} day${days === 1 ? "" : "s"} ago`} (at ${recent.store}).`);
    }

    const deal = await checkDeal({ familyId: args.familyId, itemName: item.name, observedPrice: item.unitPrice ?? item.lineTotal });
    if (deal) notes.push(`${item.name} was seen for ${deal.price} at ${deal.store} — cheaper than this purchase.`);
  }

  // One transaction for purchase + items: without it, a failure on the
  // second insert (e.g. a value that passed Zod but still overflows the
  // numeric(10,2) column) would leave a purchase row with zero items
  // permanently orphaned in the table.
  const { purchase, items } = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(purchases)
      .values({
        familyId: args.familyId,
        createdByUserId: args.userId,
        store: args.store,
        purchaseDate,
        subtotal: args.subtotal !== undefined ? money(args.subtotal) : null,
        tax: args.tax !== undefined ? money(args.tax) : null,
        total: money(args.total),
        source: args.source,
      })
      .returning();

    const items = args.items.length
      ? await tx
          .insert(purchaseItems)
          .values(
            args.items.map((item) => ({
              purchaseId: purchase.id,
              name: item.name,
              normalizedName: item.name.trim().toLowerCase(),
              quantity: item.quantity,
              unitPrice: item.unitPrice !== undefined ? money(item.unitPrice) : null,
              lineTotal: item.lineTotal !== undefined ? money(item.lineTotal) : null,
            }))
          )
          .returning()
      : [];

    return { purchase, items };
  });

  await recordConsent({ familyId: args.familyId, userId: args.userId, category: "purchase_data", purpose: "purchase history and receipt memory" });
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.userId,
    actor: "user",
    action: "purchase.logged",
    subjectType: "purchase",
    subjectId: purchase.id,
    channel: args.source === "assistant" ? "assistant" : "web",
    detail: { store: args.store, total: args.total, itemCount: items.length },
  });

  return { purchase, items, notes };
}

export async function listPurchases(familyId: string, limit = 30): Promise<Array<Purchase & { items: PurchaseItem[] }>> {
  const rows = await db
    .select()
    .from(purchases)
    .where(eq(purchases.familyId, familyId))
    .orderBy(desc(purchases.purchaseDate))
    .limit(limit);
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const allItems = await db.select().from(purchaseItems).where(inArray(purchaseItems.purchaseId, ids));
  const itemsByPurchase = new Map<string, PurchaseItem[]>();
  for (const item of allItems) {
    const list = itemsByPurchase.get(item.purchaseId);
    if (list) list.push(item);
    else itemsByPurchase.set(item.purchaseId, [item]);
  }
  return rows.map((r) => ({ ...r, items: itemsByPurchase.get(r.id) ?? [] }));
}
