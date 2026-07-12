import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { listKnownDeals, recordKnownDeal } from "@/lib/purchases/deals";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  const deals = await listKnownDeals(auth.familyId);
  return NextResponse.json({ deals });
}

// Capped well under the numeric(10,2) column ceiling (~99,999,999.99).
const Body = z.object({
  itemName: z.string().trim().min(1).max(120),
  store: z.string().trim().min(1).max(120),
  price: z.number().nonnegative().max(9_999_999),
});

// No permission gate — same spirit as feedback/grocery-list additions:
// any member can teach the household a price they saw.
export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give an item name, store, and price." }, { status: 400 });

  const deal = await recordKnownDeal({ familyId: auth.familyId, userId: auth.userId, ...parsed.data });
  return NextResponse.json({ deal });
}
