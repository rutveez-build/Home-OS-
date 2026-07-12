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
type Feedback = {
  id: string;
  dish: string;
  meal: "breakfast" | "lunch" | "dinner";
  cooked: "cooked" | "skipped";
  verdict: "liked" | "ok" | "disliked" | null;
  leftovers: "none" | "some" | "lots" | null;
  note: string | null;
  createdAt: string;
};

type Family = { id: string; name: string; role: string } | null;

type Screen = "loading" | "wizard-family" | "wizard-prefs" | "wizard-cook" | "home" | "plan" | "handoff" | "list" | "feedback" | "purchases" | "connect" | "freechat";
type TokenMeta = { id: string; label: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

type PurchaseItem = { id: string; name: string; quantity: string | null; unitPrice: string | null; lineTotal: string | null };
type Purchase = { id: string; store: string; purchaseDate: string; subtotal: string | null; tax: string | null; total: string; source: string; items: PurchaseItem[] };
type ReceiptExtraction = {
  store: string;
  date?: string;
  items: { name: string; quantity?: string; unitPrice?: number; lineTotal?: number }[];
  subtotal?: number;
  tax?: number;
  total: number;
};
type KnownDeal = { id: string; itemName: string; store: string; price: string; createdAt: string };

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
            canManage={["owner", "parent", "partner"].includes(family?.role ?? "")}
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
            onOpenConnect={() => setScreen("connect")}
          />
        )}
        {screen === "connect" && <ConnectScreen flash={flash} onBack={() => setScreen("home")} />}
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
        {screen === "feedback" && <FeedbackScreen flash={flash} />}
        {screen === "purchases" && <PurchasesScreen flash={flash} />}
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
        <nav className="flex gap-0.5 text-[12px]">
          {(["home", "plan", "list", "purchases", "feedback"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScreen(s)}
              className={`rounded-full px-2 py-1 font-medium transition ${
                screen === s ? "bg-brand/10 text-brand" : "text-ink/50 dark:text-white/50"
              }`}
            >
              {s === "home" ? "Home" : s === "plan" ? "Plan" : s === "list" ? "Shopping" : s === "purchases" ? "Purchases" : "Feedback"}
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

function HomeScreen({ userName, familyName, plan, busy, canManage, onAsk, onOpenPlan, onOpenChat, onOpenConnect }: {
  userName: string; familyName: string; plan: Plan; busy: boolean; canManage: boolean;
  onAsk: () => void; onOpenPlan: () => void; onOpenChat: () => void; onOpenConnect: () => void;
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
      {canManage && <GhostButton onClick={onOpenConnect}>Connect ChatGPT, Claude, or Codex →</GhostButton>}
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
  const [editMode, setEditMode] = useState(false);
  const canChange = plan.status === "draft" || editMode;

  const byDay = new Map<number, PlanEntry[]>();
  for (const e of plan.entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <ScreenShell eyebrow={`Weekly plan · ${plan.status === "approved" ? "Approved" : "Awaiting approval"}`} title={`Week of ${plan.weekStart}`} sub={plan.status === "approved" && !editMode ? "Approved — tap Edit plan below to make changes." : "Tap Change beside any meal. Nothing is final until you approve."}>
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
                {canChange && (
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
        <div className="mt-4 space-y-2">
          <button onClick={() => setEditMode((v) => !v)} className={`block w-full rounded-2xl border py-3 text-center text-[14px] font-semibold transition ${editMode ? "border-brand bg-brand/10 text-brand" : "border-line text-ink/70 dark:border-line-dark dark:text-white/70"}`}>
            {editMode ? "Done editing ✓" : "Edit plan"}
          </button>
          <div className="flex gap-2">
            <div className="flex-1"><PrimaryButton onClick={onCook}>Cook message</PrimaryButton></div>
            <div className="flex-1"><PrimaryButton onClick={onShopping}>Shopping list</PrimaryButton></div>
          </div>
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

/* ─────────── feedback screen ─────────── */

const VERDICTS = [
  { v: "liked", label: "😋 Liked it" },
  { v: "ok", label: "🙂 It was OK" },
  { v: "disliked", label: "😕 Not a hit" },
] as const;
const LEFTOVER_OPTS = [
  { v: "none", label: "None left" },
  { v: "some", label: "Some left" },
  { v: "lots", label: "Lots left" },
] as const;

function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function FeedbackScreen({ flash }: { flash: (m: string) => void }) {
  const [history, setHistory] = useState<Feedback[] | null>(null);
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner">("dinner");
  const [cooked, setCooked] = useState<"cooked" | "skipped">("cooked");
  const [verdict, setVerdict] = useState<"liked" | "ok" | "disliked" | undefined>(undefined);
  const [leftovers, setLeftovers] = useState<"none" | "some" | "lots" | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/app/feedback");
    const data = await res.json().catch(() => ({}));
    setHistory(data.feedback ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/app/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal, cooked, verdict: cooked === "cooked" ? verdict : undefined, leftovers: cooked === "cooked" ? leftovers : undefined, note: note.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      flash(data.reply ?? "Noted ✓");
      setVerdict(undefined);
      setLeftovers(undefined);
      setNote("");
      load();
    } else flash(data.error ?? "Couldn't save that");
  }

  return (
    <ScreenShell eyebrow="Feedback" title="What's working, what's not" sub="A quick note after any meal teaches next week's plan.">
      <div className="rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
        <label className="block text-[12.5px] font-semibold">Which meal?</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(["breakfast", "lunch", "dinner"] as const).map((m) => (
            <Chip key={m} on={meal === m} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</Chip>
          ))}
        </div>

        <label className="mt-3 block text-[12.5px] font-semibold">Did it happen?</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Chip on={cooked === "cooked"} onClick={() => setCooked("cooked")}>Cooked</Chip>
          <Chip on={cooked === "skipped"} onClick={() => setCooked("skipped")}>Skipped</Chip>
        </div>

        {cooked === "cooked" && (
          <>
            <label className="mt-3 block text-[12.5px] font-semibold">How was it?</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {VERDICTS.map((o) => <Chip key={o.v} on={verdict === o.v} onClick={() => setVerdict(o.v)}>{o.label}</Chip>)}
            </div>

            <label className="mt-3 block text-[12.5px] font-semibold">Leftovers?</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {LEFTOVER_OPTS.map((o) => <Chip key={o.v} on={leftovers === o.v} onClick={() => setLeftovers(o.v)}>{o.label}</Chip>)}
            </div>
          </>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? (optional)"
          className="mt-3 block w-full rounded-2xl border border-line bg-bg px-4 py-2.5 text-[14px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white"
        />
        <div className="mt-3"><PrimaryButton gold onClick={submit} disabled={busy}>{busy ? "Saving…" : "Share feedback"}</PrimaryButton></div>
      </div>

      <h2 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-brand">Recent feedback</h2>
      {history === null ? (
        <ThinkingDots />
      ) : history.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-ink/55 dark:text-white/55">Nothing shared yet — the first note above will show up here.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {history.map((f) => (
            <div key={f.id} className="rounded-2xl border border-line bg-surface p-3.5 dark:border-line-dark dark:bg-surface-dark">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold">{f.dish}</span>
                <span className="shrink-0 text-[11px] text-ink/45 dark:text-white/45">{relativeDay(f.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink/60 dark:text-white/60">
                {MEAL_LABEL[f.meal]} · {f.cooked === "skipped" ? "skipped" : VERDICTS.find((v) => v.v === f.verdict)?.label ?? "cooked"}
                {f.leftovers && f.leftovers !== "none" ? ` · ${LEFTOVER_OPTS.find((l) => l.v === f.leftovers)?.label.toLowerCase()}` : ""}
              </p>
              {f.note && <p className="mt-1 text-[13px] italic text-ink/70 dark:text-white/70">“{f.note}”</p>}
            </div>
          ))}
        </div>
      )}
    </ScreenShell>
  );
}

/* ─────────── purchases screen (receipt memory) ─────────── */

// Downscale + re-encode client-side before upload — Vercel serverless
// functions cap request bodies around 4.5MB, and a raw phone photo (often
// 3-8MB) plus base64's ~33% overhead would blow past that. Capping the
// longest side and re-encoding as JPEG keeps this comfortably small.
function downscaleImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type DraftItem = { name: string; quantity: string; unitPrice: string; lineTotal: string };
type Draft = { store: string; date: string; items: DraftItem[]; subtotal: string; tax: string; total: string };
const EMPTY_DRAFT: Draft = { store: "", date: "", items: [{ name: "", quantity: "", unitPrice: "", lineTotal: "" }], subtotal: "", tax: "", total: "" };

function extractionToDraft(x: ReceiptExtraction): Draft {
  return {
    store: x.store,
    date: x.date ?? "",
    items: x.items.map((i) => ({
      name: i.name,
      quantity: i.quantity ?? "",
      unitPrice: i.unitPrice !== undefined ? String(i.unitPrice) : "",
      lineTotal: i.lineTotal !== undefined ? String(i.lineTotal) : "",
    })),
    subtotal: x.subtotal !== undefined ? String(x.subtotal) : "",
    tax: x.tax !== undefined ? String(x.tax) : "",
    total: String(x.total),
  };
}

function PurchasesScreen({ flash }: { flash: (m: string) => void }) {
  const [history, setHistory] = useState<Purchase[] | null>(null);
  const [deals, setDeals] = useState<KnownDeal[] | null>(null);
  const [mode, setMode] = useState<"upload" | "manual" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Array<{ purchase: Purchase; item: PurchaseItem }> | null>(null);
  const [dealItem, setDealItem] = useState("");
  const [dealStore, setDealStore] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadHistory() {
    const res = await fetch("/api/app/purchases");
    const data = await res.json().catch(() => ({}));
    setHistory(data.purchases ?? []);
  }
  async function loadDeals() {
    const res = await fetch("/api/app/deals");
    const data = await res.json().catch(() => ({}));
    setDeals(data.deals ?? []);
  }
  useEffect(() => { loadHistory(); loadDeals(); }, []);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const dataUrl = await downscaleImage(file);
      const res = await fetch("/api/app/purchases/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash(data.error ?? "Couldn't read that receipt."); return; }
      setDraft(extractionToDraft(data.extraction));
      setMode("upload");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't process that image.");
    } finally {
      setExtracting(false);
    }
  }

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setDraft((d) => ({ ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function addItem() {
    setDraft((d) => ({ ...d, items: [...d.items, { name: "", quantity: "", unitPrice: "", lineTotal: "" }] }));
  }
  function removeItem(i: number) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));
  }

  async function savePurchase() {
    const items = draft.items.filter((it) => it.name.trim()).map((it) => ({
      name: it.name.trim(),
      quantity: it.quantity.trim() || undefined,
      unitPrice: it.unitPrice ? Number(it.unitPrice) : undefined,
      lineTotal: it.lineTotal ? Number(it.lineTotal) : undefined,
    }));
    if (!draft.store.trim()) return flash("Give the store a name.");
    if (!items.length) return flash("Add at least one item.");
    if (!draft.total) return flash("Give a total.");

    setSaving(true);
    const res = await fetch("/api/app/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store: draft.store.trim(),
        purchaseDate: draft.date || undefined,
        items,
        subtotal: draft.subtotal ? Number(draft.subtotal) : undefined,
        tax: draft.tax ? Number(draft.tax) : undefined,
        total: Number(draft.total),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return flash(data.error ?? "Couldn't save that purchase.");
    flash(data.notes?.length ? data.notes.join(" ") : "Purchase logged ✓");
    setMode(null);
    setDraft(EMPTY_DRAFT);
    loadHistory();
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) { setMatches(null); return; }
    const res = await fetch(`/api/app/purchases?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    setMatches(data.matches ?? []);
  }

  async function addDeal() {
    if (!dealItem.trim() || !dealStore.trim() || !dealPrice) return flash("Give an item, store, and price.");
    const res = await fetch("/api/app/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: dealItem.trim(), store: dealStore.trim(), price: Number(dealPrice) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flash(data.error ?? "Couldn't save that deal.");
    setDealItem(""); setDealStore(""); setDealPrice("");
    flash("Deal saved ✓");
    loadDeals();
  }

  return (
    <ScreenShell eyebrow="Purchases" title="What did we actually buy?" sub="Upload a receipt or log one manually — search it back later with a plain question.">
      <div className="rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
        <div className="flex flex-wrap gap-2">
          <Chip on={mode === "upload"} onClick={() => fileInputRef.current?.click()}>{extracting ? "Reading…" : "📷 Upload receipt"}</Chip>
          <Chip on={mode === "manual"} onClick={() => { setMode("manual"); setDraft(EMPTY_DRAFT); }}>✏️ Enter manually</Chip>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} className="hidden" />

        {mode && (
          <div className="mt-4 space-y-3 border-t border-line/60 pt-3 dark:border-line-dark/60">
            <div className="flex gap-2">
              <input value={draft.store} onChange={(e) => setDraft((d) => ({ ...d, store: e.target.value }))} placeholder="Store"
                className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[14px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
              <input value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} placeholder="YYYY-MM-DD"
                className="w-32 rounded-xl border border-line bg-bg px-3 py-2 text-[14px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
            </div>

            <div className="space-y-1.5">
              {draft.items.map((it, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="Item"
                    className="flex-[2] rounded-xl border border-line bg-bg px-2.5 py-2 text-[13px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
                  <input value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} placeholder="Qty"
                    className="w-16 rounded-xl border border-line bg-bg px-2 py-2 text-[13px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
                  <input value={it.lineTotal} onChange={(e) => updateItem(i, { lineTotal: e.target.value })} placeholder="₹"
                    className="w-16 rounded-xl border border-line bg-bg px-2 py-2 text-[13px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
                  <button onClick={() => removeItem(i)} className="shrink-0 rounded-xl border border-coral px-2 text-[12px] text-coral">✕</button>
                </div>
              ))}
              <button onClick={addItem} className="text-[12.5px] font-medium text-brand">+ Add item</button>
            </div>

            <div className="flex gap-2">
              <input value={draft.subtotal} onChange={(e) => setDraft((d) => ({ ...d, subtotal: e.target.value }))} placeholder="Subtotal"
                className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[13.5px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
              <input value={draft.tax} onChange={(e) => setDraft((d) => ({ ...d, tax: e.target.value }))} placeholder="Tax"
                className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[13.5px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
              <input value={draft.total} onChange={(e) => setDraft((d) => ({ ...d, total: e.target.value }))} placeholder="Total *"
                className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[13.5px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
            </div>

            <PrimaryButton gold onClick={savePurchase} disabled={saving}>{saving ? "Saving…" : "Save purchase"}</PrimaryButton>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
        <label className="block text-[12.5px] font-semibold">Did we already buy…?</label>
        <div className="mt-1.5 flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="e.g. sugar"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[14px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
          <button onClick={runSearch} className="shrink-0 rounded-xl border border-line px-3 text-[12.5px] font-medium dark:border-line-dark">Find</button>
        </div>
        {matches !== null && (
          matches.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink/55 dark:text-white/55">Nothing found for “{query}”.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {matches.map((m) => (
                <p key={m.item.id} className="text-[13px] text-ink/75 dark:text-white/75">
                  <strong>{m.item.name}</strong> — {m.purchase.store}, {relativeDay(m.purchase.purchaseDate)} (₹{m.item.lineTotal ?? m.purchase.total})
                </p>
              ))}
            </div>
          )
        )}
      </div>

      <h2 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-brand">Recent purchases</h2>
      {history === null ? (
        <ThinkingDots />
      ) : history.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-ink/55 dark:text-white/55">Nothing logged yet — upload or enter your first receipt above.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {history.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line bg-surface p-3.5 dark:border-line-dark dark:bg-surface-dark">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold">{p.store}</span>
                <span className="shrink-0 text-[13px] font-semibold text-brand">₹{p.total}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-ink/45 dark:text-white/45">{relativeDay(p.purchaseDate)}</p>
              <p className="mt-1 text-[12.5px] text-ink/65 dark:text-white/65">{p.items.map((it) => it.name).join(", ")}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-brand">Known deals</h2>
      <p className="mt-1 text-[12px] text-ink/55 dark:text-white/55">Manually tracked — teach the household a price you saw, and future purchases get compared against it.</p>
      <div className="mt-2 flex gap-1.5">
        <input value={dealItem} onChange={(e) => setDealItem(e.target.value)} placeholder="Item"
          className="flex-1 rounded-xl border border-line bg-bg px-2.5 py-2 text-[13px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
        <input value={dealStore} onChange={(e) => setDealStore(e.target.value)} placeholder="Store"
          className="flex-1 rounded-xl border border-line bg-bg px-2.5 py-2 text-[13px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
        <input value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} placeholder="₹"
          className="w-16 rounded-xl border border-line bg-bg px-2 py-2 text-[13px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white" />
        <button onClick={addDeal} className="shrink-0 rounded-xl border border-line px-2.5 text-[12px] font-medium dark:border-line-dark">Add</button>
      </div>
      {deals && deals.length > 0 && (
        <div className="mt-2 space-y-1">
          {deals.map((d) => (
            <p key={d.id} className="text-[12.5px] text-ink/65 dark:text-white/65">{d.itemName} — ₹{d.price} at {d.store}</p>
          ))}
        </div>
      )}
    </ScreenShell>
  );
}

/* ─────────── connect screen (MCP tokens) ─────────── */

// Which client tab is open in the post-mint "how do I connect this" panel —
// filled in with the real token/URL so there's nothing to copy from elsewhere.
const CONNECT_CLIENTS = [
  { key: "claude-cli", label: "Claude Code" },
  { key: "codex", label: "Codex CLI" },
  { key: "claude-web", label: "claude.ai" },
  { key: "chatgpt", label: "ChatGPT" },
] as const;
type ConnectClientKey = (typeof CONNECT_CLIENTS)[number]["key"];

function ConnectScreen({ flash, onBack }: { flash: (m: string) => void; onBack: () => void }) {
  const [tokens, setTokens] = useState<TokenMeta[] | null>(null);
  const [label, setLabel] = useState("");
  const [minted, setMinted] = useState<{ token: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectClient, setConnectClient] = useState<ConnectClientKey>("claude-cli");
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  async function load() {
    const res = await fetch("/api/app/tokens");
    const data = await res.json().catch(() => ({}));
    setTokens(data.tokens ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!label.trim()) return flash("Give it a label, e.g. \"ChatGPT\"");
    setBusy(true);
    const res = await fetch("/api/app/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return flash(data.error ?? "Couldn't create a token");
    setMinted({ token: data.token, label: data.record.label });
    setLabel("");
    load();
  }

  async function revoke(tokenId: string) {
    const res = await fetch("/api/app/tokens/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
    if (res.ok) { flash("Revoked ✓"); load(); }
    else flash("Couldn't revoke that token");
  }

  async function copy(text: string) {
    // The token is shown exactly once — a silently-failed copy would mean the
    // user believes they saved it when they didn't. Report the real outcome.
    try {
      if (!navigator.clipboard) throw new Error("no clipboard API");
      await navigator.clipboard.writeText(text);
      flash("Copied ✓");
    } catch {
      flash("Couldn't copy automatically — select the text above and copy it manually.");
    }
  }

  return (
    <ScreenShell eyebrow="Connect" title="Link an AI assistant" sub="ChatGPT, Claude, or Codex can plan meals and check your household through this connector — always approval-gated, same as here.">
      {minted && (
        <div className="mb-4 rounded-2xl border-2 border-brand bg-brand/10 p-4">
          <p className="text-[13.5px] font-semibold">Token for “{minted.label}” — shown once</p>
          <p className="mt-1 text-[12px] text-ink/60 dark:text-white/70">Copy it now. It can't be shown again — you'd need to create a new one.</p>
          <div className="mt-2 break-all rounded-xl bg-surface px-3 py-2 font-mono text-[12px] dark:bg-surface-dark">{minted.token}</div>
          <button onClick={() => copy(minted.token)} className="mt-2 w-full rounded-xl bg-brand py-2 text-[13px] font-semibold text-white">Copy token</button>

          <div className="mt-4 border-t border-line/60 pt-3 dark:border-line-dark/60">
            <p className="text-[12.5px] font-semibold">Connect it to</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CONNECT_CLIENTS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setConnectClient(c.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium ${
                    connectClient === c.key ? "bg-brand text-white" : "border border-line dark:border-line-dark"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {connectClient === "claude-cli" && (
              <div className="mt-2.5">
                <p className="text-[12px] text-ink/60 dark:text-white/70">Run this in a terminal:</p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-surface px-3 py-2 font-mono text-[11.5px] dark:bg-surface-dark">
{`claude mcp add home-os --url ${mcpUrl} \\\n  --header "Authorization: Bearer ${minted.token}"`}
                </pre>
                <button
                  onClick={() => copy(`claude mcp add home-os --url ${mcpUrl} --header "Authorization: Bearer ${minted.token}"`)}
                  className="mt-1.5 rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium dark:border-line-dark"
                >
                  Copy command
                </button>
              </div>
            )}

            {connectClient === "codex" && (
              <div className="mt-2.5">
                <p className="text-[12px] text-ink/60 dark:text-white/70">
                  Add this to <code className="font-mono">~/.codex/config.toml</code>:
                </p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-surface px-3 py-2 font-mono text-[11.5px] dark:bg-surface-dark">
{`[mcp_servers.home-os]\nurl = "${mcpUrl}"\nbearer_token = "${minted.token}"`}
                </pre>
                <button
                  onClick={() => copy(`[mcp_servers.home-os]\nurl = "${mcpUrl}"\nbearer_token = "${minted.token}"`)}
                  className="mt-1.5 rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium dark:border-line-dark"
                >
                  Copy block
                </button>
              </div>
            )}

            {connectClient === "claude-web" && (
              <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-[12px] text-ink/70 dark:text-white/75">
                <li>On claude.ai, go to <b>Settings → Connectors → Add custom connector</b>.</li>
                <li>Paste the Server URL shown above — that's the only field it needs.</li>
                <li>Claude opens a Home OS sign-in + approval screen — sign in and tap <b>Approve</b> there (not here).</li>
                <li>Claude can now use Home OS in any chat.</li>
              </ol>
            )}

            {connectClient === "chatgpt" && (
              <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-[12px] text-ink/70 dark:text-white/75">
                <li>In ChatGPT, go to <b>Settings → Connectors</b> (turn on Developer Mode first if you don't see "Add connector").</li>
                <li>Paste the Server URL shown above — that's the only field it needs.</li>
                <li>ChatGPT opens a Home OS sign-in + approval screen — sign in and tap <b>Approve</b> there (not here).</li>
                <li>ChatGPT can now use Home OS in any chat.</li>
              </ol>
            )}

            {(connectClient === "claude-web" || connectClient === "chatgpt") && (
              <p className="mt-2 text-[11px] text-ink/45 dark:text-white/45">
                No need to copy the token above for this one — it signs in and approves the connection itself. The token above is only for the CLI tabs.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
        <label className="block text-[12.5px] font-semibold">Server URL</label>
        <div className="mt-1.5 flex gap-2">
          <div className="flex-1 truncate rounded-xl border border-line bg-bg px-3 py-2 font-mono text-[12px] dark:border-line-dark dark:bg-bg-dark">{mcpUrl}</div>
          <button onClick={() => copy(mcpUrl)} className="shrink-0 rounded-xl border border-line px-3 text-[12px] font-medium dark:border-line-dark">Copy</button>
        </div>

        <label className="mt-3 block text-[12.5px] font-semibold">New connector</label>
        <div className="mt-1.5 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. ChatGPT"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-[14px] outline-none dark:border-line-dark dark:bg-bg-dark dark:text-white"
          />
          <button onClick={create} disabled={busy} className="shrink-0 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-50">{busy ? "…" : "Create"}</button>
        </div>
      </div>

      <h2 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-brand">Active connectors</h2>
      {tokens === null ? (
        <ThinkingDots />
      ) : tokens.filter((t) => !t.revokedAt).length === 0 ? (
        <p className="mt-2 text-[13.5px] text-ink/55 dark:text-white/55">None yet — create one above.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {tokens.filter((t) => !t.revokedAt).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-3.5 dark:border-line-dark dark:bg-surface-dark">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{t.label}</p>
                <p className="text-[11.5px] text-ink/50 dark:text-white/50">
                  {t.lastUsedAt ? `Last used ${relativeDay(t.lastUsedAt)}` : "Never used yet"}
                </p>
              </div>
              <button onClick={() => revoke(t.id)} className="shrink-0 rounded-lg border border-coral px-2.5 py-1 text-[11.5px] font-medium text-coral">Revoke</button>
            </div>
          ))}
        </div>
      )}
      <GhostButton onClick={onBack}>← Back home</GhostButton>
    </ScreenShell>
  );
}

/* ─────────── free-text chat (existing assistant, kept as a tab) ─────────── */

type Msg = { role: "user" | "assistant"; content: string };

// Command reference — a cheat sheet for the power-user slash commands.
// "direct" chips send immediately (nothing to fill in); the rest drop a
// template into the box so the user edits the specifics before sending.
const QUICK_COMMANDS = [
  { label: "Setup checklist", cmd: "/setup" },
  { label: "Show household", cmd: "/household show" },
  { label: "Show cook", cmd: "/cook show" },
  { label: "Show plan", cmd: "/plan show" },
  { label: "Draft this week's plan", cmd: "/plan week" },
  { label: "Approve plan", cmd: "/plan approve" },
  { label: "Draft cook message", cmd: "/plan cook" },
  { label: "Send cook message", cmd: "/plan cook send" },
  { label: "Shopping list", cmd: "/plan shopping" },
  { label: "Privacy & my data", cmd: "/privacy" },
  { label: "Export my data", cmd: "/export" },
  { label: "Delete household", cmd: "/delete" },
];
const TEMPLATE_COMMANDS = [
  { label: "Set diets", cmd: "/household diets " },
  { label: "Set allergies", cmd: "/household allergies " },
  { label: "Set cuisines", cmd: "/household cuisines " },
  { label: "Set meal times", cmd: "/household meals ld" },
  { label: "Set budget", cmd: "/household budget " },
  { label: "Add / change cook", cmd: "/cook set " },
  { label: "Change a meal", cmd: "/plan change TUE dinner " },
  { label: "Give feedback", cmd: "/feedback dinner cooked liked" },
  { label: "Invite family member", cmd: "/family invite " },
];

function FreeChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Ask me anything about your household — meals, schedules, or just to talk something through." },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" }); }, [messages, pending]);

  async function send(override?: string) {
    const trimmed = (override ?? input).trim();
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
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => setShowCommands((v) => !v)}
            className="mb-1.5 flex items-center gap-1 text-[12px] font-medium text-ink/55 dark:text-white/55"
          >
            <span>{showCommands ? "▾" : "▸"}</span> Commands — tap instead of typing
          </button>
          {showCommands && (
            <div className="mb-2 space-y-1.5">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand">Tap to run</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_COMMANDS.map((c) => (
                    <button
                      key={c.cmd}
                      onClick={() => send(c.cmd)}
                      disabled={pending}
                      className="shrink-0 whitespace-nowrap rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-[12.5px] font-medium text-brand disabled:opacity-40"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink/45 dark:text-white/45">Tap to fill in, then send</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {TEMPLATE_COMMANDS.map((c) => (
                    <button
                      key={c.cmd}
                      onClick={() => { setInput(c.cmd); inputRef.current?.focus(); }}
                      className="shrink-0 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink/70 dark:border-line-dark dark:text-white/70"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button onClick={onBack} className="shrink-0 rounded-full border border-line px-3 py-2.5 text-[12.5px] font-medium dark:border-line-dark">← Back</button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…"
              rows={1}
              className="block w-full max-h-32 min-h-[44px] resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-[15px] leading-snug outline-none focus:border-brand/40 dark:border-line-dark dark:bg-surface-dark dark:text-white"
            />
            <button onClick={() => send()} disabled={pending || !input.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-30">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
