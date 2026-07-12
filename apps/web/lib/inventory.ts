// Kitchen inventory — shared by the /api/app/inventory route and the
// list_inventory / update_inventory MCP tools.

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryItems } from "@/db/schema";

export const MAX_INVENTORY_ITEMS = 500;

export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export type InventoryView = {
  id: string;
  name: string;
  quantity: string | null;
  category: string;
  expiryDate: string | null;
  updatedAt: Date;
};

export async function listInventory(familyId: string): Promise<InventoryView[]> {
  const items = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.familyId, familyId))
    .orderBy(sql`${inventoryItems.expiryDate} ASC NULLS LAST`, asc(inventoryItems.name));
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    category: i.category,
    expiryDate: i.expiryDate ? i.expiryDate.toISOString().slice(0, 10) : null,
    updatedAt: i.updatedAt,
  }));
}

export async function upsertInventoryItem(args: {
  familyId: string;
  userId: string;
  name: string;
  quantity?: string;
  category?: string;
  expiryDate?: string; // YYYY-MM-DD
  remove?: boolean;
}): Promise<
  | { removed: string }
  | { item: typeof inventoryItems.$inferSelect; created?: boolean; updated?: boolean }
  | { error: string; status: number }
> {
  const normalizedName = normalizeItemName(args.name);
  const [existing] = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.familyId, args.familyId), eq(inventoryItems.normalizedName, normalizedName)))
    .limit(1);

  if (args.remove) {
    if (!existing) return { error: `No "${args.name}" in the inventory.`, status: 404 };
    await db.delete(inventoryItems).where(eq(inventoryItems.id, existing.id));
    return { removed: existing.name };
  }

  if (existing) {
    const [item] = await db
      .update(inventoryItems)
      .set({
        name: args.name,
        quantity: args.quantity ?? existing.quantity,
        category: args.category ?? existing.category,
        expiryDate: args.expiryDate ? new Date(`${args.expiryDate}T00:00:00Z`) : existing.expiryDate,
        updatedByUserId: args.userId,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, existing.id))
      .returning();
    return { item, updated: true };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(eq(inventoryItems.familyId, args.familyId));
  if (count >= MAX_INVENTORY_ITEMS) {
    return { error: `Inventory is capped at ${MAX_INVENTORY_ITEMS} items.`, status: 400 };
  }

  const [item] = await db
    .insert(inventoryItems)
    .values({
      familyId: args.familyId,
      name: args.name,
      normalizedName,
      quantity: args.quantity ?? null,
      category: args.category ?? "pantry",
      expiryDate: args.expiryDate ? new Date(`${args.expiryDate}T00:00:00Z`) : null,
      updatedByUserId: args.userId,
    })
    .returning();
  return { item, created: true };
}
