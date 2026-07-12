"use client";

// Manage Household Hub — per the "Manage Household Hub" mock: current setup
// (cook, preferences), family members with invites (new UI over the existing
// invitation backend), and connectivity. Role-gated: only managers see the
// invite form and edit actions.

import { useEffect, useState } from "react";
import { Avatar, Card, CardBanner, Chip, Icon, PrimaryButton, SectionLabel, Spinner } from "./kit";
import type { Cook, Family, Profile } from "./types";

type MemberRow = { name: string; role: string; isYou: boolean };

const INVITE_ROLES = ["parent", "partner", "child", "elder", "helper", "member"] as const;

const inputCls =
  "rounded-xl border border-stream-line bg-stream-bg px-3 py-2 text-[14px] text-stream-ink outline-none placeholder:text-stream-mute focus:border-stream-primary";

export function HubScreen({
  family,
  profile,
  cook,
  canManage,
  flash,
  onEditPrefs,
  onEditCook,
  onOpenConnect,
}: {
  family: NonNullable<Family>;
  profile: Profile | null;
  cook: Cook;
  canManage: boolean;
  flash: (m: string) => void;
  onEditPrefs: () => void;
  onEditCook: () => void;
  onOpenConnect: () => void;
}) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]>("member");
  const [inviting, setInviting] = useState(false);

  async function loadMembers() {
    const res = await fetch("/api/app/family");
    const data = await res.json().catch(() => ({}));
    setMembers(data.members ?? []);
  }
  useEffect(() => {
    loadMembers();
  }, []);

  async function invite() {
    if (!inviteName.trim() || !invitePhone.trim()) return flash("Give a name and a phone number.");
    setInviting(true);
    const res = await fetch("/api/app/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inviteName.trim(), phone: invitePhone.trim(), role: inviteRole }),
    });
    const data = await res.json().catch(() => ({}));
    setInviting(false);
    if (!res.ok) return flash(data.error ?? "Couldn't send that invite.");
    flash(`Invited ${data.invited.name} — they join when they accept.`);
    setInviteName("");
    setInvitePhone("");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <section className="px-1">
        <h2 className="text-xl font-semibold">Manage household</h2>
        <p className="text-sm text-stream-mute">{family.name} · you are {family.role}</p>
      </section>

      {/* Current setup */}
      <SectionLabel>Current setup</SectionLabel>
      <Card className="overflow-hidden">
        <CardBanner icon="skillet" label="Cook" />
        <div className="flex items-center gap-3 p-4">
          {cook ? (
            <>
              <Avatar name={cook.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{cook.name}</p>
                <p className="text-[12.5px] text-stream-mute">
                  {cook.phone ?? "No WhatsApp number"} · {cook.language}
                </p>
              </div>
            </>
          ) : (
            <p className="flex-1 text-[13px] text-stream-mute">No cook set up yet.</p>
          )}
          {canManage && (
            <button
              onClick={onEditCook}
              className="shrink-0 rounded-lg border border-stream-primary/20 bg-stream-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-stream-primary"
            >
              {cook ? "Change" : "Add cook"}
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardBanner icon="tune" label="Kitchen preferences" />
        <div className="p-4">
          {profile ? (
            <div className="flex flex-wrap gap-1.5">
              {[...profile.diets, ...profile.cuisines].map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
              {profile.allergies.map((a) => (
                <Chip key={a} icon="warning">
                  {a}
                </Chip>
              ))}
              {profile.budgetBand && <Chip icon="currency_rupee">{profile.budgetBand}</Chip>}
            </div>
          ) : (
            <p className="text-[13px] text-stream-mute">Preferences not set yet.</p>
          )}
          {canManage && (
            <button
              onClick={onEditPrefs}
              className="mt-3 rounded-lg border border-stream-primary/20 bg-stream-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-stream-primary"
            >
              Edit preferences
            </button>
          )}
        </div>
      </Card>

      {/* Family */}
      <SectionLabel>Family</SectionLabel>
      <Card className="overflow-hidden">
        <CardBanner icon="group" label="Members" />
        {members === null ? (
          <Spinner />
        ) : (
          <div className="divide-y divide-stream-line">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} size={8} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {m.name} {m.isYou && <span className="text-[11px] text-stream-mute">(you)</span>}
                  </p>
                </div>
                <span className="rounded-full bg-stream-surface-2 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stream-mute">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <div className="border-t border-stream-line p-4">
            <p className="text-[13px] font-semibold">Invite someone</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Name" className={`${inputCls} min-w-0 flex-1`} />
                <input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="+91XXXXXXXXXX" type="tel" className={`${inputCls} min-w-0 flex-1`} />
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {INVITE_ROLES.map((r) => (
                  <Chip key={r} active={inviteRole === r} onClick={() => setInviteRole(r)}>
                    {r}
                  </Chip>
                ))}
              </div>
              <PrimaryButton icon="person_add" onClick={invite} disabled={inviting}>
                {inviting ? "Inviting…" : "Send invite"}
              </PrimaryButton>
              <p className="text-[11.5px] text-stream-mute">
                They get a WhatsApp message and join by replying YES.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Connectivity */}
      {canManage && (
        <>
          <SectionLabel>Advanced connectivity</SectionLabel>
          <Card onClick={onOpenConnect} className="group flex w-full items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stream-primary/10 text-stream-primary">
                <Icon name="hub" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Connect ChatGPT, Claude, or Codex</h4>
                <p className="text-[12.5px] text-stream-mute">Tokens, OAuth clients, and revocation.</p>
              </div>
            </div>
            <Icon name="arrow_forward" className="text-stream-mute transition-transform group-hover:translate-x-1" />
          </Card>
        </>
      )}
    </div>
  );
}
