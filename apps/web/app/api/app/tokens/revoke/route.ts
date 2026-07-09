import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { revokeToken } from "@/lib/mcp/token";

export const runtime = "nodejs";

const Body = z.object({ tokenId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "manage_household")) {
    return NextResponse.json({ error: deniedReply("manage_household") }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid token id" }, { status: 400 });

  const ok = await revokeToken({ familyId: auth.familyId, tokenId: parsed.data.tokenId, revokedByUserId: auth.userId });
  if (!ok) return NextResponse.json({ error: "Token not found or already revoked" }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
