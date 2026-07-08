// WhatsApp provider abstraction.
// Two providers ship:
//   - meta_cloud: Meta's Cloud API (direct, free hosting, ~₹0.30/conv in India)
//   - twilio:     Twilio WhatsApp Business (easier for prototypes, US-friendly)
// Add yours by implementing the WhatsAppProvider interface and registering
// in `getProvider()` below.

import { sendViaMetaCloud, verifyMetaSignature } from "./meta-cloud";
import { sendViaTwilio } from "./twilio";

export type InboundMessage = {
  fromPhone: string;          // E.164, e.g. "+919876543210"
  text?: string;              // text message body, if any
  audioUrl?: string;          // media URL (provider-signed) for voice notes
  imageUrl?: string;          // media URL for images
  providerMessageId: string;  // provider's id, for ack/dedupe
  receivedAt: Date;
};

export type WhatsAppProvider = {
  name: "meta_cloud" | "twilio" | "none";
  // Send a plain text message into a 24h service window.
  sendText: (toPhone: string, body: string) => Promise<void>;
  // Verify the inbound webhook signature (defence-in-depth).
  verifySignature?: (rawBody: string, signatureHeader: string) => boolean;
  // Optional: parse provider-specific inbound payload into our InboundMessage.
  parseInbound?: (payload: unknown) => InboundMessage[] | null;
};

const provider = (process.env.WHATSAPP_PROVIDER ?? "none") as
  | "meta_cloud"
  | "twilio"
  | "none";

export function getProvider(): WhatsAppProvider {
  switch (provider) {
    case "meta_cloud":
      return {
        name: "meta_cloud",
        sendText: sendViaMetaCloud,
        verifySignature: verifyMetaSignature,
      };
    case "twilio":
      return {
        name: "twilio",
        sendText: sendViaTwilio,
      };
    default:
      return {
        name: "none",
        sendText: async () => {
          console.warn(
            "[whatsapp] WHATSAPP_PROVIDER=none — message not sent. " +
              "Set WHATSAPP_PROVIDER in .env.local."
          );
        },
      };
  }
}
