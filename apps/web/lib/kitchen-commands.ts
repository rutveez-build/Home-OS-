// Kitchen slash commands — the Phase 1 concierge loop, channel-agnostic:
//   /plan week | show | approve | change | cook | cook send | shopping
//   /household show | diets | allergies | dislikes | cuisines | budget | meals
//   /cook set | show
// Deterministic workflows with explicit approval gates; LLM tool-calling can
// layer on later without changing these flows.

import { familiesForUser } from "@/db/repo";
import {
  approvePlan,
  getCook,
  getProfile,
  latestPlan,
  planEntries,
  updateEntryDish,
  upsertCook,
  upsertProfile,
} from "@/db/kitchen-repo";
import type { MealScope, MealSlot } from "@/db/schema";
import { requestApproval, resolveApproval } from "./approvals";
import { logAudit } from "./audit";
import { generateWeeklyPlan, formatPlan, DAY_NAMES } from "./kitchen/planner";
import { draftCookMessage } from "./kitchen/cook-message";
import { buildShoppingList } from "./kitchen/shopping";
import { getProvider } from "./whatsapp";
import type { CommandResult } from "./family-commands";

type Ctx = {
  userId: string;
  channel: "web" | "whatsapp";
  sub: string;
  tail: string;
};

export async function runKitchenCommand(args: {
  userId: string;
  channel: "web" | "whatsapp";
  cmd: string;
  sub?: string;
  tail: string;
}): Promise<CommandResult> {
  const fams = await familiesForUser(args.userId);
  if (!fams.length) {
    return {
      handled: true,
      reply: "Set up your family first: `/family create The Sharmas`.",
    };
  }
  const familyId = fams[0].family.id;
  const ctx: Ctx = { userId: args.userId, channel: args.channel, sub: args.sub ?? "", tail: args.tail };

  if (args.cmd === "plan") return handlePlan(familyId, ctx);
  if (args.cmd === "household") return handleHousehold(familyId, ctx);
  if (args.cmd === "cook") return handleCook(familyId, ctx);
  return { handled: false };
}

/* ─────────── /plan ─────────── */

