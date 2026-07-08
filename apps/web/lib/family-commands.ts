// In-chat slash commands for managing the family from WhatsApp.
//
// Supported (v0):
//   /family            Show this family
//   /family create NAME    Start a new family (you become owner)
//   /family invite NAME PHONE [as ROLE]   Invite by phone (E.164)
//   /family list       List members
//
// Tap into runCommandIfAny() from your inbound handler to short-circuit
// the LLM when the user sends one of these.

import {
  acceptInvitation,
  addFamilyMember,
  createFamily,
  createInvitation,
  familiesForUser,
  findUserByPhone,
  listFamilyMembers,
  pendingInvitationForPhone,
  upsertUserByPhone,
} from "@/db/repo";
import { getProvider } from "./whatsapp";

export type CommandResult = {
  handled: boolean;
  reply?: string;
};

export async function runCommandIfAny(args: {
  userId: string;
  userPhone?: string;
  text: string;
}): Promise<CommandResult> {
  const t = args.text.trim();
  if (!t.startsWith("/")) return { handled: false };

  const [cmd, sub, ...rest] = t.slice(1).split(/\s+/);
  const tail = rest.join(" ");

  if (cmd === "family") {
    return await handleFamily({ ...args, sub, tail });
  }
  if (cmd === "yes") {
    return await handleYes({ userPhone: args.userPhone });
  }
  return { handled: false };
}

async function handleFamily(args: {
  userId: string;
  userPhone?: string;
  sub?: string;
  tail: string;
}): Promise<CommandResult> {
  const sub = args.sub ?? "";
  if (sub === "" || sub === "show") {
    const fams = await familiesForUser(args.userId);
    if (!fams.length) {
      return {
        handled: true,
        reply: "You're not in a family yet. Try `/family create The Sharmas`.",
      };
    }
    const family = fams[0].family;
    const members = await listFamilyMembers(family.id);
    const lines = members.map(
      (m) => `• ${m.user.name} (${m.member.role})`
    );
    return {
      handled: true,
      reply: `${family.name}\n${lines.join("\n") || "(no members yet)"}`,
    };
  }

  if (sub === "create") {
    if (!args.tail) return { handled: true, reply: "Usage: `/family create The Sharmas`" };
    const family = await createFamily({
      name: args.tail,
      ownerUserId: args.userId,
    });
    return {
      handled: true,
      reply: `${family.name} created. You're the owner. Add someone with \`/family invite Asha +919876543210\`.`,
    };
  }

  if (sub === "invite") {
    // /family invite Asha +91987... as parent
    const m = args.tail.match(
      /^(\S+(?:\s+\S+)*?)\s+(\+\d{8,15})(?:\s+as\s+(\w+))?$/i
    );
    if (!m) {
      return {
        handled: true,
        reply: "Usage: `/family invite NAME +PHONE [as ROLE]`",
      };
    }
    const [, name, phone, role] = m;
    const fams = await familiesForUser(args.userId);
    if (!fams.length) {
      return { handled: true, reply: "Create a family first: `/family create NAME`." };
    }
    const family = fams[0].family;
    await createInvitation({
      familyId: family.id,
      invitedByUserId: args.userId,
      phone,
      proposedRole: role ?? "member",
      proposedName: name,
    });
    // Fire a WhatsApp invite to that phone.
    const wa = getProvider();
    await wa.sendText(
      phone,
      `Hi ${name} — you've been invited to join "${family.name}" on the family assistant. Reply YES to join.`
    );
    return {
      handled: true,
      reply: `Invited ${name} at ${phone}. We'll let you know when they accept.`,
    };
  }

  if (sub === "list") {
    const fams = await familiesForUser(args.userId);
    if (!fams.length) return { handled: true, reply: "You're not in any family yet." };
    const lines: string[] = [];
    for (const { family } of fams) {
      const members = await listFamilyMembers(family.id);
      lines.push(`${family.name}: ${members.map((m) => m.user.name).join(", ")}`);
    }
    return { handled: true, reply: lines.join("\n") };
  }

  return { handled: true, reply: "Try `/family`, `/family create NAME`, `/family invite NAME +PHONE`, or `/family list`." };
}

async function handleYes(args: { userPhone?: string }): Promise<CommandResult> {
  if (!args.userPhone) return { handled: false };
  const inv = await pendingInvitationForPhone(args.userPhone);
  if (!inv) return { handled: false }; // let the LLM handle it normally
  const user = await upsertUserByPhone({
    phone: args.userPhone,
    name: inv.proposedName ?? "friend",
  });
  await addFamilyMember({
    familyId: inv.familyId,
    userId: user.id,
    role: inv.proposedRole,
    displayName: inv.proposedName ?? undefined,
  });
  await acceptInvitation(inv.id);
  return {
    handled: true,
    reply: `Welcome to the family. I'm here whenever you need anything.`,
  };
}

// Helper: did this number already have an account?
export async function isExistingUser(phone: string) {
  return (await findUserByPhone(phone)) !== null;
}
