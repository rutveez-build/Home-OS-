"use client";

// Account screen (signup/login), Kitchen Stream style — the assistant greets
// you in a chat bubble and the form sits on the stream background. Logic is
// unchanged from the cream version; only the skin moved to stream tokens.

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { Bubble, Icon, SystemNote, ThemeToggle } from "./stream/kit";

type Props = {
  // email set → account session already established by /api/auth
  onDone: (name: string, language: "en" | "hi" | "kn", email?: string) => void;
};

const input =
  "mt-1.5 block w-full rounded-xl border border-stream-line bg-stream-bubble-in px-4 py-3 text-[16px] text-stream-ink shadow-card outline-none transition placeholder:text-stream-mute focus:border-stream-primary";
const label = "block text-[13px] font-semibold text-stream-ink";

export function Onboarding({ onDone }: Props) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "kn">("en");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    setError("");
    if (mode === "signup" && !name.trim()) return setError("Tell me your name first.");
    if (!email.trim()) return setError("An email is needed so you can log in from any device.");
    if (password.length < 8) return setError("Password needs at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { mode, name: name.trim(), email: email.trim(), password, language, phone: phone.trim() }
            : { mode, email: email.trim(), password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Something went wrong — try again.");
      onDone(data.name ?? name.trim() ?? "friend", (data.language as "en" | "hi" | "kn") ?? language, email.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-stream-chat text-stream-ink">
      <header className="fixed top-0 inset-x-0 z-40 flex h-14 items-center gap-3 bg-stream-header px-4 text-stream-on-header shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <Icon name="cottage" fill className="text-[18px]" />
        </span>
        <h1 className="flex-1 text-[18px] font-semibold">{brand.name}</h1>
        <ThemeToggle />
      </header>

      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2 px-4 pb-44 pt-20">
        <SystemNote>{mode === "signup" ? "New household" : "Welcome back"}</SystemNote>
        <Bubble direction="in" time="Just now" className="mt-2">
          {mode === "signup"
            ? `Hi! I'm the ${brand.name} assistant. A quick account, and your household follows you across devices.`
            : "Welcome back. Log in to pick up where your family left off."}
        </Bubble>

        <div className="mt-3 space-y-4 rounded-xl border border-stream-line bg-stream-surface p-4 shadow-card">
          {mode === "signup" && (
            <div>
              <label className={label}>What should I call you?</label>
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 32))}
                placeholder="Your name, or a nickname"
                autoCapitalize="words"
                className={input}
              />
            </div>
          )}
          <div>
            <label className={label}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              className={input}
            />
          </div>
          <div>
            <label className={label}>
              Password {mode === "signup" && <span className="font-normal text-stream-mute">(8+ characters)</span>}
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={input}
            />
          </div>
          {mode === "signup" && (
            <>
              <div>
                <label className={label}>
                  WhatsApp number <span className="font-normal text-stream-mute">(optional — for later)</span>
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  type="tel"
                  className={input}
                />
              </div>
              <div>
                <div className={`${label} mb-2`}>Which language feels easiest?</div>
                <div className="flex gap-2">
                  {([["en", "English"], ["hi", "हिन्दी"], ["kn", "ಕನ್ನಡ"]] as const).map(([code, l]) => (
                    <button
                      key={code}
                      onClick={() => setLanguage(code)}
                      className={`flex-1 rounded-full border px-3 py-2.5 text-[14px] font-semibold shadow-card transition-colors ${
                        language === code
                          ? "border-stream-primary bg-stream-primary text-stream-on-primary"
                          : "border-stream-line bg-stream-bubble-in text-stream-ink hover:bg-stream-primary/10"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {error && <p className="text-[13px] font-medium text-stream-danger">{error}</p>}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-stream-line bg-stream-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-[600px] flex-col gap-1">
          <button
            onClick={submit}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-stream-primary py-3.5 text-[13px] font-bold uppercase tracking-wide text-stream-on-primary shadow-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "One moment…" : mode === "signup" ? "Create my account" : "Log in"}
          </button>
          <button
            onClick={() => {
              setError("");
              setMode(mode === "signup" ? "login" : "signup");
            }}
            className="w-full rounded-xl py-2.5 text-[13px] font-medium text-stream-mute transition-colors hover:text-stream-ink"
          >
            {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}
