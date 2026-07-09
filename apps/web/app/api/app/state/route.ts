// Bootstrap endpoint — one call hydrates the whole app shell:
// which onboarding step to show, or the home/plan/shopping data if set up.

import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/session";
import { familiesForUser } from "@/db/repo";
import {
  getCook,
  getProfile,
  latestPlan,
  latestShoppingList,
  planEntries,
} from "@/db/kitchen-repo";

export const runtime = "nodejs";

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });

  const fams = await familiesForUser(userId);
  if (!fams.length) {
    return NextResponse.json({ family: null });
  }
  const familyId = fams[0].family.id;
  const role = fams[0].member.role;

  const [profile, cook, plan] = await Promise.all([
    getProfile(familyId),
    getCook(familyId),
    latestPlan(familyId),
  ]);

  const [entries, shoppingList] = await Promise.all([
    plan ? planEntries(plan.id) : Promise.resolve([]),
    plan && plan.status === "approved" ? latestShoppingList(plan.id) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    family: { id: familyId, name: fams[0].family.name, role },
    profile,
    cook,
    plan: plan ? { ...plan, entries } : null,
    shoppingList,
  });
}
