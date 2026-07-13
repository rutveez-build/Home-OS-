// YouTube → recipe import: fetch the video's captions (no API key — the
// public innertube player endpoint), then have the LLM distill them into
// the structured recipe shape saveRecipe() expects.
//
// ponytail: caption-based only — videos without captions can't be imported;
// a vision/audio pipeline is the upgrade path if that ever matters.

import { z } from "zod";
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

  // The caption URL comes from the upstream response — don't treat it as
  // trusted. Pin it to YouTube over https and refuse redirects, so a crafted
  // or compromised response can't steer the server anywhere else (SSRF).
  let capUrl: URL;
  try {
    capUrl = new URL(`${track.baseUrl}&fmt=json3`);
  } catch {
    return { error: "YouTube returned an unusable caption URL." };
  }
  const capHost = capUrl.hostname;
  if (capUrl.protocol !== "https:" || !(capHost === "youtube.com" || capHost.endsWith(".youtube.com"))) {
    return { error: "YouTube returned an unexpected caption source." };
  }
  const capRes = await fetch(capUrl, { redirect: "error" }).catch(() => null);
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
    let candidate: unknown;
    try {
      candidate = JSON.parse(jsonText);
    } catch {
      return { error: "The model returned unusable output — try that video again." };
    }
    if (candidate && typeof candidate === "object" && "error" in candidate) {
      return { error: "That video doesn't look like a recipe." };
    }
    const Shape = z.object({
      title: z.coerce.string().trim().min(1).max(120),
      description: z.coerce.string().trim().max(2000).optional().nullable(),
      servings: z.coerce.string().trim().max(40).optional().nullable(),
      ingredients: z
        .array(z.object({ name: z.coerce.string().trim().min(1).max(80), qty: z.coerce.string().trim().max(40).optional().nullable() }))
        .max(60)
        .catch([]),
      steps: z.array(z.coerce.string().trim().min(1).max(1000)).min(1).max(40),
      tags: z.array(z.coerce.string().trim().min(1).max(30)).max(10).catch([]),
    });
    const checked = Shape.safeParse(candidate);
    if (!checked.success) return { error: "Couldn't find a usable recipe in that video." };
    const r = checked.data;
    return {
      title: r.title,
      description: r.description || undefined,
      servings: r.servings || undefined,
      ingredients: r.ingredients.map((i) => ({ name: i.name, qty: i.qty || undefined })),
      steps: r.steps,
      tags: r.tags,
    };
  } catch (err) {
    console.error("[recipes-import] extraction failed", err);
    return { error: "Couldn't extract the recipe — is the LLM key configured?" };
  }
}
