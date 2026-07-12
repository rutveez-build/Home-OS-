"use client";

/**
 * Onboarding wizard, Kitchen Stream style — the Stitch onboarding mocks
 * render setup as a conversation: teal progress header, assistant bubbles
 * asking questions on the chat background, chip answers, a fixed bottom
 * action bar. Same props and API wiring as the old cream wizard steps.
 */

import { useState, type ReactNode } from "react";
import { Bubble, Card, CardBanner, Icon, SystemNote } from "./kit";

type Member = { name: string; note?: string };
type Family = { id: string; name: string; role: string } | null;
type Profile = {
  members: Member[];
  diets: string[];
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  budgetBand: string | null;
  mealScope: "d" | "ld" | "bld";
};

/* ── wizard chrome ─────────────────────────────────────────────────── */

export function WizardBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 flex h-14 flex-col justify-end bg-stream-header px-4 pb-1.5 text-stream-on-header shadow-sm">
      <div className="mx-auto flex w-full max-w-[600px] items-center justify-between pb-1">
        <span className="text-[16px] font-semibold">Household Setup</span>
        <span className="text-[12px] opacity-80">
          Step {step} of {total}
        </span>
      </div>
      <div className="mx-auto h-1 w-full max-w-[600px] overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full bg-white transition-all duration-700 ease-out"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </header>
  );
}

function StepCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-stream-chat">
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2 px-4 pb-44 pt-5">
        {children}
      </div>
    </div>
  );
}

function Ask({ children }: { children: ReactNode }) {
  return (
    <Bubble direction="in" time="Just now" className="mt-3">
      {children}
    </Bubble>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-stream-line bg-stream-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2">{children}</div>
    </div>
  );
}

function ContinueButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-stream-primary py-3.5 text-[13px] font-bold uppercase tracking-wide text-stream-on-primary shadow-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SkipButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl py-2.5 text-[13px] font-medium text-stream-mute transition-colors hover:text-stream-ink"
    >
      {children}
    </button>
  );
}

