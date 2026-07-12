import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { listInventory, upsertInventoryItem } from "@/lib/inventory";

export const runtime = "nodejs";

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

export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  return NextResponse.json({ items: await listInventory(auth.familyId) });
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

  const result = await upsertInventoryItem({ familyId: auth.familyId, userId: auth.userId, ...parsed.data });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
