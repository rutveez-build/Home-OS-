// Twilio WhatsApp Business API.
//
// Setup:
//   1. Create a Twilio account; join the WhatsApp sandbox or buy a number.
//   2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
//   3. In Twilio console, set the inbound webhook to
//      https://your-app.com/api/whatsapp/webhook (POST, form-urlencoded).
//
// Docs: www.twilio.com/docs/whatsapp

import type { InboundMessage } from "./index";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

export async function sendViaTwilio(
  toPhone: string,
  body: string
): Promise<void> {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.warn(
      "[twilio] missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN — skipping send"
    );
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  const form = new URLSearchParams({
    From: FROM,
    To: toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`,
    Body: body,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("[twilio] send failed", res.status, detail);
  }
}

// Twilio posts form-urlencoded fields, not JSON. Parse the relevant ones.
export function parseTwilioInbound(form: URLSearchParams): InboundMessage[] {
  const from = form.get("From") ?? ""; // "whatsapp:+91..."
  const body = form.get("Body") ?? undefined;
  const sid = form.get("MessageSid") ?? "";
  const audioUrl = form.get("MediaUrl0") ?? undefined;
  const ts = form.get("DateSent");
  return [
    {
      fromPhone: from.replace(/^whatsapp:/, ""),
      text: body || undefined,
      audioUrl: audioUrl && audioUrl.includes("audio") ? audioUrl : undefined,
      imageUrl: audioUrl && audioUrl.includes("image") ? audioUrl : undefined,
      providerMessageId: sid,
      receivedAt: ts ? new Date(ts) : new Date(),
    },
  ];
}