async function handlePlan(familyId: string, ctx: Ctx): Promise<CommandResult> {
  if (ctx.sub === "week") {
    const res = await generateWeeklyPlan({ familyId, userId: ctx.userId });
    if ("error" in res) return { handled: true, reply: res.error };
    await requestApproval({
      familyId,
      subjectType: "meal_plan",
      subjectId: res.plan.id,
      requestedByUserId: ctx.userId,
    });
    return { handled: true, reply: res.text };
  }

  if (ctx.sub === "show" || ctx.sub === "") {
    const plan = await latestPlan(familyId);
    if (!plan) return { handled: true, reply: "No plan yet. Start with `/plan week`." };
    const entries = await planEntries(plan.id);
    return {
      handled: true,
      reply: `[${plan.status.toUpperCase()}]\n` + formatPlan(plan.weekStart, entries),
    };
  }

  if (ctx.sub === "approve") {
    const plan = await latestPlan(familyId);
    if (!plan) return { handled: true, reply: "Nothing to approve — `/plan week` first." };
    if (plan.status === "approved") return { handled: true, reply: "This plan is already approved." };
    const approved = await approvePlan(plan.id, ctx.userId);
    if (!approved) return { handled: true, reply: "Couldn't approve — was it already handled?" };
    const resolved = await resolveApproval({
      familyId,
      subjectType: "meal_plan",
      subjectId: plan.id,
      resolvedByUserId: ctx.userId,
      decision: "approved",
      channel: ctx.channel,
    });
    if (!resolved) {
      // No pending approval row (e.g. plan seeded outside /plan week) —
      // the ledger must still record the approval.
      await logAudit({
        familyId,
        actorUserId: ctx.userId,
        actor: "user",
        action: "meal_plan.approved",
        subjectType: "meal_plan",
        subjectId: plan.id,
        channel: ctx.channel,
      });
    }
    return {
      handled: true,
      reply:
        "Plan approved ✓\nNext: `/plan cook` to draft the cook's message, `/plan shopping` for the grocery list.",
    };
  }

  if (ctx.sub === "change") {
    // /plan change tue dinner Veg Biryani
    const m = ctx.tail.match(/^(\w{3})\s+(breakfast|lunch|dinner)\s+(.{2,})$/i);
    if (!m) return { handled: true, reply: "Usage: `/plan change TUE dinner Veg Biryani`" };
    const dayIdx = DAY_NAMES.findIndex((d) => d.toLowerCase() === m[1].toLowerCase());
    if (dayIdx < 0) return { handled: true, reply: `Day must be one of ${DAY_NAMES.join("/")}.` };
    const plan = await latestPlan(familyId);
    if (!plan) return { handled: true, reply: "No plan yet — `/plan week` first." };
    const e = await updateEntryDish({
      planId: plan.id,
      day: dayIdx,
      meal: m[2].toLowerCase() as MealSlot,
      dish: m[3].trim(),
    });
    if (!e) return { handled: true, reply: "That day/meal isn't in the plan." };
    await logAudit({
      familyId,
      actorUserId: ctx.userId,
      actor: "user",
      action: "plan.entry_changed",
      subjectType: "meal_plan",
      subjectId: plan.id,
      channel: ctx.channel,
      detail: { day: m[1], meal: m[2], dish: m[3].trim() },
    });
    return { handled: true, reply: `${DAY_NAMES[dayIdx]} ${m[2].toLowerCase()} → ${m[3].trim()} ✓` };
  }

  if (ctx.sub === "cook") {
    const send = ctx.tail.trim().toLowerCase() === "send";
    const draft = await draftCookMessage(familyId);
    if ("error" in draft) return { handled: true, reply: draft.error };

    if (!send) {
      await requestApproval({
        familyId,
        subjectType: "cook_message",
        subjectId: draft.planId,
        requestedByUserId: ctx.userId,
      });
      return {
        handled: true,
        reply: `Draft for ${draft.cookName}:\n\n${draft.text}\n\nReply \`/plan cook send\` to send it on WhatsApp.`,
      };
    }

    // ponytail: send re-drafts (drafts aren't persisted); the sent text is
    // what lands in the audit log. Persist drafts when this bites.
    if (!draft.cookPhone) {
      return { handled: true, reply: "The cook has no phone saved. `/cook set NAME +91... hi` first." };
    }
    await resolveApproval({
      familyId,
      subjectType: "cook_message",
      subjectId: draft.planId,
      resolvedByUserId: ctx.userId,
      decision: "approved",
      channel: ctx.channel,
    });
    await getProvider().sendText(draft.cookPhone, draft.text);
    await logAudit({
      familyId,
      actorUserId: ctx.userId,
      actor: "user",
      action: "cook_message.sent",
      subjectType: "cook_message",
      subjectId: draft.planId,
      channel: "whatsapp",
      detail: { to: draft.cookPhone, text: draft.text },
    });
    return { handled: true, reply: `Sent to ${draft.cookName} ✓` };
  }

  if (ctx.sub === "shopping") {
    const res = await buildShoppingList({ familyId, userId: ctx.userId });
    return { handled: true, reply: "error" in res ? res.error : res.text };
  }

  return {
    handled: true,
    reply: "Try `/plan week`, `/plan show`, `/plan approve`, `/plan change TUE dinner X`, `/plan cook`, `/plan shopping`.",
  };
}

/* ─────────── /household ─────────── */

const LIST_FIELDS = ["diets", "allergies", "dislikes", "cuisines"] as const;

