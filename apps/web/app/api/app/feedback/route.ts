import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { listFeedback, recordMealFeedback } from "@/lib/kitchen/feedback";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  const feedback = await listFeedback(auth.familyId);
  return NextResponse.json({ feedback });
}

const Body = z.object({
  meal: z.enum(["breakfast", "lunch", "dinner"]),
  cooked: z.enum(["cooked", "skipped"]),
  verdict: z.enum(["liked", "ok", "disliked"]).optional(),
  leftovers: z.enum(["none", "some", "lots"]).optional(),
  note: z.string().trim().max(300).optional(),
});

// No permission gate — any family member (including read-only roles) can
// share feedback, same as the existing /feedback chat command.
export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });

  const res = await recordMealFeedback({ familyId: auth.familyId, userId: auth.userId, ...parsed.data });
  return NextResponse.json(res);
}
