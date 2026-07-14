import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { generateRecipeForDish } from "@/lib/recipes-import";
import { saveRecipe } from "@/lib/recipes";
import { getProfile } from "@/db/kitchen-repo";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ dish: z.string().trim().min(2).max(120) });

// ponytail: same in-process per-family cooldown as the other importers.
const lastGen = new Map<string, number>();
const GEN_COOLDOWN_MS = 10_000;

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name the dish first." }, { status: 400 });

  const last = lastGen.get(auth.familyId) ?? 0;
  if (Date.now() - last < GEN_COOLDOWN_MS) {
    return NextResponse.json({ error: "One recipe at a time — try again in a few seconds." }, { status: 429 });
  }
  lastGen.set(auth.familyId, Date.now());

  // Respect the household's hard rules in the generated recipe.
  const profile = await getProfile(auth.familyId);
  const notes = [
    profile?.diets?.length ? `diets: ${profile.diets.join(", ")}` : "",
    profile?.allergies?.length ? `NEVER use (allergies): ${profile.allergies.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const generated = await generateRecipeForDish(parsed.data.dish, notes || undefined);
  if ("error" in generated) return NextResponse.json({ error: generated.error }, { status: 422 });

  const result = await saveRecipe({
    familyId: auth.familyId,
    userId: auth.userId,
    title: generated.title,
    description: generated.description,
    servings: generated.servings,
    ingredients: generated.ingredients,
    steps: generated.steps,
    tags: [...(generated.tags ?? []), "ai"].slice(0, 10),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
