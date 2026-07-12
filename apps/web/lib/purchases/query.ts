// "Did we already buy X?" — search over purchase memory. ILIKE is plenty at
// household scale; no vector search or fuzzy matching needed.

import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db/client";
import { purchases, purchaseItems, type Purchase, type PurchaseItem } from "@/db/schema";

export type PurchaseMatch = {
  purchase: Purchase;
  item: PurchaseItem;
};

export async function findPurchases(args: { familyId: string; itemQuery?: string; limit?: number }): Promise<PurchaseMatch[]> {
  const limit = args.limit ?? 20;
  const query = args.itemQuery?.trim();

  const rows = await db
    .select({ purchase: purchases, item: purchaseItems })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .where(
      query
        ? and(eq(purchases.familyId, args.familyId), ilike(purchaseItems.name, `%${query}%`))
        : eq(purchases.familyId, args.familyId)
    )
    .orderBy(desc(purchases.purchaseDate))
    .limit(limit);

  return rows;
}
