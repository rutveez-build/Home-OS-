// Role matrix — enforced at the command boundary, not just stored in schema.
// owner/parent/partner: run the household. elder/member: day-to-day edits.
// child/helper: read-only; helpers additionally only ever receive
// task-scoped messages (the cook handoff), never approvals or exports.

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyMembers, type FamilyRole } from "@/db/schema";

export type Action =
  | "view"
  | "edit_plan" // change dishes on a draft
  | "approve" // approve plans / send cook messages
  | "manage_household" // profile, cook, invitations
  | "export_data"
  | "delete_data";

const MATRIX: Record<FamilyRole, Action[]> = {
  owner: ["view", "edit_plan", "approve", "manage_household", "export_data", "delete_data"],
  parent: ["view", "edit_plan", "approve", "manage_household", "export_data"],
  partner: ["view", "edit_plan", "approve", "manage_household", "export_data"],
  elder: ["view", "edit_plan"],
  member: ["view", "edit_plan"],
  child: ["view"],
  helper: ["view"],
};

export async function roleInFamily(userId: string, familyId: string): Promise<FamilyRole | null> {
  const m = await db.query.familyMembers.findFirst({
    where: and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, familyId)),
    columns: { role: true },
  });
  return m?.role ?? null;
}

export function can(role: FamilyRole | null, action: Action): boolean {
  if (!role) return false;
  return MATRIX[role].includes(action);
}

export function deniedReply(action: Action): string {
  const what: Record<Action, string> = {
    view: "view this",
    edit_plan: "edit the plan",
    approve: "approve or send things",
    manage_household: "change household settings",
    export_data: "export household data",
    delete_data: "delete household data",
  };
  return `Only a parent or owner can ${what[action]}. Ask them to run this command.`;
}
