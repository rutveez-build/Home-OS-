// Repository layer — all DB queries live here. API routes call these.

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import {
  families,
  familyInvitations,
  familyMembers,
  memories,
  messages,
  sessions,
  users,
  type Family,
  type FamilyMember,
  type Memory,
  type Message,
  type Session,
  type User,
} from "./schema";

/* ─────────── users ─────────── */

export async function upsertUserByDeviceId(args: {
  deviceId: string;
  name: string;
  language: "en" | "hi" | "kn" | string;
}): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: eq(users.deviceId, args.deviceId),
  });
  if (existing) {
    const [u] = await db
      .update(users)
      .set({ name: args.name, language: args.language, lastSeenAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return u;
  }
  const [created] = await db
    .insert(users)
    .values({
      deviceId: args.deviceId,
      name: args.name,
      language: args.language,
    })
    .returning();
  return created;
}

export async function upsertUserByPhone(args: {
  phone: string;
  name?: string;
  language?: string;
}): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, args.phone),
  });
  if (existing) {
    const [u] = await db
      .update(users)
      .set({
        ...(args.name && { name: args.name }),
        ...(args.language && { language: args.language }),
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return u;
  }
  const [created] = await db
    .insert(users)
    .values({
      phone: args.phone,
      name: args.name ?? "friend",
      language: args.language ?? "en",
    })
    .returning();
  return created;
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const u = await db.query.users.findFirst({ where: eq(users.phone, phone) });
  return u ?? null;
}

/* ─────────── families ─────────── */

export async function createFamily(args: {
  name: string;
  ownerUserId: string;
  city?: string;
}): Promise<Family> {
  const [family] = await db
    .insert(families)
    .values({ name: args.name, city: args.city })
    .returning();
  await db.insert(familyMembers).values({
    familyId: family.id,
    userId: args.ownerUserId,
    role: "owner",
  });
  return family;
}

export async function familiesForUser(userId: string): Promise<Array<{ family: Family; member: FamilyMember }>> {
  const rows = await db
    .select({ family: families, member: familyMembers })
    .from(familyMembers)
    .innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(eq(familyMembers.userId, userId));
  return rows;
}

export async function listFamilyMembers(familyId: string): Promise<
  Array<{ user: User; member: FamilyMember }>
> {
  const rows = await db
    .select({ user: users, member: familyMembers })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, familyId))
    .orderBy(familyMembers.joinedAt);
  return rows;
}

export async function addFamilyMember(args: {
  familyId: string;
  userId: string;
  role: string;
  displayName?: string;
}): Promise<FamilyMember> {
  const [m] = await db
    .insert(familyMembers)
    .values(args)
    .onConflictDoNothing()
    .returning();
  return m;
}

/* ─────────── invitations ─────────── */

export async function createInvitation(args: {
  familyId: string;
  invitedByUserId: string;
  phone: string;
  proposedRole?: string;
  proposedName?: string;
}) {
  const [inv] = await db
    .insert(familyInvitations)
    .values({
      familyId: args.familyId,
      invitedByUserId: args.invitedByUserId,
      phone: args.phone,
      proposedRole: args.proposedRole ?? "member",
      proposedName: args.proposedName,
    })
    .returning();
  return inv;
}

export async function pendingInvitationForPhone(phone: string) {
  return db.query.familyInvitations.findFirst({
    where: and(
      eq(familyInvitations.phone, phone),
      eq(familyInvitations.status, "pending")
    ),
    orderBy: desc(familyInvitations.createdAt),
  });
}

export async function acceptInvitation(invitationId: string) {
  await db
    .update(familyInvitations)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(eq(familyInvitations.id, invitationId));
}

/* ─────────── sessions ─────────── */

export async function getOrCreateActiveSession(
  userId: string,
  channel: "web" | "whatsapp"
): Promise<Session> {
  const recent = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.userId, userId),
      eq(sessions.channel, channel),
      isNull(sessions.endedAt)
    ),
    orderBy: desc(sessions.startedAt),
  });
  if (recent) return recent;
  const [s] = await db.insert(sessions).values({ userId, channel }).returning();
  return s;
}

/* ─────────── messages ─────────── */

export async function appendMessage(args: {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  providerMessageId?: string;
}): Promise<Message> {
  const [m] = await db
    .insert(messages)
    .values({
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      model: args.model ?? null,
      providerMessageId: args.providerMessageId ?? null,
    })
    .returning();
  return m;
}

export async function recentMessagesForUser(
  userId: string,
  limit = 30
): Promise<Message[]> {
  const rows = await db
    .select({
      id: messages.id,
      sessionId: messages.sessionId,
      role: messages.role,
      content: messages.content,
      model: messages.model,
      providerMessageId: messages.providerMessageId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(sessions, eq(messages.sessionId, sessions.id))
    .where(eq(sessions.userId, userId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}

/* ─────────── memories ─────────── */

export async function appendMemories(
  userId: string,
  sourceSessionId: string,
  items: Array<{ kind: string; content: string }>
): Promise<void> {
  if (!items.length) return;
  await db.insert(memories).values(
    items.map((m) => ({
      userId,
      sourceSessionId,
      kind: m.kind,
      content: m.content.slice(0, 500),
    }))
  );
}

export async function recentMemoriesForUser(
  userId: string,
  limit = 20
): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), isNull(memories.redactedAt)))
    .orderBy(desc(memories.createdAt))
    .limit(limit);
}
