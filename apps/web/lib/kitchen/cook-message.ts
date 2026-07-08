// Daily cook handoff: draft tomorrow's menu in the cook's language.
// Draft only — sending happens after explicit approval (/plan cook send).

import { llm, LLM_MODEL_FAST } from "../llm";
import { getCook, getProfile, latestPlan, planEntries } from "@/db/kitchen-repo";
import { DAY_NAMES } from "./planner";

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi", en: "English", kn: "Kannada", mr: "Marathi", ta: "Tamil", te: "Telugu", bn: "Bengali",
};

export async function draftCookMessage(familyId: string): Promise<
  | { text: string; cookName: string; cookPhone: string | null; planId: string }
  | { error: string }
> {
  const plan = await latestPlan(familyId);
  if (!plan || plan.status !== "approved") {
    return { error: "No approved plan yet. Run `/plan week`, then `/plan approve` first." };
  }
  const cook = await getCook(familyId);
  if (!cook) {
    return { error: "No cook set up. Add one with `/cook set NAME [+phone] [lang]`." };
  }

  // "Tomorrow" relative to the plan week: pick the next plan day with entries.
  const entries = await planEntries(plan.id);
  const weekStart = new Date(plan.weekStart + "T00:00:00");
  const now = new Date();
  const dayIdx = Math.min(
    Math.max(Math.floor((now.getTime() - weekStart.getTime()) / 86400000) + 1, 0),
    6
  );
  const dayEntries = entries.filter((e) => e.day === dayIdx);
  const target = dayEntries.length ? dayIdx : entries[0]?.day ?? 0;
  const menu = entries.filter((e) => e.day === target);
  if (!menu.length) return { error: "The approved plan has no entries to send." };

  const profile = await getProfile(familyId);
  const lang = LANG_NAMES[cook.language] ?? cook.language;

  const prompt = `Write a short, warm WhatsApp message to a household cook named ${cook.name}, in ${lang}.
Content:
- Greeting.
- Menu for ${DAY_NAMES[target]}: ${menu.map((m) => `${m.meal}: ${m.dish}`).join("; ")}.
- Critical safety note, must be prominent: allergies in this house: ${profile?.allergies?.join(", ") || "none"}. If none, omit.
- Keep it under 500 characters. Plain text only. No markdown.`;

  try {
    const res = await llm.chat.completions.create({
      model: LLM_MODEL_FAST,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });
    const text = res.choices?.[0]?.message?.content?.trim();
    if (!text) return { error: "Couldn't draft the message. Try again." };
    return { text, cookName: cook.name, cookPhone: cook.phone, planId: plan.id };
  } catch (err) {
    console.error("[cook-message] draft failed", err);
    return { error: "Couldn't draft the cook message just now. Try again in a moment." };
  }
}
