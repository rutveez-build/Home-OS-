"use client";

/**
 * "Kitchen Stream" component kit — the shared primitives every rebuilt screen
 * uses. Visual language comes from the Stitch "HomeOS Kitchen Chat" mocks:
 * teal top app bar, card canvas, chat bubbles with tail corners, bottom nav,
 * Material Symbols icons. Colors are `stream-*` Tailwind tokens backed by
 * CSS variables, so dark mode is automatic — no dark: classes here.
 */

import { ReactNode } from "react";

/* ── icons ─────────────────────────────────────────────────────────── */

export function Icon({
  name,
  fill = false,
  className = "",
}: {
  name: string;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined select-none ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

/* ── chrome: top bar, bottom nav, screen canvas ────────────────────── */

export function TopBar({
  title,
  subtitle,
  onBack,
  leading,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 flex h-14 items-center justify-between bg-stream-header px-2 text-stream-on-header shadow-sm">
      <div className="flex min-w-0 items-center gap-1">
        {onBack ? (
          <button
            aria-label="Back"
            onClick={onBack}
            className="rounded-full p-2 transition-colors hover:bg-black/10"
          >
            <Icon name="arrow_back" />
          </button>
        ) : (
          <span className="w-2" />
        )}
        {leading}
        <div className="min-w-0 px-1">
          <h1 className="truncate text-[18px] font-semibold leading-tight">{title}</h1>
          {subtitle && (
            <p className="truncate text-[12px] leading-tight opacity-80">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1 pr-1">{actions}</div>}
    </header>
  );
}

/** Manual light/dark switch — the user designed both verticals in Stitch.
 * Defaults to the OS scheme; an explicit choice persists in localStorage. */
export function ThemeToggle() {
  function current(): "light" | "dark" {
    const set = document.documentElement.dataset.theme;
    if (set === "light" || set === "dark") return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return (
    <button
      aria-label="Toggle light/dark theme"
      title="Light / dark"
      onClick={() => {
        const next = current() === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
      className="rounded-full p-2 transition-colors hover:bg-black/10"
    >
      <Icon name="routine" />
    </button>
  );
}

export function TopBarAction({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full p-2 transition-colors hover:bg-black/10"
    >
      <Icon name={icon} />
    </button>
  );
}

// Destinations mirror the approved Stitch mock's bottom nav exactly.
// Shopping is reached from Plan, the Hub from the top bar, Chat from Home.
export type NavKey = "home" | "inventory" | "plan" | "purchases" | "feedback";

const NAV_ITEMS: { key: NavKey; icon: string; label: string }[] = [
  { key: "home", icon: "chat", label: "Home" },
  { key: "inventory", icon: "inventory_2", label: "Inventory" },
  { key: "plan", icon: "restaurant_menu", label: "Plan" },
  { key: "purchases", icon: "receipt_long", label: "Purchases" },
  { key: "feedback", icon: "rate_review", label: "Feedback" },
];

export function BottomNav({
  active,
  onNavigate,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-14 items-center justify-around border-t border-stream-line bg-stream-surface pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center justify-center px-3 py-1 transition-colors ${
              isActive ? "text-stream-primary" : "text-stream-mute hover:text-stream-ink"
            }`}
          >
            <Icon name={item.icon} fill={isActive} className="text-[22px]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Main scrollable canvas between the fixed top bar and bottom nav. */
export function Screen({
  children,
  chat = false,
  bottomNav = true,
}: {
  children: ReactNode;
  /** chat screens use the darker stream background */
  chat?: boolean;
  bottomNav?: boolean;
}) {
  return (
    <main
      className={`min-h-dvh w-full ${chat ? "bg-stream-chat" : "bg-stream-bg"} text-stream-ink`}
    >
      <div
        className={`mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-20 ${
          bottomNav ? "pb-28" : "pb-8"
        }`}
      >
        {children}
      </div>
    </main>
  );
}

/* ── cards ─────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border border-stream-line bg-stream-surface text-left shadow-card ${
        onClick ? "transition-transform active:scale-[0.99]" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** The labeled colored strip across a card's top ("WEEKLY MEAL PLAN"). */
export function CardBanner({
  icon,
  label,
  tone = "primary",
}: {
  icon: string;
  label: string;
  tone?: "primary" | "accent" | "danger";
}) {
  const tones = {
    primary: "bg-stream-primary/5 text-stream-primary",
    accent: "bg-stream-accent/10 text-stream-primary",
    danger: "bg-stream-danger/10 text-stream-danger",
  } as const;
  return (
    <div
      className={`flex items-center gap-2 rounded-t-xl border-b border-stream-line px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider ${tones[tone]}`}
    >
      <Icon name={icon} fill className="text-sm" />
      {label}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h5 className="px-1 text-[11px] font-bold uppercase tracking-widest text-stream-mute">
      {children}
    </h5>
  );
}

/* ── buttons ───────────────────────────────────────────────────────── */

export function PrimaryButton({
  children,
  icon,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-lg bg-stream-primary px-6 py-3 text-xs font-bold uppercase tracking-wide text-stream-on-primary shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {icon && <Icon name={icon} fill className="text-lg" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  icon,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-lg border border-stream-primary/20 bg-stream-primary/5 px-6 py-3 text-xs font-bold uppercase tracking-wide text-stream-primary transition-all hover:bg-stream-primary/10 disabled:opacity-50 ${className}`}
    >
      {icon && <Icon name={icon} className="text-lg" />}
      {children}
    </button>
  );
}

export function Fab({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-stream-accent text-white shadow-lg transition-transform active:scale-95"
    >
      <Icon name={icon} fill className="text-[26px]" />
    </button>
  );
}

/* ── chat primitives ───────────────────────────────────────────────── */

export function Ticks({ read = false }: { read?: boolean }) {
  return (
    <span
      aria-label={read ? "read" : "delivered"}
      className={`inline-flex items-center ${read ? "text-stream-tick" : "text-stream-mute"}`}
    >
      <Icon name="done_all" className="text-[15px]" />
    </span>
  );
}

export function Bubble({
  direction,
  children,
  time,
  ticks,
  className = "",
}: {
  direction: "in" | "out";
  children: ReactNode;
  time?: string;
  ticks?: "sent" | "read";
  className?: string;
}) {
  const isOut = direction === "out";
  return (
    <div
      className={`max-w-[78%] px-3 py-2 text-[15px] leading-snug shadow-card ${
        isOut
          ? "self-end rounded-xl rounded-tr-none bg-stream-bubble-out text-stream-on-bubble-out"
          : "self-start rounded-xl rounded-tl-none bg-stream-bubble-in"
      } ${className}`}
    >
      <div className="whitespace-pre-wrap break-words">{children}</div>
      {(time || ticks) && (
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-stream-mute">
          {time}
          {ticks && <Ticks read={ticks === "read"} />}
        </div>
      )}
    </div>
  );
}

/** Centered gray pill for dates / system events in a stream. */
export function SystemNote({ children }: { children: ReactNode }) {
  return (
    <div className="self-center rounded-lg bg-stream-surface-2 px-3 py-1 text-[12px] font-medium text-stream-mute shadow-card">
      {children}
    </div>
  );
}

/** Fixed bottom pill input bar for chat screens. */
export function InputBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  leftAction,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
  leftAction?: ReactNode;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-stream-line bg-stream-bg px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <form
        className="mx-auto flex max-w-2xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {leftAction}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-full border border-stream-line bg-stream-surface px-4 py-2.5 text-[15px] text-stream-ink placeholder:text-stream-mute focus:outline-none focus:ring-1 focus:ring-stream-primary"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={disabled || !value.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stream-accent text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          <Icon name="send" fill className="text-[20px]" />
        </button>
      </form>
    </div>
  );
}

/* ── small pieces ──────────────────────────────────────────────────── */

export function Chip({
  children,
  icon,
  active = false,
  onClick,
}: {
  children: ReactNode;
  icon?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold ${
        active
          ? "bg-stream-primary text-stream-on-primary"
          : "border border-stream-line bg-stream-surface text-stream-mute"
      }`}
    >
      {icon && <Icon name={icon} fill={active} className="text-[16px]" />}
      {children}
    </Tag>
  );
}

export function CheckToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
        checked
          ? "border-stream-primary bg-stream-primary text-stream-on-primary"
          : "border-stream-mute/50 text-transparent hover:border-stream-primary"
      }`}
    >
      <Icon name="check" fill className="text-[16px]" />
    </button>
  );
}

export function Avatar({
  name,
  icon,
  size = 10,
}: {
  name?: string;
  icon?: string;
  size?: 8 | 10 | 12;
}) {
  const sizes = { 8: "h-8 w-8 text-[13px]", 10: "h-10 w-10 text-[15px]", 12: "h-12 w-12 text-[18px]" };
  const initials = (name ?? "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-stream-primary/15 font-semibold text-stream-primary ${sizes[size]}`}
    >
      {icon ? <Icon name={icon} className="text-[20px]" /> : initials || "?"}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon name={icon} className="text-[40px] text-stream-mute/60" />
      <p className="text-[15px] font-semibold text-stream-ink">{title}</p>
      {body && <p className="max-w-xs text-[13px] text-stream-mute">{body}</p>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-stream-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stream-primary border-t-transparent" />
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  );
}