/** Mock-style answer chip: white pill, icon, fills primary when selected. */
function ChoiceChip({
  selected,
  icon,
  children,
  onClick,
}: {
  selected: boolean;
  icon?: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold shadow-card transition-colors ${
        selected
          ? "border-stream-primary bg-stream-primary text-stream-on-primary"
          : "border-stream-line bg-stream-bubble-in text-stream-ink hover:bg-stream-primary/10"
      }`}
    >
      {icon && <Icon name={icon} fill={selected} className="text-[18px]" />}
      {children}
    </button>
  );
}

const inputCls =
  "block w-full rounded-xl border border-stream-line bg-stream-bubble-in px-4 py-3 text-[15px] text-stream-ink shadow-card outline-none transition placeholder:text-stream-mute focus:border-stream-primary";

function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[13px] font-medium text-stream-danger">{children}</p>;
}

/* ── step 1: household + members ───────────────────────────────────── */

export function FamilyStep({ onDone }: { onDone: (fam: Family) => void }) {
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
    <StepCanvas>
      <SystemNote>Welcome</SystemNote>
      <Ask>Hi! Let&apos;s set up your home. What should we call your household?</Ask>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`${inputCls} mt-2`}
        aria-label="Household name"
      />

      <Ask>
        Who&apos;s in the family?{" "}
        <span className="text-stream-mute">({members.length} added — kids&apos; ages help me plan)</span>
      </Ask>
      {members.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((m, i) => (
            <ChoiceChip
              key={i}
              selected
              icon="person"
              onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}
            >
              {m.name}
            </ChoiceChip>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={memberInput}
          onChange={(e) => setMemberInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addMember();
            }
          }}
          placeholder="e.g. Aarav (8)"
          className={inputCls}
          aria-label="Add family member"
        />
        <button
          onClick={addMember}
          className="shrink-0 rounded-xl border border-stream-line bg-stream-bubble-in px-4 text-[13px] font-semibold text-stream-primary shadow-card"
        >
          Add
        </button>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardBanner icon="info" label="Why we ask" />
        <p className="p-4 text-[13px] leading-relaxed text-stream-mute">
          Meal plans, portions, and the shopping list are sized to your household. You approve
          everything before it goes anywhere.
        </p>
      </Card>

      {err && <ErrorNote>{err}</ErrorNote>}
      <ActionBar>
        <ContinueButton onClick={submit} disabled={busy}>
          {busy ? "One moment…" : "Continue"}
        </ContinueButton>
      </ActionBar>
    </StepCanvas>
  );
}

/* ── step 2: kitchen preferences ───────────────────────────────────── */

const DIET_OPTIONS = ["Vegetarian", "Eggs OK", "Non-veg", "Veg-only Tuesdays"];
const CUISINE_OPTIONS = ["North Indian", "South Indian", "Indo-Chinese", "Continental"];
const BUDGETS = ["₹2,000 – ₹3,500", "₹3,500 – ₹5,000", "₹5,000+"];
const DIET_ICONS: Record<string, string> = {
  Vegetarian: "eco",
  "Eggs OK": "egg",
  "Non-veg": "restaurant",
  "Veg-only Tuesdays": "event_repeat",
};

export function PrefsStep({
  initial,
  busy,
  onSave,
}: {
  initial: Profile | null;
  busy: boolean;
  onSave: (patch: Partial<Profile>) => void;
}) {
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
    <StepCanvas>
      <SystemNote>Your kitchen</SystemNote>
      <Ask>How does your family eat? These become hard rules — I&apos;ll never plan around them.</Ask>
      <div className="mt-2 flex flex-wrap gap-2">
        {DIET_OPTIONS.map((d) => (
          <ChoiceChip
            key={d}
            selected={diets.includes(d)}
            icon={DIET_ICONS[d]}
            onClick={() => toggle(diets, setDiets, d)}
          >
            {d}
          </ChoiceChip>
        ))}
      </div>

      <Ask>Any allergies or never-serve items?</Ask>
      {allergies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {allergies.map((a) => (
            <ChoiceChip
              key={a}
              selected
              icon="warning"
              onClick={() => setAllergies((xs) => xs.filter((x) => x !== a))}
            >
              {a}
            </ChoiceChip>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={allergyInput}
          onChange={(e) => setAllergyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAllergy();
            }
          }}
          placeholder="e.g. Peanuts"
          className={inputCls}
          aria-label="Add allergy"
        />
        <button
          onClick={addAllergy}
          className="shrink-0 rounded-xl border border-stream-line bg-stream-bubble-in px-4 text-[13px] font-semibold text-stream-primary shadow-card"
        >
          Add
        </button>
      </div>

      <Ask>Which cuisines does everyone love?</Ask>
      <div className="mt-2 flex flex-wrap gap-2">
        {CUISINE_OPTIONS.map((c) => (
          <ChoiceChip key={c} selected={cuisines.includes(c)} onClick={() => toggle(cuisines, setCuisines, c)}>
            {c}
          </ChoiceChip>
        ))}
      </div>

      <Ask>Which meals should I plan?</Ask>
      <div className="mt-2 flex flex-wrap gap-2">
        <ChoiceChip selected={scope === "d"} icon="dinner_dining" onClick={() => setScope("d")}>
          Dinner only
        </ChoiceChip>
        <ChoiceChip selected={scope === "ld"} icon="lunch_dining" onClick={() => setScope("ld")}>
          Lunch + Dinner
        </ChoiceChip>
        <ChoiceChip selected={scope === "bld"} icon="brunch_dining" onClick={() => setScope("bld")}>
          All three
        </ChoiceChip>
      </div>

      <Ask>Roughly what&apos;s the weekly grocery budget?</Ask>
      <div className="mt-2 flex flex-wrap gap-2">
        {BUDGETS.map((b) => (
          <ChoiceChip key={b} selected={budget === b} icon="currency_rupee" onClick={() => setBudget(b)}>
            {b}
          </ChoiceChip>
        ))}
      </div>

      <ActionBar>
        <ContinueButton
          disabled={busy}
          onClick={() => onSave({ diets, allergies, cuisines, mealScope: scope, budgetBand: budget })}
        >
          {busy ? "Saving…" : "Continue"}
        </ContinueButton>
      </ActionBar>
    </StepCanvas>
  );
}

/* ── step 3: cook setup ────────────────────────────────────────────── */

const LANGS = [
  { code: "hi", label: "हिन्दी" },
  { code: "en", label: "English" },
  { code: "kn", label: "ಕನ್ನಡ" },
];
const FREQS = [
  { v: "occasionally", label: "Occasionally" },
  { v: "once_daily", label: "Once a day" },
  { v: "twice_daily", label: "Twice a day" },
  { v: "thrice_daily", label: "Thrice a day" },
  { v: "live_in", label: "Lives in the house" },
];

export function CookStep({
  busy,
  onSave,
  onSkip,
}: {
  busy: boolean;
  onSave: (body: { name: string; phone?: string; language: string; frequency: string }) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lang, setLang] = useState("hi");
  const [freq, setFreq] = useState("once_daily");
  const [err, setErr] = useState("");

  return (
    <StepCanvas>
      <SystemNote>Your cook</SystemNote>
      <Ask>
        Who cooks at home? I&apos;ll draft daily menus in their language — nothing is ever sent
        without your approval.
      </Ask>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Sunita didi"
        className={`${inputCls} mt-2`}
        aria-label="Cook's name"
      />

      <Ask>
        Their WhatsApp number? <span className="text-stream-mute">(optional)</span>
      </Ask>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+91XXXXXXXXXX"
        type="tel"
        className={`${inputCls} mt-2`}
        aria-label="Cook's WhatsApp number"
      />

      <Ask>Which language should cook messages be in?</Ask>
      <div className="mt-2 flex flex-wrap gap-2">
        {LANGS.map((l) => (
          <ChoiceChip key={l.code} selected={lang === l.code} onClick={() => setLang(l.code)}>
            {l.label}
          </ChoiceChip>
        ))}
      </div>

      <Ask>How often do they come?</Ask>
      <div className="mt-2 flex flex-wrap gap-2">
        {FREQS.map((f) => (
          <ChoiceChip key={f.v} selected={freq === f.v} onClick={() => setFreq(f.v)}>
            {f.label}
          </ChoiceChip>
        ))}
      </div>

      {err && <ErrorNote>{err}</ErrorNote>}
      <ActionBar>
        <ContinueButton
          disabled={busy}
          onClick={() => {
            if (!name.trim()) return setErr("Add the cook's name, or skip for now.");
            onSave({ name: name.trim(), phone: phone.trim() || undefined, language: lang, frequency: freq });
          }}
        >
          {busy ? "Saving…" : "Finish setup"}
        </ContinueButton>
        <SkipButton onClick={onSkip}>Skip for now</SkipButton>
      </ActionBar>
    </StepCanvas>
  );
}
