import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { findRecipes, saveRecipe } from "@/lib/recipes";

export const runtime = "nodejs";

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  servings: z.string().trim().max(40).optional(),
  ingredients: z
    .array(z.object({ name: z.string().trim().min(1).max(80), qty: z.string().trim().max(40).optional() }))
    .max(60)
    .optional(),
  steps: z.array(z.string().trim().min(1).max(1000)).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  return NextResponse.json({ recipes: await findRecipes(auth.familyId, q) });
}

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid recipe" },
      { status: 400 }
    );
  }

  const result = await saveRecipe({ familyId: auth.familyId, userId: auth.userId, ...parsed.data });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
