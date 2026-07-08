// OpenAI Whisper ASR. Strong on English, decent on others.
// Docs: platform.openai.com/docs/guides/speech-to-text

const API_KEY = process.env.OPENAI_API_KEY;

export async function transcribeWithWhisper(audioUrl: string): Promise<string | null> {
  if (!API_KEY) {
    console.warn("[whisper] OPENAI_API_KEY missing");
    return null;
  }
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`audio fetch failed: ${audioRes.status}`);
  const blob = await audioRes.blob();

  const form = new FormData();
  form.set("file", blob, "audio.ogg");
  form.set("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    console.error("[whisper] STT failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { text?: string };
  return json.text ?? null;
}
