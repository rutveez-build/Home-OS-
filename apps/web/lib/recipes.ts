// Household recipes — shared by /api/app/recipes and the find_recipes /
// save_recipe MCP tools. Search is normalized-substring over titles and
// tags; household scale needs nothing smarter.

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, type Recipe } from "@/db/schema";

export const MAX_RECIPES = 300;

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function findRecipes(familyId: string, query?: string): Promise<Recipe[]> {
  const q = query?.trim();
  return db
    .select()
    .from(recipes)
    .where(
      q
        ? and(
            eq(recipes.familyId, familyId),
            or(ilike(recipes.title, `%${q}%`), sql`${recipes.tags}::text ILIKE ${"%" + q + "%"}`)
          )
        : eq(recipes.familyId, familyId)
    )
    .orderBy(desc(recipes.updatedAt))
    .limit(50);
}

export async function saveRecipe(args: {
  familyId: string;
  userId: string;
  title: string;
  description?: string;
  servings?: string;
  ingredients?: { name: string; qty?: string }[];
  steps?: string[];
  tags?: string[];
}): Promise<{ recipe: Recipe; created?: boolean; updated?: boolean } | { error: string; status: number }> {
  const normalizedTitle = normalizeTitle(args.title);
  const [existing] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.familyId, args.familyId), eq(recipes.normalizedTitle, normalizedTitle)))
    .limit(1);

  if (existing) {
    const [recipe] = await db
      .update(recipes)
      .set({
        title: args.title,
        description: args.description ?? existing.description,
        servings: args.servings ?? existing.servings,
        ingredients: args.ingredients ?? existing.ingredients,
        steps: args.steps ?? existing.steps,
        tags: args.tags ?? existing.tags,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, existing.id))
      .returning();
    return { recipe, updated: true };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(eq(recipes.familyId, args.familyId));
  if (count >= MAX_RECIPES) return { error: `Recipes are capped at ${MAX_RECIPES}.`, status: 400 };

  const [recipe] = await db
    .insert(recipes)
    .values({
      familyId: args.familyId,
      title: args.title,
      normalizedTitle,
      description: args.description ?? null,
      servings: args.servings ?? null,
      ingredients: args.ingredients ?? [],
      steps: args.steps ?? [],
      tags: args.tags ?? [],
      createdByUserId: args.userId,
    })
    .returning();
  return { recipe, created: true };
}
