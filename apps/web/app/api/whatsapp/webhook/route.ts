// WhatsApp inbound webhook.
//
// Setup:
//   1. Set WHATSAPP_PROVIDER and the provider's creds in .env.local
//   2. Configure the provider's webhook URL → /api/whatsapp/webhook
//      - Meta Cloud: GET verification + POST messages (set Verify Token =
//        META_WEBHOOK_VERIFY_TOKEN)
//      - Twilio: POST form-urlencoded (no GET verify; signature optional)
//
// This route:
//   - Verifies the inbound signature (Meta only)
//   - Parses messages into a unified InboundMessage shape
//   - Maps the sender's phone to a user (creates one if new)
//   - Handles /family slash commands or YES (invitation accept)
//   - Otherwise runs the message through the channel-agnostic chat brain
//   - Replies via the configured WhatsApp provider

import { NextRequest } from "next/server";
import {
  parseMetaInbound,
  verifyMetaSignature,
} from "@/lib/whatsapp/meta-cloud";
import { parseTwilioInbound } from "@/lib/whatsapp/twilio";
import { getProvider, type InboundMessage } from "@/lib/whatsapp";
import { upsertUserByPhone } from "@/db/repo";
import { runChatTurn } from "@/lib/chat-core";
import { runCommandIfAny } from "@/lib/family-commands";
import { transcribe } from "@/lib/asr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta verification: respond to the GET handshake with hub.challenge if the
// verify token matches.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const provider = getProvider();
  const raw = await req.text();

  // Parse inbound messages based on provider.
  let inbounds: InboundMessage[] = [];
  if (provider.name === "meta_cloud") {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    if (!verifyMetaSignature(raw, sig)) {
      return new Response("Invalid signature", { status: 401 });
    }
    try {
      inbounds = parseMetaInbound(JSON.parse(raw));
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
  } else if (provider.name === "twilio") {
    const form = new URLSearchParams(raw);
    inbounds = parseTwilioInbound(form);
  } else {
    return new Response("WhatsApp provider not configured", { status: 503 });
  }

  // Ack the webhook fast — process each message async.
  // (Production: queue these in Inngest / SQS / etc. instead of doing inline.)
  for (const msg of inbounds) {
    handleOne(msg).catch((err) =>
      console.error("[whatsapp] handler failed", err)
    );
  }
  return new Response("OK", { status: 200 });
}

async function handleOne(msg: InboundMessage) {
  // 1) Resolve text — transcribe voice notes if present.
  let text = msg.text ?? "";
  if (!text && msg.audioUrl) {
    const t = await transcribe(msg.audioUrl);
    if (t) text = t;
  }
  if (!text) {
    // Either an image we can't process yet (vision is a TODO from here),
    // or an empty message. Don't bother the LLM.
    return;
  }

  // 2) Find or create the user by their phone.
  const user = await upsertUserByPhone({ phone: msg.fromPhone });

  // 3) Slash commands short-circuit the LLM.
  const cmd = await runCommandIfAny({
    userId: user.id,
    userPhone: msg.fromPhone,
    text,
  });
  if (cmd.handled && cmd.reply) {
    await getProvider().sendText(msg.fromPhone, cmd.reply);
    return;
  }

  // 4) Run the chat brain. Collect the full reply, then send as one
  // WhatsApp message (the API doesn't stream).
  let acc = "";
  await runChatTurn(
    {
      userId: user.id,
      userName: user.name,
      language: user.language,
      channel: "whatsapp",
      text,
      providerMessageId: msg.providerMessageId,
    },
    (chunk) => {
      acc += chunk;
    }
  );

  if (acc) {
    await getProvider().sendText(msg.fromPhone, acc);
  }
}
