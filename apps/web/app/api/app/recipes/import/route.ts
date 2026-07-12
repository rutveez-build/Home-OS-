import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { extractRecipeFromTranscript, fetchYouTubeTranscript, parseYouTubeId } from "@/lib/recipes-import";
import { saveRecipe } from "@/lib/recipes";

export const runtime = "nodejs";
export const maxDuration = 60; // transcript + LLM extraction can be slow

const Body = z.object({ url: z.string().trim().url().max(300) });

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give a valid YouTube URL." }, { status: 400 });

  const videoId = parseYouTubeId(parsed.data.url);
  if (!videoId) return NextResponse.json({ error: "That doesn't look like a YouTube link." }, { status: 400 });

  const t = await fetchYouTubeTranscript(videoId);
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 422 });

  const extracted = await extractRecipeFromTranscript(t.title, t.transcript);
  if ("error" in extracted) return NextResponse.json({ error: extracted.error }, { status: 422 });

  const result = await saveRecipe({
    familyId: auth.familyId,
    userId: auth.userId,
    title: extracted.title,
    description: extracted.description,
    servings: extracted.servings,
    ingredients: extracted.ingredients,
    steps: extracted.steps,
    tags: [...(extracted.tags ?? []), "youtube"].slice(0, 10),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ...result, source: { videoId, videoTitle: t.title } });
}
