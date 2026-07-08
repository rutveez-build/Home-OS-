// Meta WhatsApp Cloud API client (the free, direct option).
//
// Setup:
//   1. Verify your business at business.facebook.com.
//   2. Create a WhatsApp Business Account (WABA) and claim a phone number.
//   3. Generate a permanent access token (System User → Generate Token).
//   4. Set webhook callback URL to https://your-app.com/api/whatsapp/webhook
//      with verify token = META_WEBHOOK_VERIFY_TOKEN.
//   5. Subscribe the webhook to "messages" field.
//
// Docs: developers.facebook.com/docs/whatsapp/cloud-api

import crypto from "node:crypto";
import type { InboundMessage } from "./index";

const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET ?? "";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

export async function sendViaMetaCloud(
  toPhone: string,
  body: string
): Promise<void> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn(
      "[meta-cloud] missing META_PHONE_NUMBER_ID or META_ACCESS_TOKEN — skipping send"
    );
    return;
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone.replace(/^\+/, ""),
      type: "text",
      text: { body, preview_url: false },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("[meta-cloud] send failed", res.status, detail);
  }
}

// Verify X-Hub-Signature-256 from inbound webhook (Meta signs with APP_SECRET).
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  if (!APP_SECRET) return true; // skip if not configured (dev mode)
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  const provided = signatureHeader.replace("sha256=", "");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch {
    return false;
  }
}

// Parse the messages out of a Meta webhook payload.
// Meta sends a nested structure: entry[].changes[].value.messages[].
export function parseMetaInbound(payload: unknown): InboundMessage[] {
  type MetaPayload = {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id: string;
            from: string;
            timestamp: string;
            type: string;
            text?: { body: string };
            audio?: { id: string };
            image?: { id: string };
          }>;
        };
      }>;
    }>;
  };
  const p = payload as MetaPayload;
  const out: InboundMessage[] = [];
  for (const e of p.entry ?? []) {
    for (const c of e.changes ?? []) {
      for (const m of c.value?.messages ?? []) {
        out.push({
          fromPhone: "+" + m.from,
          text: m.text?.body,
          // Media URLs require a second Graph API call to resolve from media id.
          // For the scaffold we surface the id and let the consumer resolve.
          audioUrl: m.audio ? `media:${m.audio.id}` : undefined,
          imageUrl: m.image ? `media:${m.image.id}` : undefined,
          providerMessageId: m.id,
          receivedAt: new Date(Number(m.timestamp) * 1000),
        });
      }
    }
  }
  return out;
}
