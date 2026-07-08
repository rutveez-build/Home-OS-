// Automatic Speech Recognition — transcribe voice notes.
// Providers:
//   - sarvam:  Indic-native (English, Hindi, Kannada, Tamil, Telugu, …)
//   - whisper: OpenAI Whisper — English-strong
//   - none:    voice notes ignored

import { transcribeWithSarvam } from "./sarvam";
import { transcribeWithWhisper } from "./whisper";

export type ASRProvider = "sarvam" | "whisper" | "none";

export async function transcribe(audioUrl: string): Promise<string | null> {
  const provider = (process.env.ASR_PROVIDER ?? "none") as ASRProvider;
  try {
    switch (provider) {
      case "sarvam":
        return await transcribeWithSarvam(audioUrl);
      case "whisper":
        return await transcribeWithWhisper(audioUrl);
      default:
        console.warn(
          "[asr] ASR_PROVIDER=none — skipping voice note transcription"
        );
        return null;
    }
  } catch (err) {
    console.error("[asr] failed", err);
    return null;
  }
}
