"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { brand } from "@/lib/brand";

type Props = { onDone: (name: string, language: "en" | "hi" | "kn") => void };

export function Onboarding({ onDone }: Props) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "kn">("en");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  function commit(useDefault = false) {
    onDone(useDefault ? "friend" : name.trim() || "friend", language);
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-between bg-bg px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),3rem)] dark:bg-bg-dark">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="animate-fade-in">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
            <Logo size={26} />
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Hi. I&apos;m the {brand.name} assistant.
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/65 dark:text-white/65">
            Before we start, just one thing — so I know who I&apos;m talking to.
          </p>
        </div>

        <div className="mt-10 animate-slide-up">
          <label className="block text-[13px] font-medium text-ink/70 dark:text-white/70">
            What should I call you?
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            placeholder="Your name, or a nickname"
            autoCapitalize="words"
            className="mt-2 block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[17px] outline-none transition focus:border-brand/50 dark:border-line-dark dark:bg-surface-dark dark:text-white"
          />

          <div className="mt-6">
            <div className="mb-2 text-[13px] font-medium text-ink/70 dark:text-white/70">
              Which language feels easiest?
            </div>
            <div className="flex gap-2">
              {([
                ["en", "English"],
                ["hi", "हिन्दी"],
                ["kn", "ಕನ್ನಡ"],
              ] as const).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  className={`flex-1 rounded-2xl border px-3 py-2.5 text-[15px] transition ${
                    language === code
                      ? "border-brand bg-brand/10 text-brand dark:text-white"
                      : "border-line bg-surface text-ink/70 dark:border-line-dark dark:bg-surface-dark dark:text-white/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md animate-slide-up space-y-2 [animation-delay:80ms]">
        <button
          onClick={() => commit()}
          className="w-full rounded-2xl bg-brand py-4 text-[16px] font-semibold text-white shadow-sm transition active:bg-brand-deep active:scale-[0.99]"
        >
          Start talking
        </button>
        <button
          onClick={() => commit(true)}
          className="block w-full rounded-2xl py-3 text-[14px] text-ink/55 active:text-ink/80 dark:text-white/55"
        >
          Just call me &ldquo;friend&rdquo;
        </button>
      </div>
    </div>
  );
}
