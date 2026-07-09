import { NextResponse } from "next/server";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { buildShoppingList } from "@/lib/kitchen/shopping";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const res = await buildShoppingList({ familyId: auth.familyId, userId: auth.userId });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 404 });

  return NextResponse.json(res);
}
