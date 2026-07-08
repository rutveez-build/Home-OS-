import { llm, LLM_MODEL_FAST } from "./llm";
import { appendMemories } from "@/db/repo";

const PROMPT = `You read the last exchange between a person and a family-OS assistant. Extract 0–3 short, durable facts about the person that would help in future conversations — preferences, ongoing situations, important people, favourites.

Return JSON: { "memories": [{ "kind": "...", "content": "..." }] }
- "kind": "preference" | "fact" | "stressor" | "protective_factor" | "person" | "favourite"
- "content": one short third-person sentence about the user
- If nothing memorable, return { "memories": [] }. Do not invent.
- Skip crisis content (handled elsewhere).`;

const VALID = new Set(["preference", "fact", "stressor", "protective_factor", "person", "favourite"]);

export async function extractAndStoreMemories(args: {
  userId: string;
  sessionId: string;
  userMsg: string;
  assistantMsg: string;
}): Promise<void> {
  if (args.userMsg.trim().length < 8) return;
  try {
    const res = await llm.chat.completions.create({
      model: LLM_MODEL_FAST,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Person:\n${args.userMsg}\n\nAssistant:\n${args.assistantMsg}` },
      ],
      max_tokens: 400,
    });
    const raw = res.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeParse(raw);
    const memories = Array.isArray(parsed?.memories)
      ? parsed.memories
          .filter(
            (m: unknown): m is { kind: string; content: string } =>
              !!m &&
              typeof m === "object" &&
              typeof (m as { kind?: unknown }).kind === "string" &&
              typeof (m as { content?: unknown }).content === "string" &&
              VALID.has((m as { kind: string }).kind) &&
              (m as { content: string }).content.trim().length > 0
          )
          .slice(0, 3)
      : [];
    if (memories.length) await appendMemories(args.userId, args.sessionId, memories);
  } catch (err) {
    console.warn("[extract] failed", err);
  }
}

function safeParse(raw: string): { memories?: unknown[] } | null {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
  return null;
}
