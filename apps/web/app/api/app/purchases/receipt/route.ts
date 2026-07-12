// Extraction preview — parses an uploaded receipt photo into structured
// fields but does NOT save anything. The UI shows the parsed store/items/
// total for the household to review and edit, then POSTs the confirmed
// values to /api/app/purchases to actually record it. Keeps a single write
// path (recordPurchase) for both manual entry and receipt-confirmed entry.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { extractReceipt } from "@/lib/purchases/receipt";

export const runtime = "nodejs";

// Vercel serverless functions cap request bodies around 4.5MB — the client
// downscales the photo before upload (see the Purchases tab), so this is a
// generous ceiling, not the real limit. The pattern requires a base64-encoded
// raster format specifically (not just any "data:image/*" prefix) — an
// authenticated household member could otherwise pass e.g. data:image/svg+xml
// or a non-base64 payload straight through to the vision provider, which
// doesn't validate it's a real image either; this is provider-cost/abuse
// surface, not something worth trusting client-side checks alone for.
const IMAGE_DATA_URL = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const Body = z.object({ imageDataUrl: z.string().trim().min(1).max(6_000_000).regex(IMAGE_DATA_URL, "Must be a base64-encoded JPEG, PNG, WebP, or GIF.") });

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Upload an image." }, { status: 400 });

  const result = await extractReceipt(parsed.data.imageDataUrl);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ extraction: result.data });
}
