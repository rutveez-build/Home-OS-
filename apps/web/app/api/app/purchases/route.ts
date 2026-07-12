import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { listPurchases, recordPurchase } from "@/lib/purchases/memory";
import { findPurchases } from "@/lib/purchases/query";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (q) {
    const matches = await findPurchases({ familyId: auth.familyId, itemQuery: q });
    return NextResponse.json({ matches });
  }
  const purchases = await listPurchases(auth.familyId);
  return NextResponse.json({ purchases });
}

// Capped well under the numeric(10,2) column ceiling (~99,999,999.99) —
// Zod rejecting an absurd amount here beats the DB rejecting it after a
// purchase row already exists.
const MAX_AMOUNT = 9_999_999;
const Body = z.object({
  store: z.string().trim().min(1).max(120),
  purchaseDate: z.string().trim().max(40).optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.string().trim().max(40).optional(),
        unitPrice: z.number().nonnegative().max(MAX_AMOUNT).optional(),
        lineTotal: z.number().nonnegative().max(MAX_AMOUNT).optional(),
      })
    )
    .min(1)
    .max(60),
  subtotal: z.number().nonnegative().max(MAX_AMOUNT).optional(),
  tax: z.number().nonnegative().max(MAX_AMOUNT).optional(),
  total: z.number().nonnegative().max(MAX_AMOUNT),
});

// No permission gate — logging a purchase is day-to-day household input,
// same spirit as feedback: open to every member, including read-only roles.
export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give a store, at least one item, and a total." }, { status: 400 });

  const result = await recordPurchase({ familyId: auth.familyId, userId: auth.userId, source: "web", ...parsed.data });
  return NextResponse.json(result);
}
