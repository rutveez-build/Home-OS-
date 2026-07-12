import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryItems } from "@/db/schema";
import { requireFamily, isAuthed } from "@/lib/app-api";

export const runtime = "nodejs";

const MAX_ITEMS = 500;

// One POST covers add / update / remove so the single update_inventory MCP
// tool can drive the whole pantry. Upsert key is the normalized name.
const Body = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.string().trim().max(40).optional(),
  category: z.string().trim().min(1).max(30).optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expiryDate must be YYYY-MM-DD")
    .optional(),
  remove: z.boolean().optional(),
});

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  const items = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.familyId, auth.familyId))
    .orderBy(sql`${inventoryItems.expiryDate} ASC NULLS LAST`, asc(inventoryItems.name));
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      category: i.category,
      expiryDate: i.expiryDate ? i.expiryDate.toISOString().slice(0, 10) : null,
      updatedAt: i.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid inventory update" },
      { status: 400 }
    );
  }
  const { name, quantity, category, expiryDate, remove } = parsed.data;
  const normalizedName = normalize(name);

  const [existing] = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.familyId, auth.familyId), eq(inventoryItems.normalizedName, normalizedName)))
    .limit(1);

  if (remove) {
    if (!existing) return NextResponse.json({ error: `No "${name}" in the inventory.` }, { status: 404 });
    await db.delete(inventoryItems).where(eq(inventoryItems.id, existing.id));
    return NextResponse.json({ removed: existing.name });
  }

  if (existing) {
    const [item] = await db
      .update(inventoryItems)
      .set({
        name,
        quantity: quantity ?? existing.quantity,
        category: category ?? existing.category,
        expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00Z`) : existing.expiryDate,
        updatedByUserId: auth.userId,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, existing.id))
      .returning();
    return NextResponse.json({ item, updated: true });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(eq(inventoryItems.familyId, auth.familyId));
  if (count >= MAX_ITEMS) {
    return NextResponse.json({ error: `Inventory is capped at ${MAX_ITEMS} items.` }, { status: 400 });
  }

  const [item] = await db
    .insert(inventoryItems)
    .values({
      familyId: auth.familyId,
      name,
      normalizedName,
      quantity: quantity ?? null,
      category: category ?? "pantry",
      expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00Z`) : null,
      updatedByUserId: auth.userId,
    })
    .returning();
  return NextResponse.json({ item, created: true });
}
