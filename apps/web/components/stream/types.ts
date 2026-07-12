// Shared domain types for the stream screens. Mirrors the /api/app/* wire
// shapes; HouseholdApp re-exports its state through these.

export type Member = { name: string; note?: string };
export type Profile = {
  members: Member[];
  diets: string[];
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  budgetBand: string | null;
  mealScope: "d" | "ld" | "bld";
};
export type Cook = {
  name: string;
  phone: string | null;
  language: string;
  frequency: string;
} | null;
export type PlanEntry = {
  day: number;
  meal: "breakfast" | "lunch" | "dinner";
  dish: string;
  notes: string | null;
};
export type Plan = {
  id: string;
  weekStart: string;
  status: "draft" | "approved" | "discarded";
  entries: PlanEntry[];
} | null;
export type ShoppingItem = { name: string; qty: string; category: string; substitute?: string };
export type Feedback = {
  id: string;
  dish: string;
  meal: "breakfast" | "lunch" | "dinner";
  cooked: "cooked" | "skipped";
  verdict: "liked" | "ok" | "disliked" | null;
  leftovers: "none" | "some" | "lots" | null;
  note: string | null;
  createdAt: string;
};
export type Family = { id: string; name: string; role: string } | null;

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 };
export const MEAL_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
