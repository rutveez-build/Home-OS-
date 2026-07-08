// Vision — interpret images (lab reports, prescriptions, photos).
// Any OpenAI-compatible vision model can plug in here. Defaults to the
// same provider as the chat LLM unless VISION_BASE_URL is set.

import OpenAI from "openai";

const apiKey = process.env.VISION_API_KEY || process.env.LLM_API_KEY;
const baseURL =
  process.env.VISION_BASE_URL || process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const MODEL =
  process.env.VISION_MODEL ?? "moonshot-v1-128k-vision-preview";

const provider = (process.env.VISION_PROVIDER ?? "none") as "kimi" | "openai" | "none";

export async function describeImage(imageUrl: string, instruction = "Describe this image briefly."): Promise<string | null> {
  if (provider === "none") {
    console.warn("[vision] VISION_PROVIDER=none — skipping image");
    return null;
  }
  if (!apiKey) {
    console.warn("[vision] no API key — skipping image");
    return null;
  }
  const client = new OpenAI({ apiKey, baseURL });
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 600,
    });
    return res.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[vision] failed", err);
    return null;
  }
}
