import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFamily, isAuthed } from "@/lib/app-api";
import { can, deniedReply } from "@/lib/permissions";
import { createInvitation } from "@/db/repo";
import { getProvider } from "@/lib/whatsapp";
import { FAMILY_ROLES } from "@/db/schema";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().regex(/^\+\d{8,15}$/, "Phone must be E.164, e.g. +919876543210"),
  role: z.enum(FAMILY_ROLES).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireFamily();
  if (!isAuthed(auth)) return auth;
  if (!can(auth.role, "manage_household")) {
    return NextResponse.json({ error: deniedReply("manage_household") }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid invite" },
      { status: 400 }
    );
  }
  const { name, phone, role } = parsed.data;

  await createInvitation({
    familyId: auth.familyId,
    invitedByUserId: auth.userId,
    phone,
    proposedRole: role ?? "member",
    proposedName: name,
  });

  // Best-effort WhatsApp ping; with WHATSAPP_PROVIDER=none this just logs.
  // Same message the /family invite chat command sends.
  await getProvider()
    .sendText(phone, `Hi ${name} — you've been invited to join a household on ${brand.name}. Reply YES to join.`)
    .catch(() => {});

  return NextResponse.json({ invited: { name, phone, role: role ?? "member" } });
}
