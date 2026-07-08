// Minimal LLM provider. Any OpenAI-compatible API works — Moonshot (Kimi),
// OpenAI, Mistral, Together, Groq. Set LLM_BASE_URL + LLM_API_KEY in .env.
// The OpenAI SDK is doing the work; we just point it at whatever endpoint.

import OpenAI from "openai";

const apiKey = process.env.LLM_API_KEY;
const baseURL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";

if (!apiKey) {
  console.warn(
    "[llm] LLM_API_KEY is not set — chat requests will fail. " +
      "See .env.example."
  );
}

export const llm = new OpenAI({
  apiKey: apiKey ?? "missing",
  baseURL,
});

export const LLM_MODEL_FAST = process.env.LLM_MODEL ?? "gpt-4o-mini";
export const LLM_MODEL_DEEP = process.env.LLM_MODEL_DEEP ?? LLM_MODEL_FAST;

const ALLOWED_MODELS = new Set(
  [LLM_MODEL_FAST, LLM_MODEL_DEEP].filter(Boolean)
);

export function resolveModel(requested?: string): string {
  if (requested && ALLOWED_MODELS.has(requested)) return requested;
  return LLM_MODEL_FAST;
}

// Some reasoning models (kimi-k2.x, o1) reject custom temperature.
// Conservative: any model whose name suggests reasoning skips the param.
export function isReasoningModel(model: string): boolean {
  return /(^o1|^o3|reasoning|^kimi-k2)/i.test(model);
}
