import { NextResponse } from "next/server";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { families, familyMembers, messages, sessions, users } from "@/db/schema";
import { sessionUserId } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

// Operator dashboard data: signups, emails, and light profiling. Gated to
// ADMIN_EMAILS (env). Read-only by design — no admin mutation surface.
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!isAdminEmail(me?.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [allUsers, memberships, msgCounts, [{ signups7d }]] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(500),
    db
      .select({
        userId: familyMembers.userId,
        role: familyMembers.role,
        familyName: families.name,
      })
      .from(familyMembers)
      .innerJoin(families, eq(familyMembers.familyId, families.id)),
    db
      .select({ userId: sessions.userId, count: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .groupBy(sessions.userId),
    db.select({ signups7d: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, weekAgo)),
  ]);

  const memberOf = new Map(memberships.map((m) => [m.userId, m]));
  const msgs = new Map(msgCounts.map((m) => [m.userId, m.count]));

  return NextResponse.json({
    totals: {
      users: allUsers.length,
      signups7d,
      withEmail: allUsers.filter((u) => u.email).length,
      inFamilies: allUsers.filter((u) => memberOf.has(u.id)).length,
    },
    users: allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      language: u.language,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      family: memberOf.get(u.id)?.familyName ?? null,
      role: memberOf.get(u.id)?.role ?? null,
      messages: msgs.get(u.id) ?? 0,
    })),
  });
}
