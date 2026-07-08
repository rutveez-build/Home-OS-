"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { brand } from "@/lib/brand";

type Props = {
  // email set → account session already established by /api/auth
  onDone: (name: string, language: "en" | "hi" | "kn", email?: string) => void;
};

const input =
  "mt-2 block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[17px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white";
const label = "block text-[13px] font-medium text-ink/70 dark:text-white/70";

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
    <div className="flex min-h-dvh flex-col items-center bg-bg px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),2.5rem)] dark:bg-bg-dark">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">
        <div className="animate-fade-in">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
            <Logo size={26} />
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            {mode === "signup" ? <>Hi. I&apos;m the {brand.name} assistant.</> : <>Welcome back.</>}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/65 dark:text-white/65">
            {mode === "signup"
              ? "A quick account so your household follows you across devices."
              : "Log in to pick up where your family left off."}
          </p>
        </div>

        <div className="mt-8 animate-slide-up space-y-4">
          {mode === "signup" && (
            <div>
              <label className={label}>What should I call you?</label>
              <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} placeholder="Your name, or a nickname" autoCapitalize="words" className={input} />
            </div>
          )}
          <div>
            <label className={label}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" className={input} />
          </div>
          <div>
            <label className={label}>Password {mode === "signup" && <span className="opacity-60">(8+ characters)</span>}</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} className={input} />
          </div>
          {mode === "signup" && (
            <>
              <div>
                <label className={label}>WhatsApp number <span className="opacity-60">(optional — for later)</span></label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" type="tel" className={input} />
              </div>
              <div>
                <div className={`${label} mb-2`}>Which language feels easiest?</div>
                <div className="flex gap-2">
                  {([["en", "English"], ["hi", "हिन्दी"], ["kn", "ಕನ್ನಡ"]] as const).map(([code, l]) => (
                    <button key={code} onClick={() => setLanguage(code)}
                      className={`flex-1 rounded-2xl border px-3 py-2.5 text-[15px] transition ${language === code ? "border-brand bg-brand/10 text-brand dark:text-white" : "border-line bg-surface text-ink/70 dark:border-line-dark dark:bg-surface-dark dark:text-white/70"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {error && <p className="text-[14px] text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md animate-slide-up space-y-2 [animation-delay:80ms]">
        <button onClick={submit} disabled={busy}
          className="w-full rounded-2xl bg-brand py-4 text-[16px] font-semibold text-white shadow-sm transition active:bg-brand-deep active:scale-[0.99] disabled:opacity-50">
          {busy ? "One moment…" : mode === "signup" ? "Create my account" : "Log in"}
        </button>
        <button onClick={() => { setError(""); setMode(mode === "signup" ? "login" : "signup"); }}
          className="block w-full rounded-2xl py-3 text-[14px] text-ink/55 active:text-ink/80 dark:text-white/55">
          {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