async function handleHousehold(familyId: string, ctx: Ctx): Promise<CommandResult> {
  if (ctx.sub === "" || ctx.sub === "show") {
    const p = await getProfile(familyId);
    if (!p) {
      return {
        handled: true,
        reply:
          "No household profile yet. Set it up:\n`/household diets vegetarian, veg-only tuesdays`\n`/household allergies peanuts`\n`/household cuisines north indian, south indian`\n`/household meals ld` (d = dinner, ld = lunch+dinner, bld = all three)",
      };
    }
    return {
      handled: true,
      reply:
        `Household profile\n` +
        `• Diets: ${p.diets.join(", ") || "—"}\n` +
        `• Allergies: ${p.allergies.join(", ") || "—"}\n` +
        `• Dislikes: ${p.dislikes.join(", ") || "—"}\n` +
        `• Cuisines: ${p.cuisines.join(", ") || "—"}\n` +
        `• Budget: ${p.budgetBand || "—"}\n` +
        `• Meals planned: ${{ d: "dinner only", ld: "lunch + dinner", bld: "breakfast, lunch + dinner" }[p.mealScope]}`,
    };
  }

  if ((LIST_FIELDS as readonly string[]).includes(ctx.sub)) {
    const values = ctx.tail.split(",").map((s) => s.trim()).filter(Boolean);
    if (!values.length) return { handled: true, reply: `Usage: \`/household ${ctx.sub} a, b, c\`` };
    await upsertProfile(familyId, { [ctx.sub]: values });
    return { handled: true, reply: `${cap(ctx.sub)} saved: ${values.join(", ")} ✓` };
  }

  if (ctx.sub === "budget") {
    if (!ctx.tail) return { handled: true, reply: "Usage: `/household budget ₹3500-5000/week`" };
    await upsertProfile(familyId, { budgetBand: ctx.tail });
    return { handled: true, reply: `Budget saved: ${ctx.tail} ✓` };
  }

  if (ctx.sub === "meals") {
    const scope = ctx.tail.trim().toLowerCase();
    if (!["d", "ld", "bld"].includes(scope)) {
      return { handled: true, reply: "Usage: `/household meals d|ld|bld` (dinner / lunch+dinner / all three)" };
    }
    await upsertProfile(familyId, { mealScope: scope as MealScope });
    return { handled: true, reply: `Meal scope saved ✓` };
  }

  return { handled: true, reply: "Try `/household show`, `/household diets …`, `/household allergies …`, `/household meals ld`." };
}

/* ─────────── /cook ─────────── */

async function handleCook(familyId: string, ctx: Ctx): Promise<CommandResult> {
  if (ctx.sub === "set") {
    // /cook set Sunita didi +919845012345 hi once_daily
    const m = ctx.tail.match(/^(.+?)(?:\s+(\+\d{8,15}))?(?:\s+(en|hi|kn|mr|ta|te|bn))?(?:\s+(occasionally|once_daily|twice_daily|thrice_daily|live_in))?$/i);
    if (!m || !m[1]?.trim()) {
      return { handled: true, reply: "Usage: `/cook set NAME [+phone] [hi|en|kn|mr|ta|te|bn] [once_daily|twice_daily|thrice_daily|live_in|occasionally]`" };
    }
    const s = await upsertCook({
      familyId,
      name: m[1].trim(),
      phone: m[2],
      language: m[3]?.toLowerCase(),
      frequency: m[4]?.toLowerCase(),
    });
    return {
      handled: true,
      reply: `Cook saved: ${s.name}${s.phone ? ` · ${s.phone}` : ""} · ${s.language} · ${s.frequency} ✓`,
    };
  }

  if (ctx.sub === "" || ctx.sub === "show") {
    const s = await getCook(familyId);
    if (!s) return { handled: true, reply: "No cook yet. `/cook set Sunita didi +91... hi once_daily`" };
    return {
      handled: true,
      reply: `${s.name}${s.phone ? ` · ${s.phone}` : ""} · language: ${s.language} · ${s.frequency}`,
    };
  }

  return { handled: true, reply: "Try `/cook show` or `/cook set NAME +phone hi once_daily`." };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
