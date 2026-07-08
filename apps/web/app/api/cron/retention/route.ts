// Retention purge (DPDP data-minimisation): delete raw chat messages older
// than RETENTION_DAYS (default 90). Structured household data and extracted
// memories survive — they're the product; stale transcripts are liability.
// Scheduled via vercel.json cron; callable manually with the CRON_SECRET.

import { NextRequest } from "next/server";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const days = Number(process.env.RETENTION_DAYS ?? 90);
  if (!Number.isFinite(days) || days < 7) {
    return new Response("RETENTION_DAYS must be ≥ 7", { status: 400 });
  }

  const cutoff = new Date(Date.now() - days * 86400000);
  const deleted = await db
    .delete(messages)
    .where(lt(messages.createdAt, cutoff))
    .returning({ id: messages.id });

  await logAudit({
    actor: "system",
    action: "retention.purged",
    subjectType: "messages",
    channel: "system",
    detail: { deleted: deleted.length, olderThanDays: days },
  });

  return Response.json({ deleted: deleted.length, olderThanDays: days });
}
