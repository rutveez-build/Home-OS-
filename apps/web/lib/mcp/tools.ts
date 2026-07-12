// MCP tool contract — Unit 1 of the plugin build.
//
// Pure metadata, no handlers here. Each entry names a tool, its input shape,
// which existing REST route it mirrors (so Unit 4's wiring is a direct
// lookup, not new business logic), and which lib/permissions.ts Action gates
// it. The MCP server (Unit 2) registers these; the handlers (Unit 4) call
// the exact same kitchen-repo/planner/approvals functions the web UI and
// WhatsApp slash-commands already use — one set of rules, three surfaces.
//
// `action: null` marks feedback tools, which are open to every member
// (including read-only roles), matching the existing /feedback chat
// command's behaviour — everything else goes through the normal role check.
//
// No create_household tool: MCP tokens are minted from an *existing*
// household (lib/mcp/token.ts), so a caller with no household could never
// hold a valid token to invoke one with — the tool would be unreachable by
// construction. Onboarding happens on the web app; MCP picks up after.

import { z } from "zod";
import type { Action } from "../permissions";

export type McpToolDef = {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  action: Action | null;
  rest: { method: "GET" | "POST"; path: string };
};

const mealSlot = z.enum(["breakfast", "lunch", "dinner"]);
// Capped well under the numeric(10,2) column ceiling (~99,999,999.99) that
// backs every money field on purchases/purchase_items/known_deals.
const MAX_AMOUNT = 9_999_999;

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "get_household_state",
    description:
      "Read the full current state in one call: household profile, cook, latest meal plan with entries and approval status, and the shopping list if one exists. Call this first in any conversation to know what's already set up.",
    inputShape: {},
    action: "view",
    rest: { method: "GET", path: "/api/app/state" },
  },
  {
    name: "update_household_profile",
    description:
      "Set or change household preferences: family members, diets, allergies (hard constraint — the planner never violates these), disliked ingredients, favourite cuisines, weekly budget, and which meals to plan (dinner only / lunch+dinner / all three). Send only the fields that changed.",
    inputShape: {
      members: z.array(z.object({ name: z.string().trim().min(1).max(60), note: z.string().trim().max(60).optional() })).max(20).optional(),
      diets: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
      allergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
      dislikes: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
      cuisines: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
      budgetBand: z.string().trim().max(60).optional(),
      mealScope: z.enum(["d", "ld", "bld"]).optional(),
    },
    action: "manage_household",
    rest: { method: "POST", path: "/api/app/profile" },
  },
  {
    name: "set_cook",
    description: "Add or update the household cook's name, WhatsApp number, preferred language for menu messages, and how often they come.",
    inputShape: {
      name: z.string().trim().min(1).max(80),
      phone: z.string().trim().regex(/^\+\d{8,15}$/).optional(),
      language: z.enum(["en", "hi", "kn", "ta", "te", "bn"]).optional(),
      frequency: z.enum(["occasionally", "once_daily", "twice_daily", "thrice_daily", "live_in"]).optional(),
      workingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    },
    action: "manage_household",
    rest: { method: "POST", path: "/api/app/cook" },
  },
  {
    name: "create_meal_plan",
    description:
      "Draft a new weekly meal plan from the household's saved diets, allergies, cuisines, and meal scope. Returns a DRAFT — always show it to the human and get their approval via approve_meal_plan before treating it as final.",
    inputShape: {},
    action: "edit_plan",
    rest: { method: "POST", path: "/api/app/plan" },
  },
  {
    name: "change_plan_entry",
    description:
      "Replace one meal's dish on the current plan. Works whether the plan is still a draft or already approved — editing an approved plan does not un-approve it.",
    inputShape: { day: z.number().int().min(0).max(6), meal: mealSlot, dish: z.string().trim().min(2).max(120) },
    action: "edit_plan",
    rest: { method: "POST", path: "/api/app/plan/entry" },
  },
  {
    name: "approve_meal_plan",
    description:
      "Approve the current draft plan. Only call this after the human has seen the plan and explicitly said yes in this conversation — never approve on the assistant's own judgement.",
    inputShape: {},
    action: "approve",
    rest: { method: "POST", path: "/api/app/plan/approve" },
  },
  {
    name: "draft_cook_message",
    description: "Draft tomorrow's menu message for the cook, in their preferred language, including any allergy warning. Returns text only — nothing is sent yet.",
    inputShape: {},
    action: "view",
    rest: { method: "GET", path: "/api/app/cook-message" },
  },
  {
    name: "send_cook_message",
    description:
      "Send the drafted cook message via WhatsApp. Only call this after the human has seen the exact draft text and explicitly approved sending it — never send on the assistant's own judgement.",
    inputShape: {},
    action: "approve",
    rest: { method: "POST", path: "/api/app/cook-message" },
  },
  {
    name: "get_shopping_list",
    description: "Build (or fetch, if already built for this plan) a categorized shopping list from the approved plan, grouped for quick-commerce apps. Export-only — never places an order.",
    inputShape: {},
    action: "view",
    rest: { method: "POST", path: "/api/app/shopping" },
  },
  {
    name: "list_feedback",
    description: "Read recent feedback on cooked meals — what was liked, disliked, skipped, or had leftovers. Open to every household member.",
    inputShape: {},
    action: null,
    rest: { method: "GET", path: "/api/app/feedback" },
  },
  {
    name: "record_feedback",
    description: "Log feedback on a meal: which slot, whether it was cooked or skipped, how it went, leftovers, and an optional note. Feeds directly into next week's plan. Open to every household member.",
    inputShape: {
      meal: mealSlot,
      cooked: z.enum(["cooked", "skipped"]),
      verdict: z.enum(["liked", "ok", "disliked"]).optional(),
      leftovers: z.enum(["none", "some", "lots"]).optional(),
      note: z.string().trim().max(300).optional(),
    },
    action: null,
    rest: { method: "POST", path: "/api/app/feedback" },
  },
  {
    name: "log_purchase",
    description:
      "Log a purchase into the household's purchase memory: store, items, and total (structured data only — this tool doesn't accept a photo; the web app's Purchases tab handles receipt photo uploads). Flags likely duplicates and items bought recently, and notes if a cheaper known deal exists. Open to every household member.",
    inputShape: {
      store: z.string().trim().min(1).max(120),
      purchaseDate: z.string().trim().max(40).optional(),
      items: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(120),
            quantity: z.string().trim().max(40).optional(),
            unitPrice: z.number().nonnegative().max(MAX_AMOUNT).optional(),
            lineTotal: z.number().nonnegative().max(MAX_AMOUNT).optional(),
          })
        )
        .min(1)
        .max(60),
      subtotal: z.number().nonnegative().max(MAX_AMOUNT).optional(),
      tax: z.number().nonnegative().max(MAX_AMOUNT).optional(),
      total: z.number().nonnegative().max(MAX_AMOUNT),
    },
    action: null,
    rest: { method: "POST", path: "/api/app/purchases" },
  },
  {
    name: "find_purchases",
    description: "Search purchase history — answers questions like \"did we already buy sugar?\" or \"where did we last buy batteries?\". Leave query empty to see the most recent purchases. Open to every household member.",
    inputShape: { query: z.string().trim().max(120).optional() },
    action: null,
    rest: { method: "GET", path: "/api/app/purchases" },
  },
  {
    name: "record_known_deal",
    description: "Teach the household a price you saw for an item at a store. Future purchases of that item get compared against it and flagged if this is cheaper. Open to every household member.",
    inputShape: {
      itemName: z.string().trim().min(1).max(120),
      store: z.string().trim().min(1).max(120),
      price: z.number().nonnegative().max(MAX_AMOUNT),
    },
    action: null,
    rest: { method: "POST", path: "/api/app/deals" },
  },
  {
    name: "list_inventory",
    description:
      "Read the kitchen inventory — what's in the pantry/fridge, quantities, categories, and expiry dates (soonest-expiring first). Open to every household member.",
    inputShape: {},
    action: null,
    rest: { method: "GET", path: "/api/app/inventory" },
  },
  {
    name: "update_inventory",
    description:
      "Add, update, or remove a kitchen inventory item by name. Set quantity/category/expiryDate (YYYY-MM-DD) to add or update; set remove=true to take it out. Open to every household member.",
    inputShape: {
      name: z.string().trim().min(1).max(80),
      quantity: z.string().trim().max(40).optional(),
      category: z.string().trim().min(1).max(30).optional(),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      remove: z.boolean().optional(),
    },
    action: null,
    rest: { method: "POST", path: "/api/app/inventory" },
  },
];
