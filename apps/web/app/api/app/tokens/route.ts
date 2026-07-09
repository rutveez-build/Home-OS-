import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { listTokens, mintToken } from "@/lib/mcp/token";

export const runtime = "nodejs";

// Never send tokenHash to the client — metadata only.
function toSafe(t: { id: string; label: string; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null }) {
  return { id: t.id, label: t.label, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt };
}

export async function GET() {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "manage_household")) {
    return NextResponse.json({ error: deniedReply("manage_household") }, { status: 403 });
  }
  const tokens = await listTokens(auth.familyId);
  return NextResponse.json({ tokens: tokens.map(toSafe) });
}

const Body = z.object({ label: z.string().trim().min(1).max(60) });

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "manage_household")) {
    return NextResponse.json({ error: deniedReply("manage_household") }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give the connector a label, e.g. \"ChatGPT\"" }, { status: 400 });

  const { token, record } = await mintToken({ familyId: auth.familyId, mintedByUserId: auth.userId, label: parsed.data.label });
  // token is returned exactly once, here — it is never stored in plaintext
  // and never retrievable again after this response.
  return NextResponse.json({ token, record: toSafe(record) });
}
