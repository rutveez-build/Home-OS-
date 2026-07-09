// Family OS — schema
//
// Mental model:
//   - A family is a household. It has one or more members.
//   - A user is a person. They join a family as a member with a role
//     (owner, parent, partner, child, elder, helper).
//   - A user is identified by a phone (for WhatsApp) and/or a device id
//     (for the web app). Either is enough to start.
//   - Conversations belong to a user; the assistant knows which family
//     the user is part of and can share *family-scoped* context (e.g.
//     household preferences) while keeping each member's chat private.

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ─────────── closed vocabularies ─────────── */
// ponytail: TS unions + runtime checks at the boundaries; upgrade to pg enums
// when the schema stabilises (enum ALTERs are painful while roles are in flux).
export const FAMILY_ROLES = ["owner", "parent", "partner", "child", "elder", "helper", "member"] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];
export const INVITATION_STATUSES = ["pending", "accepted", "declined", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export type Channel = "web" | "whatsapp";
export type MessageRole = "user" | "assistant" | "system";

/* ─────────── families ─────────── */
export const families = pgTable("families", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Household-scoped preferences (shared across members): dietary, festivals,
  // staff schedules, vendor preferences. Member-scoped facts live in
  // `member_profiles` (TODO when product matures).
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}).notNull(),
});

/* ─────────── users (a single person) ─────────── */
// Either device_id or phone is enough to identify. Both can co-exist.
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceId: text("device_id").unique(),
    phone: text("phone").unique(), // E.164, e.g. "+919876543210"
    email: text("email").unique(), // demo accounts: email + password login
    passwordHash: text("password_hash"), // bcrypt; null for device/WhatsApp-only users
    name: text("name").notNull().default("friend"),
    language: text("language").notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceIdx: index("users_device_id_idx").on(t.deviceId),
    phoneIdx: index("users_phone_idx").on(t.phone),
  })
);

/* ─────────── family_members ─────────── */
export const familyMembers = pgTable(
  "family_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<FamilyRole>().notNull().default("member"),
    displayName: text("display_name"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("family_member_user_unique").on(t.familyId, t.userId),
    familyIdx: index("family_members_family_idx").on(t.familyId),
    userIdx: index("family_members_user_idx").on(t.userId),
  })
);

/* ─────────── family_invitations ─────────── */
// Pending invites (e.g. owner asked to add a partner; we sent a WhatsApp
// message and are waiting for them to reply YES).
export const familyInvitations = pgTable("family_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  proposedRole: text("proposed_role").$type<FamilyRole>().notNull().default("member"),
  proposedName: text("proposed_name"),
  status: text("status").$type<InvitationStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

/* ─────────── sessions ─────────── */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").$type<Channel>().notNull().default("web"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    summary: text("summary"),
  },
  (t) => ({ userIdx: index("sessions_user_id_idx").on(t.userId) })
);

/* ─────────── messages ─────────── */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").$type<MessageRole>().notNull(),
    content: text("content").notNull(),
    model: text("model"),
    // Provider message id (e.g. WhatsApp msg id) for ack/dedupe.
    providerMessageId: text("provider_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("messages_session_id_idx").on(t.sessionId),
    providerIdx: uniqueIndex("messages_provider_id_unique").on(t.providerMessageId),
  })
);

/* ─────────── memories (member-scoped) ─────────── */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    sourceSessionId: uuid("source_session_id").references(() => sessions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    redactedAt: timestamp("redacted_at", { withTimezone: true }),
  },
  (t) => ({ userIdx: index("memories_user_id_idx").on(t.userId) })
);

/* ─────────── kitchen: household profile (structured memory) ─────────── */
// Hard constraints for meal planning. Soft chat-extracted facts stay in
// `memories`; these fields are the source of truth the planner obeys.
export type MealScope = "d" | "ld" | "bld"; // dinner | lunch+dinner | all three
export type HouseholdMember = { name: string; note?: string }; // display-only roster, not a login/account
export const householdProfiles = pgTable("household_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id")
    .notNull()
    .unique()
    .references(() => families.id, { onDelete: "cascade" }),
  members: jsonb("members").$type<HouseholdMember[]>().default([]).notNull(), // e.g. [{name:"Aarav", note:"8"}]
  diets: jsonb("diets").$type<string[]>().default([]).notNull(), // e.g. ["vegetarian", "veg-only tuesdays"]
  allergies: jsonb("allergies").$type<string[]>().default([]).notNull(), // hard constraints, never violated
  dislikes: jsonb("dislikes").$type<string[]>().default([]).notNull(),
  cuisines: jsonb("cuisines").$type<string[]>().default([]).notNull(),
  budgetBand: text("budget_band"),
  mealScope: text("meal_scope").$type<MealScope>().notNull().default("ld"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────── kitchen: staff (cook/helper) ─────────── */
export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"), // E.164; optional until WhatsApp coordination is on
  language: text("language").notNull().default("hi"),
  frequency: text("frequency").notNull().default("once_daily"),
  // 'occasionally' | 'once_daily' | 'twice_daily' | 'thrice_daily' | 'live_in'
  workingDays: jsonb("working_days").$type<number[]>().default([1, 2, 3, 4, 5, 6]).notNull(), // 0=Sun
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────── kitchen: meal plans ─────────── */
export type PlanStatus = "draft" | "approved" | "discarded";
export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(), // ISO date (YYYY-MM-DD), Monday
    status: text("status").$type<PlanStatus>().notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => ({ familyIdx: index("meal_plans_family_idx").on(t.familyId) })
);

