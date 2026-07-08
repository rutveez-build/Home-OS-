import { NextRequest } from "next/server";
import { upsertUserByDeviceId } from "@/db/repo";
import { runChatTurn } from "@/lib/chat-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const {
    messages,
    model,
    profile,
  } = (await req.json()) as {
    messages: Msg[];
    model?: string;
    profile: { deviceId: string; name: string; language: string };
  };

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return new Response("Expected last message to be user", { status: 400 });
  }

  const user = await upsertUserByDeviceId({
    deviceId: profile.deviceId,
    name: profile.name,
    language: profile.language,
  });

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
