"use client";

// The real kitchen-loop UI — matches the approved clickable prototype
// (household setup -> weekly plan -> approve -> cook message -> shopping
// list) wired to the actual backend via /api/app/*. Free-text chat stays
// available as its own tab for anything outside this structured flow.

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import {
  TopBar as StreamTopBar,
  TopBarAction,
  BottomNav,
  EmptyState,
  type NavKey,
} from "./stream/kit";
import { WizardBar, FamilyStep, PrefsStep, CookStep } from "./stream/Wizard";
import { HomeFeed } from "./stream/HomeFeed";
import { relativeDay } from "./stream/types";
import { PlanScreen } from "./stream/PlanScreen";
import { HandoffScreen } from "./stream/HandoffScreen";
import { ShoppingScreen } from "./stream/ShoppingScreen";
import { FeedbackScreen } from "./stream/FeedbackScreen";
import { PurchasesScreen } from "./stream/PurchasesScreen";
import { HubScreen } from "./stream/HubScreen";

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

type Screen = "loading" | "wizard-family" | "wizard-prefs" | "wizard-cook" | "home" | "plan" | "handoff" | "list" | "feedback" | "purchases" | "inventory" | "hub" | "connect" | "freechat";
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

  if (screen === "loading") return <div className="flex h-dvh items-center justify-center bg-stream-bg"><ThinkingDots /></div>;

  const inWizard = screen.startsWith("wizard");
  const navActive: NavKey =
    screen === "plan" || screen === "handoff" || screen === "list"
      ? "plan"
      : screen === "purchases" || screen === "feedback" || screen === "inventory"
        ? screen
        : "home";

  return (
    <div className="flex h-dvh flex-col bg-stream-bg text-stream-ink">
      {inWizard ? (
        <WizardBar step={screen === "wizard-family" ? 1 : screen === "wizard-prefs" ? 2 : 3} />
      ) : (
        <StreamTopBar
          title={family?.name ?? brand.name}
          actions={
            <>
              <TopBarAction icon="forum" label="Assistant chat" onClick={() => setScreen("freechat")} />
              <TopBarAction icon="settings" label="Household settings" onClick={() => setScreen("hub")} />
            </>
          }
        />
      )}
      {notice && (
        <div className="fixed inset-x-0 top-16 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-stream-primary px-4 py-2 text-[13px] font-medium text-stream-on-primary shadow-lg">
          {notice}
        </div>
      )}
      <div className={`flex-1 overflow-y-auto pt-14 ${inWizard ? "" : "pb-14"}`}>
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
                setScreen(cook ? "home" : "wizard-cook");
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
          <HomeFeed
            userName={userName}
            familyName={family?.name ?? "your household"}
            plan={plan}
            busy={busy}
            canManage={["owner", "parent", "partner"].includes(family?.role ?? "")}
            onOpenFeedback={() => setScreen("feedback")}
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
        {screen === "hub" && family && (
          <HubScreen
            family={family}
            profile={profile}
            cook={cook}
            canManage={["owner", "parent", "partner"].includes(family?.role ?? "")}
            flash={flash}
            onEditPrefs={() => setScreen("wizard-prefs")}
            onEditCook={() => setScreen("wizard-cook")}
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
          <ShoppingScreen
            shoppingList={shoppingList}
            busy={busy}
            flash={flash}
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
        {screen === "inventory" && (
          <EmptyState
            icon="inventory_2"
            title="Kitchen inventory is on its way"
            body="Pantry tracking with expiring-soon alerts lands here shortly."
          />
        )}
        {screen === "freechat" && <FreeChat onBack={() => setScreen(plan ? "plan" : "home")} />}
      </div>
      {!inWizard && (
        <BottomNav
          active={navActive}
          onNavigate={(k) => setScreen(k === "plan" && !plan ? "home" : k)}
        />
      )}
    </div>
  );
}

/* ─────────── shared bits ─────────── */

/* Old cream TopBar deleted — chrome now comes from components/stream/kit. */

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
        <div className="mb-4 rounded-xl border-2 border-stream-primary bg-stream-primary/10 p-4">
          <p className="text-[13.5px] font-semibold">Token for “{minted.label}” — shown once</p>
          <p className="mt-1 text-[12px] text-stream-mute">Copy it now. It can't be shown again — you'd need to create a new one.</p>
          <div className="mt-2 break-all rounded-xl bg-stream-surface px-3 py-2 font-mono text-[12px]">{minted.token}</div>
          <button onClick={() => copy(minted.token)} className="mt-2 w-full rounded-xl bg-stream-primary py-2 text-[13px] font-semibold text-stream-on-primary">Copy token</button>

          <div className="mt-4 border-t border-stream-line/60 pt-3">
            <p className="text-[12.5px] font-semibold">Connect it to</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CONNECT_CLIENTS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setConnectClient(c.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium ${
                    connectClient === c.key ? "bg-stream-primary text-stream-on-primary" : "border border-stream-line"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {connectClient === "claude-cli" && (
              <div className="mt-2.5">
                <p className="text-[12px] text-stream-mute">Run this in a terminal:</p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-stream-surface px-3 py-2 font-mono text-[11.5px]">
{`claude mcp add home-os --url ${mcpUrl} \\\n  --header "Authorization: Bearer ${minted.token}"`}
                </pre>
                <button
                  onClick={() => copy(`claude mcp add home-os --url ${mcpUrl} --header "Authorization: Bearer ${minted.token}"`)}
                  className="mt-1.5 rounded-lg border border-stream-line px-2.5 py-1 text-[11.5px] font-medium"
                >
                  Copy command
                </button>
              </div>
            )}

            {connectClient === "codex" && (
              <div className="mt-2.5">
                <p className="text-[12px] text-stream-mute">
                  Add this to <code className="font-mono">~/.codex/config.toml</code>:
                </p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-stream-surface px-3 py-2 font-mono text-[11.5px]">
{`[mcp_servers.home-os]\nurl = "${mcpUrl}"\nbearer_token = "${minted.token}"`}
                </pre>
                <button
                  onClick={() => copy(`[mcp_servers.home-os]\nurl = "${mcpUrl}"\nbearer_token = "${minted.token}"`)}
                  className="mt-1.5 rounded-lg border border-stream-line px-2.5 py-1 text-[11.5px] font-medium"
                >
                  Copy block
                </button>
              </div>
            )}

            {connectClient === "claude-web" && (
              <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-[12px] text-stream-ink/80">
                <li>On claude.ai, go to <b>Settings → Connectors → Add custom connector</b>.</li>
                <li>Paste the Server URL shown above — that's the only field it needs.</li>
                <li>Claude opens a Home OS sign-in + approval screen — sign in and tap <b>Approve</b> there (not here).</li>
                <li>Claude can now use Home OS in any chat.</li>
              </ol>
            )}

            {connectClient === "chatgpt" && (
              <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-[12px] text-stream-ink/80">
                <li>In ChatGPT, go to <b>Settings → Connectors</b> (turn on Developer Mode first if you don't see "Add connector").</li>
                <li>Paste the Server URL shown above — that's the only field it needs.</li>
                <li>ChatGPT opens a Home OS sign-in + approval screen — sign in and tap <b>Approve</b> there (not here).</li>
                <li>ChatGPT can now use Home OS in any chat.</li>
              </ol>
            )}

            {(connectClient === "claude-web" || connectClient === "chatgpt") && (
              <p className="mt-2 text-[11px] text-stream-mute">
                No need to copy the token above for this one — it signs in and approves the connection itself. The token above is only for the CLI tabs.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-stream-line bg-stream-surface p-4">
        <label className="block text-[12.5px] font-semibold">Server URL</label>
        <div className="mt-1.5 flex gap-2">
          <div className="flex-1 truncate rounded-xl border border-stream-line bg-stream-bg px-3 py-2 font-mono text-[12px]">{mcpUrl}</div>
          <button onClick={() => copy(mcpUrl)} className="shrink-0 rounded-xl border border-stream-line px-3 text-[12px] font-medium">Copy</button>
        </div>

        <label className="mt-3 block text-[12.5px] font-semibold">New connector</label>
        <div className="mt-1.5 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. ChatGPT"
            className="flex-1 rounded-xl border border-stream-line bg-stream-bg px-3 py-2 text-[14px] outline-none"
          />
          <button onClick={create} disabled={busy} className="shrink-0 rounded-xl bg-stream-primary px-4 text-[13px] font-semibold text-stream-on-primary disabled:opacity-50">{busy ? "…" : "Create"}</button>
        </div>
      </div>

      <h2 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-stream-primary">Active connectors</h2>
      {tokens === null ? (
        <ThinkingDots />
      ) : tokens.filter((t) => !t.revokedAt).length === 0 ? (
        <p className="mt-2 text-[13.5px] text-stream-mute">None yet — create one above.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {tokens.filter((t) => !t.revokedAt).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-stream-line bg-stream-surface p-3.5">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{t.label}</p>
                <p className="text-[11.5px] text-stream-mute">
                  {t.lastUsedAt ? `Last used ${relativeDay(t.lastUsedAt)}` : "Never used yet"}
                </p>
              </div>
              <button onClick={() => revoke(t.id)} className="shrink-0 rounded-lg border border-stream-danger/40 px-2.5 py-1 text-[11.5px] font-medium text-stream-danger">Revoke</button>
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
                ? "max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-md bg-stream-bubble-out px-4 py-2.5 text-[15px] leading-relaxed text-stream-on-bubble-out shadow-card"
                : "max-w-[88%] whitespace-pre-wrap rounded-xl rounded-bl-md bg-stream-surface px-4 py-3 text-[15px] leading-relaxed shadow-card"}>
                {m.content || (pending && i === messages.length - 1 ? <ThinkingDots /> : null)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-stream-line bg-stream-bg/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => setShowCommands((v) => !v)}
            className="mb-1.5 flex items-center gap-1 text-[12px] font-medium text-stream-mute"
          >
            <span>{showCommands ? "▾" : "▸"}</span> Commands — tap instead of typing
          </button>
          {showCommands && (
            <div className="mb-2 space-y-1.5">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stream-primary">Tap to run</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_COMMANDS.map((c) => (
                    <button
                      key={c.cmd}
                      onClick={() => send(c.cmd)}
                      disabled={pending}
                      className="shrink-0 whitespace-nowrap rounded-full border border-stream-primary bg-stream-primary/10 px-3 py-1.5 text-[12.5px] font-medium text-stream-primary disabled:opacity-40"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stream-mute">Tap to fill in, then send</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {TEMPLATE_COMMANDS.map((c) => (
                    <button
                      key={c.cmd}
                      onClick={() => { setInput(c.cmd); inputRef.current?.focus(); }}
                      className="shrink-0 whitespace-nowrap rounded-full border border-stream-line px-3 py-1.5 text-[12.5px] font-medium text-stream-ink/80"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button onClick={onBack} className="shrink-0 rounded-full border border-stream-line px-3 py-2.5 text-[12.5px] font-medium">← Back</button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…"
              rows={1}
              className="block w-full max-h-32 min-h-[44px] resize-none rounded-xl border border-stream-line bg-stream-surface px-4 py-2.5 text-[15px] leading-snug outline-none focus:border-stream-primary/40"
            />
            <button onClick={() => send()} disabled={pending || !input.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stream-primary text-stream-on-primary disabled:opacity-30">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
