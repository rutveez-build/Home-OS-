"use client";

// The real kitchen-loop UI — matches the approved clickable prototype
// (household setup -> weekly plan -> approve -> cook message -> shopping
// list) wired to the actual backend via /api/app/*. Free-text chat stays
// available as its own tab for anything outside this structured flow.

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { Logo } from "./Logo";

type Member = { name: string; note?: string };
type Profile = {
  members: Member[];
  diets: string[];
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  budgetBand: string | null;
  mealScope: "d" | "ld" | "bld";
};
type Cook = {
  name: string;
  phone: string | null;
  language: string;
  frequency: string;
} | null;
type PlanEntry = { day: number; meal: "breakfast" | "lunch" | "dinner"; dish: string; notes: string | null };
type Plan = { id: string; weekStart: string; status: "draft" | "approved" | "discarded"; entries: PlanEntry[] } | null;
type ShoppingItem = { name: string; qty: string; category: string; substitute?: string };

type Family = { id: string; name: string; role: string } | null;

type Screen = "loading" | "wizard-family" | "wizard-prefs" | "wizard-cook" | "home" | "plan" | "handoff" | "list" | "freechat";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 };
const MEAL_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

async function api<T>(url: string, opts?: RequestInit): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, data: null, error: (data as { error?: string })?.error ?? "Something went wrong" };
  return { ok: true, data };
}

export default function HouseholdApp({ userName }: { userName: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [family, setFamily] = useState<Family>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cook, setCook] = useState<Cook>(null);
  const [plan, setPlan] = useState<Plan>(null);
  const [shoppingList, setShoppingList] = useState<{ items: ShoppingItem[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadState() {
    const res = await api<{
      family: Family;
      profile: Profile | null;
      cook: Cook;
      plan: Plan;
      shoppingList: { items: ShoppingItem[] } | null;
    }>("/api/app/state");
    if (!res.ok || !res.data) return;
    setFamily(res.data.family);
    setProfile(res.data.profile);
    setCook(res.data.cook);
    setPlan(res.data.plan);
    setShoppingList(res.data.shoppingList);

    if (!res.data.family) setScreen("wizard-family");
    else if (!res.data.profile || !res.data.profile.diets.length) setScreen("wizard-prefs");
    else if (!res.data.cook) setScreen("wizard-cook");
    else if (res.data.plan?.status === "draft") setScreen("plan");
    else setScreen("home");
  }

  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? "" : n)), 3200);
  }

  if (screen === "loading") return <div className="flex h-dvh items-center justify-center bg-bg dark:bg-bg-dark"><ThinkingDots /></div>;

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink dark:bg-bg-dark dark:text-white">
      <TopBar family={family} screen={screen} setScreen={setScreen} />
      {notice && (
        <div className="mx-3 mt-2 rounded-xl bg-accent/15 px-3 py-2 text-[13px] font-medium text-accent">{notice}</div>
      )}
      <div className="flex-1 overflow-y-auto">
        {screen === "wizard-family" && (
          <FamilyStep
            onDone={(fam) => {
              setFamily(fam);
              setScreen("wizard-prefs");
            }}
          />
        )}
        {screen === "wizard-prefs" && (
          <PrefsStep
            initial={profile}
            busy={busy}
            onSave={async (patch) => {
              setBusy(true);
              const res = await api<{ profile: Profile }>("/api/app/profile", { method: "POST", body: JSON.stringify(patch) });
              setBusy(false);
              if (res.ok && res.data) {
                setProfile(res.data.profile);
                setScreen("wizard-cook");
              } else flash(res.error ?? "Couldn't save preferences");
            }}
          />
        )}
        {screen === "wizard-cook" && (
          <CookStep
            busy={busy}
            onSave={async (body) => {
              setBusy(true);
              const res = await api<{ cook: Cook }>("/api/app/cook", { method: "POST", body: JSON.stringify(body) });
              setBusy(false);
              if (res.ok && res.data) {
                setCook(res.data.cook);
                setScreen("home");
              } else flash(res.error ?? "Couldn't save cook details");
            }}
            onSkip={() => setScreen("home")}
          />
        )}
        {screen === "home" && (
          <HomeScreen
            userName={userName}
            familyName={family?.name ?? "your household"}
            plan={plan}
            busy={busy}
            onAsk={async () => {
              setBusy(true);
              const res = await api<{ plan: Plan }>("/api/app/plan", { method: "POST" });
              setBusy(false);
              if (res.ok && res.data) {
                setPlan(res.data.plan);
                setScreen("plan");
              } else flash(res.error ?? "Couldn't draft a plan right now");
            }}
            onOpenPlan={() => setScreen("plan")}
            onOpenChat={() => setScreen("freechat")}
          />
        )}
        {screen === "plan" && plan && (
          <PlanScreen
            plan={plan}
            busy={busy}
            onChangeEntry={async (day, meal, dish) => {
              setBusy(true);
              const res = await api<{ entry: PlanEntry }>("/api/app/plan/entry", {
                method: "POST",
                body: JSON.stringify({ day, meal, dish }),
              });
              setBusy(false);
              if (res.ok && res.data) {
                setPlan((p) => (p ? { ...p, entries: p.entries.map((e) => (e.day === day && e.meal === meal ? res.data!.entry : e)) } : p));
              } else flash(res.error ?? "Couldn't change that meal");
            }}
            onApprove={async () => {
              setBusy(true);
              const res = await api<{ plan: Plan }>("/api/app/plan/approve", { method: "POST" });
              setBusy(false);
              if (res.ok && res.data) {
                setPlan((p) => (p ? { ...p, status: "approved" } : p));
                flash("Plan approved ✓");
              } else flash(res.error ?? "Couldn't approve");
            }}
            onCook={() => setScreen("handoff")}
            onShopping={() => setScreen("list")}
          />
        )}
        {screen === "handoff" && (
          <HandoffScreen
            cook={cook}
            busy={busy}
            flash={flash}
            onBack={() => setScreen("plan")}
            onNext={() => setScreen("list")}
          />
        )}
        {screen === "list" && (
          <ListScreen
            shoppingList={shoppingList}
            busy={busy}
            onLoad={async () => {
              setBusy(true);
              const res = await api<{ items: ShoppingItem[] }>("/api/app/shopping", { method: "POST" });
              setBusy(false);
              if (res.ok && res.data) setShoppingList(res.data);
              else flash(res.error ?? "Couldn't build the list");
            }}
            onBack={() => setScreen("plan")}
          />
        )}
        {screen === "freechat" && <FreeChat onBack={() => setScreen(plan ? "plan" : "home")} />}
      </div>
    </div>
  );
}

