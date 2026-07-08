"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { clearProfile, loadProfile, newDeviceId, saveProfile, type Profile } from "@/lib/storage";

type Msg = { role: "user" | "assistant"; content: string };

function welcomeFor(name: string): Msg {
  const greeting = name && name !== "friend" ? `Hi ${name}.` : "Hi.";
  return {
    role: "assistant",
    content: `${greeting} I'm here to listen, and to help your family with the everyday. Tell me what's on your mind.`,
  };
}

export default function Chat() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  if (!ready) return <div className="h-dvh bg-bg dark:bg-bg-dark" />;
  if (!profile)
    return (
      <Onboarding
        onDone={(name, language) => {
          const p: Profile = { name, language, deviceId: newDeviceId(), onboardedAt: new Date().toISOString() };
          saveProfile(p);
          setProfile(p);
        }}
      />
    );
  return <ChatRoom profile={profile} onResetProfile={() => { clearProfile(); setProfile(null); }} />;
}

function ChatRoom({ profile, onResetProfile }: { profile: Profile; onResetProfile: () => void }) {
  const [messages, setMessages] = useState<Msg[]>(() => [welcomeFor(profile.name)]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function autoSize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          profile: { name: profile.name, language: profile.language, deviceId: profile.deviceId },
        }),
      });
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
      inputRef.current?.focus();
    }
  }

  const initial = useMemo(() => (profile.name || "F").trim().charAt(0).toUpperCase(), [profile.name]);

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink dark:bg-bg-dark dark:text-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line/60 bg-bg/85 px-3 py-2.5 backdrop-blur dark:border-line-dark/60 dark:bg-bg-dark/85">
        <button
          onClick={() => { if (confirm("Reset profile?")) onResetProfile(); }}
          aria-label="Profile"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[13px] font-semibold text-brand dark:bg-white/10 dark:text-white/90"
        >
          {initial}
        </button>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-brand dark:text-white/90"><Logo size={18} /></span>
          <span className="text-[15px] font-semibold tracking-tight">Family assistant</span>
        </div>
      </header>

      <main ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mx-auto max-w-2xl space-y-2.5">
          {messages.map((m, i) => (<Bubble key={i} msg={m} streaming={pending && i === messages.length - 1} />))}
        </div>
      </main>

      <footer className="bg-bg/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur dark:bg-bg-dark/95">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoSize(e.target); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            placeholder="Tell me what's going on…"
            rows={1}
            className="block w-full max-h-40 min-h-[48px] resize-none rounded-3xl border border-line bg-surface px-4 py-3 text-[16px] leading-snug shadow-bubble outline-none transition focus:border-brand/40 dark:border-line-dark dark:bg-surface-dark dark:text-white"
          />
          <button
            onClick={send}
            disabled={pending || !input.trim()}
            aria-label="Send"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-bubble transition active:scale-95 disabled:opacity-30"
          >
            {pending ? <Dots /> : <SendArrow />}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Bubble({ msg, streaming }: { msg: Msg; streaming: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex animate-bubble-in ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser
        ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15.5px] leading-relaxed text-white shadow-bubble"
        : "max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-[15.5px] leading-relaxed text-ink shadow-bubble dark:bg-surface-dark dark:text-white"}>
        {msg.content || (streaming ? <ThinkingDots /> : null)}
      </div>
    </div>
  );
}

function SendArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
    </svg>
  );
}
function Dots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />
      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current [animation-delay:160ms]" />
      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current [animation-delay:320ms]" />
    </span>
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
