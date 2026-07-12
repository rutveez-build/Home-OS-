// Per-tool handler registry — Unit 4.
//
// Every handler below calls the exact same functions the web UI's /api/app/*
// routes call (db/kitchen-repo, lib/kitchen/*, lib/approvals, lib/consent,
// lib/audit) — no new business logic. Role/action permission is already
// enforced centrally in app/api/mcp/route.ts before a handler ever runs, so
// handlers only replicate the checks that AREN'T role-based: consent state,
// approval/plan status, and the audit trail each mutating action leaves.

import { requestApproval, resolveApproval } from "../approvals";
import { logAudit } from "../audit";
import { hasActiveConsent, recordConsent } from "../consent";
import { draftCookMessage } from "../kitchen/cook-message";
import { listFeedback, recordMealFeedback } from "../kitchen/feedback";
import { generateWeeklyPlan } from "../kitchen/planner";
import { buildShoppingList } from "../kitchen/shopping";
import { recordKnownDeal } from "../purchases/deals";
import { recordPurchase } from "../purchases/memory";
import { findPurchases } from "../purchases/query";
import { getProvider } from "../whatsapp";
import {
  approvePlan,
  getCook,
  getProfile,
  latestPlan,
  latestShoppingList,
  planEntries,
  updateEntryDish,
  upsertCook,
  upsertProfile,
} from "@/db/kitchen-repo";
import type { MealScope, MealSlot } from "@/db/schema";
import type { McpIdentity } from "./context";
import { MCP_TOOLS } from "./tools";

export type ToolResult = { data: unknown } | { error: string };
export type ToolHandler = (args: Record<string, unknown>, identity: McpIdentity) => Promise<ToolResult>;

const s = (v: unknown) => (typeof v === "string" ? v : undefined);
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);