/* ─────────── shared bits ─────────── */

function TopBar({ family, screen, setScreen }: { family: Family; screen: Screen; setScreen: (s: Screen) => void }) {
  const inWizard = screen.startsWith("wizard");
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line/60 bg-bg/85 px-3 py-2.5 backdrop-blur dark:border-line-dark/60 dark:bg-bg-dark/85">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
        <Logo size={16} />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-[15px] font-semibold tracking-tight">{family?.name ?? brand.name}</span>
      </div>
      {!inWizard && (
        <nav className="flex gap-1 text-[12.5px]">
          {(["home", "plan", "list"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScreen(s)}
              className={`rounded-full px-2.5 py-1 font-medium transition ${
                screen === s ? "bg-brand/10 text-brand" : "text-ink/50 dark:text-white/50"
              }`}
            >
              {s === "home" ? "Home" : s === "plan" ? "Plan" : "Shopping"}
            </button>
          ))}
          <button
            onClick={() => setScreen("freechat")}
            className={`rounded-full px-2.5 py-1 font-medium transition ${
              screen === "freechat" ? "bg-brand/10 text-brand" : "text-ink/50 dark:text-white/50"
            }`}
          >
            Chat
          </button>
        </nav>
      )}
    </header>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition ${
        on
          ? "border-brand bg-brand/10 text-brand"
          : "border-line bg-surface text-ink/70 dark:border-line-dark dark:bg-surface-dark dark:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function ScreenShell({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-6">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-balance">{title}</h1>
      {sub && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65 dark:text-white/65">{sub}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, gold }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; gold?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`block w-full rounded-2xl py-3.5 text-center text-[15.5px] font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50 ${
        gold ? "bg-brand text-white" : "bg-ink text-bg dark:bg-white dark:text-bg-dark"
      }`}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2 block w-full rounded-2xl border border-line py-3 text-center text-[14px] font-medium text-ink/70 dark:border-line-dark dark:text-white/70">
      {children}
    </button>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-ink/40 dark:text-white/40">
      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />
      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current [animation-delay:160ms]" />
      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current [animation-delay:320ms]" />
    </span>
  );
}

/* ─────────── wizard step 1: family + members ─────────── */

function FamilyStep({ onDone }: { onDone: (fam: Family) => void }) {
  const [name, setName] = useState("The Sharmas");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function addMember() {
    const v = memberInput.trim();
    if (!v) return;
    setMembers((m) => [...m, { name: v }]);
    setMemberInput("");
  }

  async function submit() {
    if (!name.trim()) return setErr("Give your household a name.");
    setBusy(true);
    setErr("");
    const res = await fetch("/api/app/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Couldn't create the household.");

    // Members are saved as part of the profile step next; stash them via a
    // best-effort profile write now so the prefs step can prefill.
    if (members.length) {
      await fetch("/api/app/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      }).catch(() => {});
    }
    onDone(data.family);
  }

  return (
    <ScreenShell eyebrow="Step 1 · Welcome" title="Let's set up your home" sub="Two minutes now saves the “what should we cook?” question every single day.">
      <label className="block text-[12.5px] font-semibold">What should we call your family?</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1.5 block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white"
      />

      <label className="mt-4 block text-[12.5px] font-semibold">Who's in the family? <span className="font-normal text-ink/50 dark:text-white/50">({members.length} added)</span></label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {members.map((m, i) => (
          <span key={i} className="rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-[13.5px] font-medium text-brand">
            {m.name}
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={memberInput}
          onChange={(e) => setMemberInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
          placeholder="e.g. Aarav (8)"
          className="flex-1 rounded-2xl border border-line bg-surface px-4 py-2.5 text-[14px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white"
        />
        <button onClick={addMember} className="rounded-2xl border border-line px-4 text-[13.5px] font-medium dark:border-line-dark">Add</button>
      </div>

      {err && <p className="mt-3 text-[13px] text-red-600 dark:text-red-400">{err}</p>}
      <div className="mt-6">
        <PrimaryButton gold onClick={submit} disabled={busy}>{busy ? "One moment…" : "Continue"}</PrimaryButton>
      </div>
    </ScreenShell>
  );
}

/* ─────────── wizard step 2: preferences ─────────── */

const DIET_OPTIONS = ["Vegetarian", "Eggs OK", "Non-veg", "Veg-only Tuesdays"];
const CUISINE_OPTIONS = ["North Indian", "South Indian", "Indo-Chinese", "Continental"];
const BUDGETS = ["₹2,000 – ₹3,500", "₹3,500 – ₹5,000", "₹5,000+"];

function PrefsStep({ initial, busy, onSave }: { initial: Profile | null; busy: boolean; onSave: (patch: Partial<Profile>) => void }) {
  const [diets, setDiets] = useState<string[]>(initial?.diets ?? []);
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies ?? []);
  const [allergyInput, setAllergyInput] = useState("");
  const [cuisines, setCuisines] = useState<string[]>(initial?.cuisines ?? []);
  const [scope, setScope] = useState<"d" | "ld" | "bld">(initial?.mealScope ?? "ld");
  const [budget, setBudget] = useState(initial?.budgetBand ?? BUDGETS[1]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function addAllergy() {
    const v = allergyInput.trim();
    if (!v) return;
    setAllergies((a) => [...a, v]);
    setAllergyInput("");
  }

  return (
    <ScreenShell eyebrow="Step 2 · Your kitchen" title="How does your family eat?" sub="These become hard rules — I'll never plan around them.">
      <label className="block text-[12.5px] font-semibold">Diet</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {DIET_OPTIONS.map((d) => (
          <Chip key={d} on={diets.includes(d)} onClick={() => toggle(diets, setDiets, d)}>{d}</Chip>
        ))}
      </div>

      <label className="mt-4 block text-[12.5px] font-semibold">Allergies &amp; never-serve</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {allergies.map((a) => (
          <span key={a} className="rounded-full border border-coral bg-coral/10 px-3.5 py-2 text-[13.5px] font-medium text-coral">{a}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={allergyInput}
          onChange={(e) => setAllergyInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }}
          placeholder="e.g. Peanuts"
          className="flex-1 rounded-2xl border border-line bg-surface px-4 py-2.5 text-[14px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white"
        />
        <button onClick={addAllergy} className="rounded-2xl border border-line px-4 text-[13.5px] font-medium dark:border-line-dark">Add</button>
      </div>

      <label className="mt-4 block text-[12.5px] font-semibold">Cuisines you love</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {CUISINE_OPTIONS.map((c) => (
          <Chip key={c} on={cuisines.includes(c)} onClick={() => toggle(cuisines, setCuisines, c)}>{c}</Chip>
        ))}
      </div>

      <label className="mt-4 block text-[12.5px] font-semibold">Which meals should I plan?</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Chip on={scope === "d"} onClick={() => setScope("d")}>Dinner only</Chip>
        <Chip on={scope === "ld"} onClick={() => setScope("ld")}>Lunch + Dinner</Chip>
        <Chip on={scope === "bld"} onClick={() => setScope("bld")}>Breakfast, Lunch + Dinner</Chip>
      </div>

      <label className="mt-4 block text-[12.5px] font-semibold">Weekly grocery budget</label>
      <select
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        className="mt-1.5 block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none dark:border-line-dark dark:bg-surface-dark dark:text-white"
      >
        {BUDGETS.map((b) => <option key={b}>{b}</option>)}
      </select>

      <div className="mt-6">
        <PrimaryButton gold disabled={busy} onClick={() => onSave({ diets, allergies, cuisines, mealScope: scope, budgetBand: budget })}>
          {busy ? "Saving…" : "Continue"}
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}

/* ─────────── wizard step 3: cook setup ─────────── */

const LANGS = [
  { code: "hi", label: "हिन्दी" }, { code: "en", label: "English" },
  { code: "mr", label: "मराठी" }, { code: "kn", label: "ಕನ್ನಡ" },
];
const FREQS = [
  { v: "occasionally", label: "Occasionally" }, { v: "once_daily", label: "Once a day" },
  { v: "twice_daily", label: "Twice a day" }, { v: "thrice_daily", label: "Thrice a day" },
  { v: "live_in", label: "Lives in the house" },
];

function CookStep({ busy, onSave, onSkip }: { busy: boolean; onSave: (body: { name: string; phone?: string; language: string; frequency: string }) => void; onSkip: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lang, setLang] = useState("hi");
  const [freq, setFreq] = useState("once_daily");
  const [err, setErr] = useState("");

  return (
    <ScreenShell eyebrow="Step 3 · Your cook" title="Who cooks at home?" sub="I'll draft daily menus in their language. Nothing is ever sent without your approval.">
      <label className="block text-[12.5px] font-semibold">Cook's name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Sunita didi"
        className="mt-1.5 block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white"
      />
      <label className="mt-4 block text-[12.5px] font-semibold">WhatsApp number <span className="font-normal text-ink/50 dark:text-white/50">(optional)</span></label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+91XXXXXXXXXX"
        className="mt-1.5 block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white"
      />
      <label className="mt-4 block text-[12.5px] font-semibold">Language for cook messages</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {LANGS.map((l) => <Chip key={l.code} on={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</Chip>)}
      </div>
      <label className="mt-4 block text-[12.5px] font-semibold">How often does the cook come?</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {FREQS.map((f) => <Chip key={f.v} on={freq === f.v} onClick={() => setFreq(f.v)}>{f.label}</Chip>)}
      </div>

      {err && <p className="mt-3 text-[13px] text-red-600 dark:text-red-400">{err}</p>}
      <div className="mt-6">
        <PrimaryButton
          gold
          disabled={busy}
          onClick={() => {
            if (!name.trim()) return setErr("Add the cook's name, or skip for now.");
            onSave({ name: name.trim(), phone: phone.trim() || undefined, language: lang, frequency: freq });
          }}
        >
          {busy ? "Saving…" : "Finish setup"}
        </PrimaryButton>
        <GhostButton onClick={onSkip}>Skip for now</GhostButton>
      </div>
    </ScreenShell>
  );
}

/* ─────────── home screen ─────────── */

function HomeScreen({ userName, familyName, plan, busy, onAsk, onOpenPlan, onOpenChat }: {
  userName: string; familyName: string; plan: Plan; busy: boolean;
  onAsk: () => void; onOpenPlan: () => void; onOpenChat: () => void;
}) {
  return (
    <ScreenShell eyebrow="Home" title={`Good to see you, ${userName}`} sub={`${familyName} · here whenever you need anything.`}>
      {plan?.status === "approved" ? (
        <div className="rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
          <p className="text-[14px] font-semibold">This week's plan is approved ✓</p>
          <p className="mt-1 text-[13px] text-ink/60 dark:text-white/60">Week of {plan.weekStart}</p>
          <div className="mt-3"><PrimaryButton onClick={onOpenPlan}>View plan</PrimaryButton></div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
          <p className="text-[15px] leading-relaxed">Give me a second and I'll draft a plan from your household profile — diets, allergies, and everything else you told me.</p>
          <div className="mt-3">
            <PrimaryButton gold onClick={onAsk} disabled={busy}>{busy ? "Drafting your plan…" : "What should we cook this week?"}</PrimaryButton>
          </div>
        </div>
      )}
      <GhostButton onClick={onOpenChat}>Ask me anything else →</GhostButton>
    </ScreenShell>
  );
}

/* ─────────── plan screen ─────────── */

function PlanScreen({ plan, busy, onChangeEntry, onApprove, onCook, onShopping }: {
  plan: NonNullable<Plan>; busy: boolean;
  onChangeEntry: (day: number, meal: PlanEntry["meal"], dish: string) => void;
  onApprove: () => void; onCook: () => void; onShopping: () => void;
}) {
  const [editing, setEditing] = useState<{ day: number; meal: PlanEntry["meal"] } | null>(null);
  const [draft, setDraft] = useState("");

  const byDay = new Map<number, PlanEntry[]>();
  for (const e of plan.entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <ScreenShell eyebrow={`Weekly plan · ${plan.status === "approved" ? "Approved" : "Awaiting approval"}`} title={`Week of ${plan.weekStart}`} sub="Tap Change beside any meal. Nothing is final until you approve.">
      {days.map((d) => (
        <div key={d} className="mb-2.5 flex gap-3 rounded-2xl border border-line bg-surface p-3.5 dark:border-line-dark dark:bg-surface-dark">
          <div className="w-11 shrink-0 text-center">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink/50 dark:text-white/50">{DAY_NAMES[d]}</div>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {byDay.get(d)!.sort((a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]).map((e) => (
              <div key={e.meal} className="flex items-baseline gap-2">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink/45 dark:text-white/45">{MEAL_LABEL[e.meal]}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{e.dish}</span>
                {plan.status === "draft" && (
                  <button onClick={() => { setEditing({ day: d, meal: e.meal }); setDraft(e.dish); }} className="shrink-0 rounded-lg border border-line px-2 py-0.5 text-[10.5px] font-medium text-ink/60 dark:border-line-dark dark:text-white/60">
                    Change
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {plan.status === "draft" ? (
        <div className="mt-4 rounded-2xl border-2 border-brand bg-brand/10 p-4">
          <p className="text-[14px] font-semibold">Approve this plan?</p>
          <p className="mt-1 text-[12.5px] text-ink/60 dark:text-white/70">Approving unlocks the daily cook message and the shopping list.</p>
          <div className="mt-3"><PrimaryButton gold onClick={onApprove} disabled={busy}>{busy ? "Approving…" : "Approve plan ✓"}</PrimaryButton></div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <div className="flex-1"><PrimaryButton onClick={onCook}>Cook message</PrimaryButton></div>
          <div className="flex-1"><PrimaryButton onClick={onShopping}>Shopping list</PrimaryButton></div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-20 flex items-end bg-ink/40 dark:bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="w-full rounded-t-3xl bg-surface p-5 dark:bg-surface-dark">
            <p className="text-[15px] font-semibold">Change {DAY_NAMES[editing.day]}'s {MEAL_LABEL[editing.meal].toLowerCase()}</p>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-3 block w-full rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-2xl border border-line py-3 text-[14px] font-medium dark:border-line-dark">Cancel</button>
              <button
                onClick={() => { onChangeEntry(editing.day, editing.meal, draft); setEditing(null); }}
                className="flex-1 rounded-2xl bg-brand py-3 text-[14px] font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}

/* ─────────── cook handoff screen ─────────── */

function HandoffScreen({ cook, busy, flash, onBack, onNext }: {
  cook: Cook; busy: boolean; flash: (m: string) => void; onBack: () => void; onNext: () => void;
}) {
  const [draft, setDraft] = useState<{ text: string; cookName: string; cookPhone: string | null } | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/cook-message")
      .then((r) => r.json())
      .then((d) => { if (d.draft) setDraft(d.draft); else flash(d.error ?? "Couldn't draft the message"); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const res = await fetch("/api/app/cook-message", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sent) { setSent(true); flash(`Sent to ${data.cookName} ✓`); }
    else flash(data.error ?? "Couldn't send — copy the message instead");
  }

  function copy() {
    if (draft) navigator.clipboard?.writeText(draft.text).catch(() => {});
    flash("Copied — paste it into WhatsApp");
  }

  return (
    <ScreenShell eyebrow="Daily handoff" title={`Message for ${cook?.name ?? "your cook"}`} sub="Review, then send or copy it yourself.">
      {loading ? (
        <ThinkingDots />
      ) : draft ? (
        <>
          <div className="rounded-2xl border border-line bg-surface p-4 text-[14px] leading-relaxed dark:border-line-dark dark:bg-surface-dark">
            {draft.text}
          </div>
          {draft.cookPhone && !sent ? (
            <div className="mt-4"><PrimaryButton gold onClick={send} disabled={busy}>Approve &amp; send to cook ✓</PrimaryButton></div>
          ) : sent ? (
            <div className="mt-4 rounded-xl bg-accent/15 px-3 py-2.5 text-[13.5px] font-medium text-accent">Sent on WhatsApp · logged to the audit trail</div>
          ) : null}
          <GhostButton onClick={copy}>Copy message</GhostButton>
        </>
      ) : (
        <p className="text-[14px] text-ink/60 dark:text-white/60">No draft available yet.</p>
      )}
      <div className="mt-6 flex gap-2">
        <button onClick={onBack} className="flex-1 rounded-2xl border border-line py-3 text-[14px] font-medium dark:border-line-dark">← Back to plan</button>
        <button onClick={onNext} className="flex-1 rounded-2xl border border-line py-3 text-[14px] font-medium dark:border-line-dark">Shopping list →</button>
      </div>
    </ScreenShell>
  );
}

/* ─────────── shopping list screen ─────────── */

function ListScreen({ shoppingList, busy, onLoad, onBack }: {
  shoppingList: { items: ShoppingItem[] } | null; busy: boolean; onLoad: () => void; onBack: () => void;
}) {
  useEffect(() => {
    if (!shoppingList) onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCat = new Map<string, ShoppingItem[]>();
  for (const i of shoppingList?.items ?? []) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);

  function copyAll() {
    const text = [...byCat.entries()]
      .map(([cat, items]) => `${cat.toUpperCase()}\n` + items.map((i) => `• ${i.name} — ${i.qty}${i.substitute ? ` (sub: ${i.substitute})` : ""}`).join("\n"))
      .join("\n\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <ScreenShell eyebrow="Shopping list" title={`${shoppingList?.items.length ?? 0} items, grouped for quick-commerce`} sub="Built from the approved plan. Copy it into Blinkit, Zepto or Instamart — we never order on our own.">
      {busy && !shoppingList ? (
        <ThinkingDots />
      ) : (
        <>
          {[...byCat.entries()].map(([cat, items]) => (
            <div key={cat} className="mb-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand">{cat}</h3>
              {items.map((i) => (
                <div key={i.name} className="flex items-baseline justify-between border-b border-dashed border-line py-1.5 text-[14px] dark:border-line-dark">
                  <span>{i.name}{i.substitute && <span className="ml-1.5 block text-[11px] text-ink/50 dark:text-white/50">substitute OK: {i.substitute}</span>}</span>
                  <span className="shrink-0 tabular-nums text-ink/60 dark:text-white/60">{i.qty}</span>
                </div>
              ))}
            </div>
          ))}
          <PrimaryButton gold onClick={copyAll}>Copy list for Blinkit / Zepto</PrimaryButton>
        </>
      )}
      <GhostButton onClick={onBack}>← Back to plan</GhostButton>
    </ScreenShell>
  );
}

/* ─────────── free-text chat (existing assistant, kept as a tab) ─────────── */

type Msg = { role: "user" | "assistant"; content: string };

function FreeChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Ask me anything about your household — meals, schedules, or just to talk something through." },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" }); }, [messages, pending]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      if (res.status === 401) { setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: "Your session expired — refresh and log in again." }; return c; }); return; }
      if (res.status === 429) { const t = await res.text(); setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: t }; return c; }); return; }
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: acc }; return c; });
      }
    } catch {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: "I lost connection for a moment. Try again — I'm here." }; return c; });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto max-w-2xl space-y-2.5">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={m.role === "user"
                ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-bubble"
                : "max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-[15px] leading-relaxed shadow-bubble dark:bg-surface-dark"}>
                {m.content || (pending && i === messages.length - 1 ? <ThinkingDots /> : null)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line bg-bg/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur dark:border-line-dark dark:bg-bg-dark/95">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <button onClick={onBack} className="shrink-0 rounded-full border border-line px-3 py-2.5 text-[12.5px] font-medium dark:border-line-dark">← Back</button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            rows={1}
            className="block w-full max-h-32 min-h-[44px] resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-[15px] leading-snug outline-none focus:border-brand/40 dark:border-line-dark dark:bg-surface-dark dark:text-white"
          />
          <button onClick={send} disabled={pending || !input.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-30">→</button>
        </div>
      </div>
    </div>
  );
}
