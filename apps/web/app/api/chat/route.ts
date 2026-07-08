import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { messages as messagesTable, sessions, users } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
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

  // Daily cap — protects the shared demo's free LLM quota from one heavy user.
  const cap = Number(process.env.DAILY_MESSAGE_CAP ?? 60);
  if (Number.isFinite(cap) && cap > 0) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .innerJoin(sessions, eq(messagesTable.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, userId),
          eq(messagesTable.role, "user"),
          gte(messagesTable.createdAt, dayStart)
        )
      );
    if (count >= cap) {
      return new Response(
        "You've hit today's message limit on the shared demo — it resets at midnight. Your plans and settings are safe.",
        { status: 429 }
      );
    }
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