export type MealSlot = "breakfast" | "lunch" | "dinner";
export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    day: integer("day").notNull(), // 0=Mon … 6=Sun within the plan week
    meal: text("meal").$type<MealSlot>().notNull(),
    dish: text("dish").notNull(),
    notes: text("notes"), // "veg-only tuesday", "uses leftover batter", …
  },
  (t) => ({
    planIdx: index("meal_plan_entries_plan_idx").on(t.planId),
    uniq: uniqueIndex("meal_plan_entries_slot_unique").on(t.planId, t.day, t.meal),
  })
);

/* ─────────── approvals (reused by every skill) ─────────── */
export type ApprovalStatus = "pending" | "approved" | "declined" | "expired";
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(), // 'meal_plan' | 'cook_message' | 'shopping_list' | …
    subjectId: text("subject_id").notNull(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => ({ familyIdx: index("approvals_family_idx").on(t.familyId) })
);

/* ─────────── audit log (append-only trust ledger) ─────────── */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actor: text("actor").notNull(), // 'user' | 'system'
    action: text("action").notNull(), // 'plan.approved', 'cook_message.sent', 'list.exported', …
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    channel: text("channel"), // 'web' | 'whatsapp' | 'system'
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ familyIdx: index("audit_log_family_idx").on(t.familyId) })
);

/* ─────────── kitchen: shopping lists ─────────── */
export type ShoppingItem = { name: string; qty: string; category: string; substitute?: string };
export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  // ponytail: items as jsonb, not rows — lists are read/exported whole;
  // promote to a table when per-item state (bought/substituted) arrives.
  items: jsonb("items").$type<ShoppingItem[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────── kitchen: meal feedback (the retention flywheel) ─────────── */
// One row per meal outcome. The planner reads recent rows so next week's
// plan visibly learns: disliked dishes drop, leftover-heavy dishes shrink.
export const mealFeedback = pgTable(
  "meal_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => mealPlans.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    dish: text("dish").notNull(),
    meal: text("meal").$type<MealSlot>().notNull(),
    cooked: text("cooked").notNull(), // 'cooked' | 'skipped'
    verdict: text("verdict"), // 'liked' | 'ok' | 'disliked'
    leftovers: text("leftovers"), // 'none' | 'some' | 'lots'
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ familyIdx: index("meal_feedback_family_idx").on(t.familyId) })
);

/* ─────────── consents (DPDP ledger) ─────────── */
// One row per member × data category. Withdrawal is a timestamp, not a
// delete — the Act requires provable notice/consent history.
export const CONSENT_CATEGORIES = [
  "household_data", // profile, preferences, plans
  "health_data", // allergies, dietary-medical hints
  "staff_messaging", // sending WhatsApp messages to cook/helpers
  "child_data", // members flagged as children
] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").$type<ConsentCategory>().notNull(),
    purpose: text("purpose").notNull(),
    noticeVersion: text("notice_version").notNull().default("v1"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => ({
    familyIdx: index("consents_family_idx").on(t.familyId),
    uniq: uniqueIndex("consents_member_category_unique").on(t.familyId, t.userId, t.category),
  })
);

/* ─────────── household_tokens (MCP / assistant-surface auth) ─────────── */
// A bearer token minted from the web app, one household per token, used by
// external MCP clients (ChatGPT, Claude, Codex). Only the HMAC hash is
// stored — the plaintext is shown once at mint time and never retrievable
// again. Effective permissions come from mintedByUserId's live role, so a
// role change or member removal takes effect immediately, no stale grants.
export const householdTokens = pgTable(
  "household_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    mintedByUserId: uuid("minted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // e.g. "ChatGPT", "Claude Desktop"
    tokenHash: text("token_hash").notNull(), // HMAC-SHA256(MCP_TOKEN_SECRET, token)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    familyIdx: index("household_tokens_family_idx").on(t.familyId),
    hashUnique: uniqueIndex("household_tokens_hash_unique").on(t.tokenHash),
  })
);

/* ─────────── OAuth (dynamic client registration for claude.ai / ChatGPT web connectors) ─────────── */
// A thin standards layer in front of household_tokens: the /authorize +
// /token dance ends by minting the exact same hos_ token mintToken() already
// produces from the Connect screen. Public clients only (PKCE, no secret) —
// that's what ChatGPT/claude.ai's connector registration expects.
export const oauthClients = pgTable("oauth_clients", {
  id: uuid("id").defaultRandom().primaryKey(), // this IS the client_id
  clientName: text("client_name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One-time-use authorization codes, short-lived. familyId/userId are fixed
// at consent time (the household the logged-in approver picked); the token
// endpoint never re-derives them from anything client-supplied.
export const oauthAuthCodes = pgTable(
  "oauth_auth_codes",
  {
    code: text("code").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => ({ clientIdx: index("oauth_auth_codes_client_idx").on(t.clientId) })
);

/* ─────────── types ─────────── */
export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type FamilyInvitation = typeof familyInvitations.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type HouseholdProfile = typeof householdProfiles.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type MealPlan = typeof mealPlans.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type Consent = typeof consents.$inferSelect;
export type MealFeedback = typeof mealFeedback.$inferSelect;
export type HouseholdToken = typeof householdTokens.$inferSelect;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type OAuthAuthCode = typeof oauthAuthCodes.$inferSelect;
