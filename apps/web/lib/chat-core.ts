// Channel-agnostic chat brain. Web (/api/chat) and WhatsApp
// (/api/whatsapp/webhook) both call this. Same persistence, same memory,
// same model — different transport.

import { llm, resolveModel, isReasoningModel } from "./llm";
import { buildSystemPrompt } from "./system-prompt";
import {
  appendMessage,
  familiesForUser,
  getOrCreateActiveSession,
  recentMemoriesForUser,
  recentMessagesForUser,
} from "@/db/repo";
import type { Message } from "@/db/schema";
import { extractAndStoreMemories } from "./extract-memories";

export type RunChatArgs = {
  userId: string;
  userName: string;
  language: string;
  channel: "web" | "whatsapp";
  text: string;
  requestedModel?: string;
  providerMessageId?: string;
};

const CONTEXT_TURN_LIMIT = 30;
const MEMORY_LIMIT = 20;

// Stream chat tokens through `onToken`. Returns the full assistant reply
// when the stream closes. Persists everything to DB; runs memory extraction
// fire-and-forget in the background.
export async function runChatTurn(
  args: RunChatArgs,
  onToken: (chunk: string) => void
): Promise<string> {
  const model = resolveModel(args.requestedModel);
  const session = await getOrCreateActiveSession(args.userId, args.channel);

  // Persist user message immediately (don't lose it if the LLM fails).
  await appendMessage({
    sessionId: session.id,
    role: "user",
    content: args.text,
    providerMessageId: args.providerMessageId,
  });

  // Load context: cross-session history + memories + family context.
  const [mems, hist, families] = await Promise.all([
    recentMemoriesForUser(args.userId, MEMORY_LIMIT),
    recentMessagesForUser(args.userId, CONTEXT_TURN_LIMIT),
    familiesForUser(args.userId),
  ]);

  const familyName = families[0]?.family.name;
  const memoryBlock = mems.length
    ? `\n\nCONTEXT — WHAT YOU REMEMBER ABOUT THIS PERSON (from past conversations)\nReference naturally only when relevant. Never recite verbatim.\n${mems
        .map((m) => `- (${m.kind}) ${m.content}`)
        .join("\n")}`
    : "";

  const systemPrompt =
    buildSystemPrompt({
      userName: args.userName,
      language: args.language,
      familyName,
    }) + memoryBlock;

  // Build the prompt: system → trimmed history → (don't double-add the just-saved user turn).
  const historyForLLM = hist
    .filter((m: Message) => m.role === "user" || m.role === "assistant")
    .map((m: Message) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // Avoid duplicating the just-stored user turn.
  if (historyForLLM[historyForLLM.length - 1]?.content === args.text) {
    historyForLLM.pop();
  }

  const params: Parameters<typeof llm.chat.completions.create>[0] = {
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...historyForLLM,
      { role: "user", content: args.text },
    ],
  };
  if (!isReasoningModel(model)) {
    params.temperature = 0.6;
  }

  const stream = await llm.chat.completions.create(params);
  let acc = "";
  try {
    // @ts-expect-error — stream iterator typed loosely
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        acc += delta;
        onToken(delta);
      }
    }
  } catch (err) {
    console.error("[chat-core] stream error", err);
  }

  if (acc) {
    // Fire-and-forget: persist + extract memories in background.
    (async () => {
      try {
        await appendMessage({
          sessionId: session.id,
          role: "assistant",
          content: acc,
          model,
        });
        await extractAndStoreMemories({
          userId: args.userId,
          sessionId: session.id,
          userMsg: args.text,
          assistantMsg: acc,
        });
      } catch (err) {
        console.warn("[chat-core] post-stream persistence failed", err);
      }
    })();
  }

  return acc;
}