const handlers: Record<string, ToolHandler> = {
  async get_household_state(_args, id) {
    const [profile, cook, plan] = await Promise.all([getProfile(id.familyId), getCook(id.familyId), latestPlan(id.familyId)]);
    const [entries, shoppingList] = await Promise.all([
      plan ? planEntries(plan.id) : Promise.resolve([]),
      plan && plan.status === "approved" ? latestShoppingList(plan.id) : Promise.resolve(null),
    ]);
    return { data: { profile, cook, plan: plan ? { ...plan, entries } : null, shoppingList } };
  },

  async update_household_profile(args, id) {
    const patch = {
      members: Array.isArray(args.members) ? (args.members as { name: string; note?: string }[]) : undefined,
      diets: arr(args.diets),
      allergies: arr(args.allergies),
      dislikes: arr(args.dislikes),
      cuisines: arr(args.cuisines),
      budgetBand: s(args.budgetBand),
      mealScope: s(args.mealScope) as MealScope | undefined,
    };
    const profile = await upsertProfile(id.familyId, patch);
    await recordConsent({ familyId: id.familyId, userId: id.userId, category: "household_data", purpose: "meal planning" });
    if (patch.allergies) {
      await recordConsent({ familyId: id.familyId, userId: id.userId, category: "health_data", purpose: "allergy-safe meal planning" });
    }
    return { data: { profile } };
  },

  async set_cook(args, id) {
    const name = s(args.name);
    if (!name) return { error: "Cook name is required." };
    const cook = await upsertCook({
      familyId: id.familyId,
      name,
      phone: s(args.phone),
      language: s(args.language),
      frequency: s(args.frequency),
      workingDays: Array.isArray(args.workingDays) ? (args.workingDays as number[]) : undefined,
    });
    await recordConsent({ familyId: id.familyId, userId: id.userId, category: "staff_messaging", purpose: "cook coordination on WhatsApp" });
    return { data: { cook } };
  },

  async create_meal_plan(_args, id) {
    const res = await generateWeeklyPlan({ familyId: id.familyId, userId: id.userId });
    if ("error" in res) return { error: res.error };
    await requestApproval({ familyId: id.familyId, subjectType: "meal_plan", subjectId: res.plan.id, requestedByUserId: id.userId });
    const entries = await planEntries(res.plan.id);
    return { data: { plan: { ...res.plan, entries } } };
  },

  async change_plan_entry(args, id) {
    const day = args.day;
    const meal = s(args.meal) as MealSlot | undefined;
    const dish = s(args.dish);
    if (typeof day !== "number" || !meal || !dish) return { error: "day, meal, and dish are required." };
    const plan = await latestPlan(id.familyId);
    if (!plan) return { error: "No plan yet." };
    const entry = await updateEntryDish({ planId: plan.id, day, meal, dish });
    if (!entry) return { error: "That day/meal isn't in the plan." };
    await logAudit({
      familyId: id.familyId,
      actorUserId: id.userId,
      actor: "user",
      action: "plan.entry_changed",
      subjectType: "meal_plan",
      subjectId: plan.id,
      channel: "assistant",
      detail: { day, meal, dish },
    });
    return { data: { entry } };
  },

  async approve_meal_plan(_args, id) {
    const plan = await latestPlan(id.familyId);
    if (!plan) return { error: "Nothing to approve yet." };
    if (plan.status === "approved") return { error: "Already approved." };
    const approved = await approvePlan(plan.id, id.userId);
    if (!approved) return { error: "Couldn't approve — try again." };
    const resolved = await resolveApproval({
      familyId: id.familyId,
      subjectType: "meal_plan",
      subjectId: plan.id,
      resolvedByUserId: id.userId,
      decision: "approved",
      channel: "assistant",
    });
    if (!resolved) {
      await logAudit({
        familyId: id.familyId,
        actorUserId: id.userId,
        actor: "user",
        action: "meal_plan.approved",
        subjectType: "meal_plan",
        subjectId: plan.id,
        channel: "assistant",
      });
    }
    return { data: { plan: approved } };
  },

  async draft_cook_message(_args, id) {
    const draft = await draftCookMessage(id.familyId);
    if ("error" in draft) return { error: draft.error };
    await requestApproval({ familyId: id.familyId, subjectType: "cook_message", subjectId: draft.planId, requestedByUserId: id.userId });
    return { data: { draft } };
  },

  async send_cook_message(_args, id) {
    if (!(await hasActiveConsent(id.familyId, id.userId, "staff_messaging"))) {
      return { error: "Staff messaging consent is withdrawn or missing." };
    }
    const draft = await draftCookMessage(id.familyId);
    if ("error" in draft) return { error: draft.error };
    if (!draft.cookPhone) {
      return { error: "No cook phone saved — add one, or share the draft text with the household to forward manually." };
    }
    await resolveApproval({
      familyId: id.familyId,
      subjectType: "cook_message",
      subjectId: draft.planId,
      resolvedByUserId: id.userId,
      decision: "approved",
      channel: "assistant",
    });
    await getProvider().sendText(draft.cookPhone, draft.text);
    await logAudit({
      familyId: id.familyId,
      actorUserId: id.userId,
      actor: "user",
      action: "cook_message.sent",
      subjectType: "cook_message",
      subjectId: draft.planId,
      channel: "whatsapp",
      detail: { to: draft.cookPhone, text: draft.text },
    });
    return { data: { sent: true, cookName: draft.cookName } };
  },

  async get_shopping_list(_args, id) {
    const res = await buildShoppingList({ familyId: id.familyId, userId: id.userId });
    if ("error" in res) return { error: res.error };
    return { data: res };
  },

  async list_feedback(_args, id) {
    return { data: { feedback: await listFeedback(id.familyId) } };
  },

  async record_feedback(args, id) {
    const meal = s(args.meal) as MealSlot | undefined;
    const cooked = s(args.cooked) as "cooked" | "skipped" | undefined;
    if (!meal || !cooked) return { error: "meal and cooked are required." };
    const res = await recordMealFeedback({
      familyId: id.familyId,
      userId: id.userId,
      meal,
      cooked,
      verdict: s(args.verdict) as "liked" | "ok" | "disliked" | undefined,
      leftovers: s(args.leftovers) as "none" | "some" | "lots" | undefined,
      note: s(args.note),
    });
    return { data: res };
  },

  async log_purchase(args, id) {
    const store = s(args.store);
    const total = typeof args.total === "number" ? args.total : undefined;
    const items = Array.isArray(args.items)
      ? (args.items as { name: string; quantity?: string; unitPrice?: number; lineTotal?: number }[])
      : undefined;
    if (!store || !items?.length || total === undefined) return { error: "store, items, and total are required." };
    const result = await recordPurchase({
      familyId: id.familyId,
      userId: id.userId,
      source: "assistant",
      store,
      purchaseDate: s(args.purchaseDate),
      items,
      subtotal: typeof args.subtotal === "number" ? args.subtotal : undefined,
      tax: typeof args.tax === "number" ? args.tax : undefined,
      total,
    });
    return { data: result };
  },

  async find_purchases(args, id) {
    const matches = await findPurchases({ familyId: id.familyId, itemQuery: s(args.query) });
    return { data: { matches } };
  },

  async record_known_deal(args, id) {
    const itemName = s(args.itemName);
    const store = s(args.store);
    const price = typeof args.price === "number" ? args.price : undefined;
    if (!itemName || !store || price === undefined) return { error: "itemName, store, and price are required." };
    const deal = await recordKnownDeal({ familyId: id.familyId, userId: id.userId, itemName, store, price });
    return { data: { deal } };
  },
};

const notWired: ToolHandler = async () => ({ error: "This tool isn't wired to the backend yet." });

export const HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  MCP_TOOLS.map((t) => [t.name, handlers[t.name] ?? notWired])
);
