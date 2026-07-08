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
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
    role: text("role").notNull().default("member"),
    // 'owner' | 'parent' | 'partner' | 'child' | 'elder' | 'helper' | 'member'
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
  proposedRole: text("proposed_role").notNull().default("member"),
  proposedName: text("proposed_name"),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

/* ─────────── sessions ─────────── */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("web"), // 'web' | 'whatsapp'
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
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
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

/* ─────────── types ─────────── */
export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type FamilyInvitation = typeof familyInvitations.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
