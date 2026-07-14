"use client";

// Operator dashboard — signups, emails, light profiling. Server-side gated
// to ADMIN_EMAILS; this page just renders what /api/admin/users allows.

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  language: string;
  createdAt: string;
  lastSeenAt: string;
  family: string | null;
  role: string | null;
  messages: number;
};
type AdminData = {
  totals: { users: number; signups7d: number; withEmail: number; inFamilies: number };
  users: AdminUser[];
};

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-stream-ink">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-stream-mute">
          {error}. Log in at <a className="text-stream-primary underline" href="/chat">/chat</a> with an
          account listed in <code>ADMIN_EMAILS</code>, then come back.
        </p>
      </main>
    );
  }
  if (!data) {
    return <main className="mx-auto max-w-2xl px-6 py-16 text-stream-mute">Loading…</main>;
  }

  const tiles = [
    { label: "Total users", value: data.totals.users },
    { label: "Signups · 7 days", value: data.totals.signups7d },
    { label: "With email", value: data.totals.withEmail },
    { label: "In a household", value: data.totals.inFamilies },
  ];

  return (
    <main className="min-h-dvh bg-stream-bg px-4 py-8 text-stream-ink">
      <div className="mx-auto max-w-5xl">
        <header className="art-hero relative -mx-4 -mt-8 mb-6 px-6 pb-6 pt-8">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-stream-bg/40 to-stream-bg" />
          <div className="relative">
            <h1 className="text-2xl font-semibold">Operator dashboard</h1>
            <p className="text-sm text-stream-mute">Signups, emails, and activity — read-only.</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-stream-line bg-stream-surface p-4 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stream-mute">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold text-stream-primary">{t.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-stream-line bg-stream-surface shadow-card">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-stream-line text-[11px] uppercase tracking-widest text-stream-mute">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Household</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Lang</th>
                <th className="px-4 py-3 text-right">Msgs</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stream-line">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5">{u.email ?? <span className="text-stream-mute">guest</span>}</td>
                  <td className="px-4 py-2.5">{u.family ?? "—"}</td>
                  <td className="px-4 py-2.5">{u.role ?? "—"}</td>
                  <td className="px-4 py-2.5">{u.language}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{u.messages}</td>
                  <td className="px-4 py-2.5 text-stream-mute">{ago(u.createdAt)}</td>
                  <td className="px-4 py-2.5 text-stream-mute">{ago(u.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
