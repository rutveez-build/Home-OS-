import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runChatTurn } from "@/lib/chat-core";
import { runCommandIfAny } from "@/lib/family-commands";
import { sessionUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(100),
  model: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  // Identity comes from the signed cookie only — never the request body.
  const userId = await sessionUserId();
  if (!userId) {
    return new Response("No session — complete onboarding first", { status: 401 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return new Response("Unknown session user", { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }
  const { messages, model } = parsed.data;

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return new Response("Expected last message to be user", { status: 400 });
  }

  // Slash commands (/plan, /household, /cook, /family) short-circuit the LLM —
  // same deterministic loop on web as on WhatsApp.
  const cmd = await runCommandIfAny({
    userId: user.id,
    userPhone: user.phone ?? undefined,
    text: last.content,
    channel: "web",
  });
  if (cmd.handled && cmd.reply) {
    return new Response(cmd.reply, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        await runChatTurn(
          {
            userId: user.id,
            userName: user.name,
            language: user.language,
            channel: "web",
            text: last.content,
            requestedModel: model,
          },
          (chunk) => controller.enqueue(encoder.encode(chunk))
        );
      } catch (err) {
        console.error("[chat] route failed", err);
        controller.enqueue(
          encoder.encode("\n\n[I lost connection for a moment. Try sending that again — I'm here.]")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
