// Sarvam ASR — Indic-native speech recognition.
// Docs: docs.sarvam.ai
//
// This is a thin scaffold. Adapt to your audio source: WhatsApp media URLs
// may need a signed redirect or a token fetch first (Meta) vs a public URL
// (Twilio). For voice notes that are not already accessible publicly, you
// need to fetch the bytes server-side and post them as multipart.

const API_KEY = process.env.SARVAM_API_KEY;
const BASE_URL = "https://api.sarvam.ai";

export async function transcribeWithSarvam(audioUrl: string): Promise<string | null> {
  if (!API_KEY) {
    console.warn("[sarvam] SARVAM_API_KEY missing");
    return null;
  }
  // Fetch audio bytes. If your provider's URL needs auth, add headers here.
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`audio fetch failed: ${audioRes.status}`);
  const blob = await audioRes.blob();

  const form = new FormData();
  form.set("file", blob, "audio.ogg");
  form.set("model", "saarika:v2");
  form.set("language_code", "unknown"); // auto-detect among supported Indic
  form.set("with_timestamps", "false");

  const res = await fetch(`${BASE_URL}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": API_KEY },
    body: form,
  });
  if (!res.ok) {
    console.error("[sarvam] STT failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { transcript?: string };
  return json.transcript ?? null;
}
