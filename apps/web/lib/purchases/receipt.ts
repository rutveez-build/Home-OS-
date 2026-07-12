// Structured receipt extraction — turns an uploaded photo into store/items/
// tax/total. Reuses the same OpenAI-compatible vision provider as
// lib/vision/index.ts (VISION_PROVIDER=none skips gracefully — no key
// needed to run the rest of the app, matching the bring-your-own-keys model).
// Web-only by design: the caller passes a data: URL from a browser file
// upload, not a WhatsApp media reference — that ingestion path is deferred
// until there's demonstrated demand for it.

import { z } from "zod";
import { describeImage } from "@/lib/vision";

const ReceiptItem = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().max(40).optional(),
  unitPrice: z.number().nonnegative().optional(),
  lineTotal: z.number().nonnegative().optional(),
});

const ReceiptExtractionSchema = z.object({
  store: z.string().trim().min(1).max(120),
  date: z.string().trim().max(40).optional(), // best-effort ISO-ish; caller falls back to "today" if unparsable
  items: z.array(ReceiptItem).min(1).max(60),
  subtotal: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
});
export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

const PROMPT = `Extract this receipt into strict JSON — no prose, no markdown code fences, just the object. Shape:
{"store": string, "date": string|null (best guess, YYYY-MM-DD), "items": [{"name": string, "quantity": string|null, "unitPrice": number|null, "lineTotal": number|null}], "subtotal": number|null, "tax": number|null, "total": number}
Numbers are plain numbers, no currency symbols or commas. If a field truly isn't legible or present, use null for it (except items and total, which are required).`;

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

export async function extractReceipt(imageDataUrl: string): Promise<{ data: ReceiptExtraction } | { error: string }> {
  if ((process.env.VISION_PROVIDER ?? "none") === "none" || !(process.env.VISION_API_KEY || process.env.LLM_API_KEY)) {
    return { error: "Receipt scanning isn't configured on this Home OS instance — set VISION_PROVIDER and VISION_API_KEY (or LLM_API_KEY) in .env.local." };
  }

  const raw = await describeImage(imageDataUrl, PROMPT);
  if (!raw) return { error: "Couldn't read that image — try a clearer, well-lit photo of the receipt." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { error: "That didn't come back looking like a receipt — try a clearer photo." };
  }

  const result = ReceiptExtractionSchema.safeParse(parsed);
  if (!result.success) return { error: "That didn't come back looking like a receipt — try a clearer photo." };
  return { data: result.data };
}
