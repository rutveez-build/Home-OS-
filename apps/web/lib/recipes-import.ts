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

type PlayerResponse = {
  playabilityStatus?: { status?: string };
  videoDetails?: { title?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: { baseUrl: string; languageCode: string; kind?: string }[] };
  };
};

// Innertube clients differ: IOS honors fmt=json3, ANDROID ignores it and
// returns timedtext XML, WEB is often blocked from datacenter IPs. Try IOS
// first, fall back to ANDROID, and parse whichever body shape comes back.
const PLAYER_CLIENTS: { name: string; client: Record<string, unknown> }[] = [
  { name: "IOS", client: { clientName: "IOS", clientVersion: "20.10.4", deviceModel: "iPhone16,2", hl: "en" } },
  { name: "ANDROID", client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "en" } },
];

function decodeEntities(t: string): string {
  return t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function parseCaptionBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    // json3
    try {
      const cap = JSON.parse(trimmed) as { events?: { segs?: { utf8?: string }[] }[] };
      return (cap.events ?? [])
        .flatMap((e) => e.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join(" ");
    } catch {
      return "";
    }
  }
  // timedtext XML: <text ...>content</text> or <p ...>content</p>
  const texts = [...trimmed.matchAll(/<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/g)].map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, " "))
  );
  return texts.join(" ");
}

type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };

function pickTrack(tracks: CaptionTrack[]): CaptionTrack {
  return (
    tracks.find((t) => t.kind !== "asr" && t.languageCode.startsWith("en")) ??
    tracks.find((t) => t.languageCode.startsWith("en")) ??
    tracks.find((t) => t.kind !== "asr") ??
    tracks[0]
  );
}

