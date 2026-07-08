// /setup — one command that shows what's configured and the exact next step.
// Stateless checklist, works identically on web chat and WhatsApp, so
// onboarding needs no extra UI or conversation state.

import { familiesForUser } from "@/db/repo";
import { getCook, getProfile } from "@/db/kitchen-repo";
import type { CommandResult } from "./family-commands";

const check = (ok: boolean) => (ok ? "✅" : "⬜");

export async function runSetupCommand(userId: string): Promise<CommandResult> {
  const fams = await familiesForUser(userId);
  const familyId = fams[0]?.family.id;
  const profile = familyId ? await getProfile(familyId) : null;
  const cook = familyId ? await getCook(familyId) : null;

  const llmReady = !!process.env.LLM_API_KEY;
  const waProvider = process.env.WHATSAPP_PROVIDER ?? "none";
  const waReady = waProvider !== "none" && waProvider !== "";

  const steps: Array<[boolean, string, string]> = [
    [!!familyId, "Family created", "`/family create The Sharmas`"],
    [
      !!profile && (profile.diets.length > 0 || profile.allergies.length > 0),
      "Household profile (diets, allergies, meals)",
      "`/household diets vegetarian` · `/household allergies peanuts` · `/household meals ld`",
    ],
    [!!cook, "Cook set up", "`/cook set Sunita didi +919845012345 hi once_daily`"],
    [llmReady, "AI model connected (LLM_API_KEY in .env.local)", "any OpenAI-compatible key — see .env.example"],
    [waReady, "WhatsApp connected (optional)", "set WHATSAPP_PROVIDER in .env.local — web chat works without it"],
  ];

  const done = steps.filter(([ok]) => ok).length;
  const lines = steps.map(([ok, label, hint]) => `${check(ok)} ${label}${ok ? "" : `\n    → ${hint}`}`);

  const next =
    done === steps.length
      ? "You're fully set up. Start the loop: `/plan week`"
      : done >= 3
        ? "Enough to start! Try `/plan week` — remaining items are optional."
        : "Work down the list — each ⬜ shows the exact command.";

  return {
    handled: true,
    reply: `Family OS setup · ${done}/${steps.length} done\n\n${lines.join("\n")}\n\n${next}`,
  };
}
