// YouTube → recipe import: fetch the video's captions (no API key — the
// public innertube player endpoint), then have the LLM distill them into
// the structured recipe shape saveRecipe() expects.
//
// ponytail: caption-based only — videos without captions can't be imported;
// a vision/audio pipeline is the upgrade path if that ever matters.

import { llm, LLM_MODEL_FAST } from "./llm";

export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

type TranscriptResult = { title: string; transcript: string } | { error: string };

export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptResult> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11)" },
    body: JSON.stringify({
      context: {
        client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "en" },
      },
      videoId,
    }),
  }).catch(() => null);
  if (!res?.ok) return { error: "Couldn't reach YouTube for that video." };

  const data = (await res.json().catch(() => null)) as {
    videoDetails?: { title?: string };
    captions?: {
      playerCaptionsTracklistRenderer?: { captionTracks?: { baseUrl: string; languageCode: string; kind?: string }[] };
    };
  } | null;
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) {
    return { error: "That video has no captions — the importer needs them to read the recipe." };
  }
  // Prefer a human track, then English, then whatever exists.
  const track =
    tracks.find((t) => t.kind !== "asr" && t.languageCode.startsWith("en")) ??
    tracks.find((t) => t.languageCode.startsWith("en")) ??
    tracks.find((t) => t.kind !== "asr") ??
    tracks[0];

  const capRes = await fetch(`${track.baseUrl}&fmt=json3`).catch(() => null);
  if (!capRes?.ok) return { error: "Couldn't download the video's captions." };
  const cap = (await capRes.json().catch(() => null)) as {
    events?: { segs?: { utf8?: string }[] }[];
  } | null;
  const transcript = (cap?.events ?? [])
    .flatMap((e) => e.segs ?? [])
    .map((s) => s.utf8 ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!transcript) return { error: "The captions came back empty." };

  return { title: data?.videoDetails?.title ?? "Untitled video", transcript: transcript.slice(0, 16000) };
}

export type ExtractedRecipe = {
  title: string;
  description?: string;
  servings?: string;
  ingredients: { name: string; qty?: string }[];
  steps: string[];
  tags?: string[];
};

export async function extractRecipeFromTranscript(
  videoTitle: string,
  transcript: string
): Promise<ExtractedRecipe | { error: string }> {
  const prompt = `A cooking video titled "${videoTitle}" has this transcript:

${transcript}

Extract the recipe as strict JSON (no markdown fence, no commentary):
{"title": string, "description": string (1-2 sentences), "servings": string or null, "ingredients": [{"name": string, "qty": string or null}], "steps": [string, ...], "tags": [string, ...]}
Rules: steps are imperative and self-contained; keep quantities exactly as spoken; max 60 ingredients, 40 steps, 10 tags; if the video contains no actual recipe, return {"error": "not a recipe video"}.`;

  try {
    const res = await llm.chat.completions.create({
      model: LLM_MODEL_FAST,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });
    const raw = res.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(jsonText) as ExtractedRecipe & { error?: string };
    if (parsed.error) return { error: "That video doesn't look like a recipe." };
    if (!parsed.title || !Array.isArray(parsed.steps) || !parsed.steps.length) {
      return { error: "Couldn't find a usable recipe in that video." };
    }
    return {
      title: String(parsed.title).slice(0, 120),
      description: parsed.description ? String(parsed.description).slice(0, 2000) : undefined,
      servings: parsed.servings ? String(parsed.servings).slice(0, 40) : undefined,
      ingredients: (parsed.ingredients ?? [])
        .filter((i) => i && typeof i.name === "string")
        .slice(0, 60)
        .map((i) => ({ name: i.name.slice(0, 80), qty: i.qty ? String(i.qty).slice(0, 40) : undefined })),
      steps: parsed.steps.filter((s) => typeof s === "string").slice(0, 40).map((s) => s.slice(0, 1000)),
      tags: (parsed.tags ?? []).filter((t) => typeof t === "string").slice(0, 10).map((t) => t.slice(0, 30)),
    };
  } catch (err) {
    console.error("[recipes-import] extraction failed", err);
    return { error: "Couldn't extract the recipe — is the LLM key configured?" };
  }
}