/** Fetch + parse a caption track URL (validated: https, youtube.com only). */
async function fetchTrack(baseUrl: string): Promise<string> {
  let capUrl: URL;
  try {
    capUrl = new URL(baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`);
  } catch {
    return "";
  }
  const host = capUrl.hostname;
  if (capUrl.protocol !== "https:" || !(host === "youtube.com" || host.endsWith(".youtube.com"))) return "";
  const res = await fetch(capUrl, { redirect: "error" }).catch(() => null);
  if (!res?.ok) return "";
  return parseCaptionBody(await res.text()).replace(/\s+/g, " ").trim();
}

/** Strategy B: the public watch page embeds ytInitialPlayerResponse — often
 * still served to datacenter IPs when the innertube API is stripped. */
async function tracksFromWatchPage(videoId: string): Promise<{ title?: string; tracks: CaptionTrack[] }> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  }).catch(() => null);
  if (!res?.ok) return { tracks: [] };
  const html = await res.text();
  const m = html.match(/"captionTracks":(\[.*?\])[,}]/);
  const t = html.match(/<title>([^<]*)<\/title>/);
  if (!m) return { title: t?.[1], tracks: [] };
  try {
    return { title: t?.[1]?.replace(/ - YouTube$/, ""), tracks: JSON.parse(m[1]) as CaptionTrack[] };
  } catch {
    return { title: t?.[1], tracks: [] };
  }
}

/** Strategy C: the legacy timedtext list API — no innertube session at all. */
async function tracksFromTimedtextList(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/api/timedtext?type=list&v=${videoId}`).catch(() => null);
  if (!res?.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<track[^>]*lang_code="([^"]+)"[^>]*?(kind="([^"]*)")?[^>]*\/>/g)].map((m) => ({
    baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${m[1]}${m[3] ? `&kind=${m[3]}` : ""}`,
    languageCode: m[1],
    kind: m[3],
  }));
}

export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptResult> {
  let sawUnplayable = false;
  let sawOkNoTracks = false;
  let title: string | undefined;

  // Strategy A: innertube API clients (works from residential IPs).
  for (const { client } of PLAYER_CLIENTS) {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client }, videoId }),
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => null)) as PlayerResponse | null;
    const status = data?.playabilityStatus?.status;
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    title = title ?? data?.videoDetails?.title;
    if (status !== "OK") {
      sawUnplayable = true;
      continue;
    }
    if (!tracks.length) {
      sawOkNoTracks = true;
      continue;
    }
    const transcript = await fetchTrack(pickTrack(tracks).baseUrl);
    if (transcript) return { title: title ?? "Untitled video", transcript: transcript.slice(0, 16000) };
  }

  // Strategy B: scrape the public watch page (datacenter IPs often still get
  // full HTML when the API response is stripped).
  const page = await tracksFromWatchPage(videoId);
  title = title ?? page.title;
  if (page.tracks.length) {
    const transcript = await fetchTrack(pickTrack(page.tracks).baseUrl);
    if (transcript) return { title: title ?? "Untitled video", transcript: transcript.slice(0, 16000) };
  }

  // Strategy C: legacy timedtext list API.
  const legacy = await tracksFromTimedtextList(videoId);
  if (legacy.length) {
    const transcript = await fetchTrack(pickTrack(legacy).baseUrl);
    if (transcript) return { title: title ?? "Untitled video", transcript: transcript.slice(0, 16000) };
  }

  if (sawOkNoTracks && !page.tracks.length && !legacy.length) {
    return { error: "That video has no captions — the importer needs them to read the recipe." };
  }
  if (sawUnplayable) {
    return { error: "YouTube wouldn't serve that video to the importer — check the link, or try again in a minute." };
  }
  return { error: "YouTube is blocking the server right now — try again shortly, or paste the recipe as a note instead." };
}

export type ExtractedRecipe = {
  title: string;
  description?: string;
  servings?: string;
  ingredients: { name: string; qty?: string }[];
  steps: string[];
  tags?: string[];
};

const JSON_CONTRACT = `Respond with strict JSON only (no markdown fence, no commentary):
{"title": string, "description": string (1-2 sentences), "servings": string or null, "ingredients": [{"name": string, "qty": string or null}], "steps": [string, ...], "tags": [string, ...]}
Rules: steps are imperative and self-contained; max 60 ingredients, 40 steps, 10 tags.`;

function parseRecipeJson(raw: string): ExtractedRecipe | { error: string } {
  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let candidate: unknown;
  try {
    candidate = JSON.parse(jsonText);
  } catch {
    return { error: "The model returned unusable output — try again." };
  }
  if (candidate && typeof candidate === "object" && "error" in candidate) {
    return { error: "That doesn't look like a recipe." };
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
  if (!checked.success) return { error: "Couldn't produce a usable recipe." };
  const r = checked.data;
  return {
    title: r.title,
    description: r.description || undefined,
    servings: r.servings || undefined,
    ingredients: r.ingredients.map((i) => ({ name: i.name, qty: i.qty || undefined })),
    steps: r.steps,
    tags: r.tags,
  };
}

/**
 * Generate a recipe for a planned dish from the model's own knowledge —
 * for when the cook doesn't know the dish and the household has no saved
 * recipe. Common home dishes are well-covered public knowledge.
 */
export async function generateRecipeForDish(
  dish: string,
  householdNotes?: string
): Promise<ExtractedRecipe | { error: string }> {
  const prompt = `Write a practical home-style recipe for "${dish}" as cooked in an Indian household kitchen. Serves 4 unless the dish implies otherwise. Use commonly available ingredients and simple equipment (pressure cooker, kadai, tawa). Steps must be clear enough for a household cook who has never made this dish.${householdNotes ? ` Household constraints: ${householdNotes}.` : ""}

${JSON_CONTRACT}
If "${dish}" is not a food dish, return {"error": "not a dish"}.`;
  try {
    const res = await llm.chat.completions.create({
      model: LLM_MODEL_FAST,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });
    return parseRecipeJson(res.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    console.error("[recipes-generate] failed", err);
    return { error: "Couldn't generate the recipe — is the LLM key configured?" };
  }
}

export async function extractRecipeFromTranscript(
  videoTitle: string,
  transcript: string,
  sourceKind: "video" | "note" = "video"
): Promise<ExtractedRecipe | { error: string }> {
  const sourceLine =
    sourceKind === "video"
      ? `A cooking video titled "${videoTitle}" has this transcript:`
      : `A recipe note/document titled "${videoTitle}" contains this text:`;
  const prompt = `${sourceLine}

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
    return parseRecipeJson(res.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    console.error("[recipes-import] extraction failed", err);
    return { error: "Couldn't extract the recipe — is the LLM key configured?" };
  }
}
