// Household-maintained deals — not scraped or fetched from any external
// price API (Home OS has no such integration or key today). A member
// records "saw sugar for ₹42 at BigBasket"; future purchases of that item
// get compared against it. Swap in a real price-data provider later behind
// this same checkDeal() signature without touching any caller.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { knownDeals, type KnownDeal } from "@/db/schema";
import { logAudit } from "../audit";

export async function recordKnownDeal(args: {
  familyId: string;
  userId: string;
  itemName: string;
  store: string;
  price: number;
}): Promise<KnownDeal> {
  const [deal] = await db
    .insert(knownDeals)
    .values({
      familyId: args.familyId,
      addedByUserId: args.userId,
      itemName: args.itemName,
      normalizedName: args.itemName.trim().toLowerCase(),
      store: args.store,
      price: args.price.toFixed(2),
    })
    .returning();
  await logAudit({
    familyId: args.familyId,
    actorUserId: args.userId,
    actor: "user",
    action: "deal.recorded",
    subjectType: "known_deal",
    subjectId: deal.id,
    detail: { itemName: args.itemName, store: args.store, price: args.price },
  });
  return deal;
}

export async function listKnownDeals(familyId: string, limit = 50): Promise<KnownDeal[]> {
  return db
    .select()
    .from(knownDeals)
    .where(eq(knownDeals.familyId, familyId))
    .orderBy(desc(knownDeals.createdAt))
    .limit(limit);
}

// Cheapest known deal for an item that beats the price just paid. Returns
// null when there's nothing on record, or nothing actually cheaper —
// silence here is deliberate, this is a nice-to-have note, never a blocker.
export async function checkDeal(args: {
  familyId: string;
  itemName: string;
  observedPrice?: number;
}): Promise<{ store: string; price: string } | null> {
  if (args.observedPrice === undefined) return null;
  const normalized = args.itemName.trim().toLowerCase();
  if (!normalized) return null;

  const candidates = await db
    .select()
    .from(knownDeals)
    .where(and(eq(knownDeals.familyId, args.familyId), eq(knownDeals.normalizedName, normalized)));
  const cheaper = candidates
    .filter((d) => Number(d.price) < args.observedPrice!)
    .sort((a, b) => Number(a.price) - Number(b.price))[0];
  return cheaper ? { store: cheaper.store, price: cheaper.price } : null;
}
