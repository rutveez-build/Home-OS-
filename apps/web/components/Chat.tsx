"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "./Onboarding";
import HouseholdApp from "./HouseholdApp";
import { loadProfile, newDeviceId, saveProfile, type Profile } from "@/lib/storage";

export default function Chat() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  // Guests get a device-bound session; account users already hold the
  // cookie from /api/auth (multi-device, survives reinstalls).
  useEffect(() => {
    if (!profile || profile.email) return;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: profile.deviceId, name: profile.name, language: profile.language }),
    }).catch(() => {});
  }, [profile]);

  if (!ready) return <div className="h-dvh bg-bg dark:bg-bg-dark" />;
  if (!profile)
    return (
      <Onboarding
        onDone={(name, language, email) => {
          const p: Profile = { name, language, email, deviceId: newDeviceId(), onboardedAt: new Date().toISOString() };
          saveProfile(p);
          setProfile(p);
        }}
      />
    );

  return <HouseholdApp userName={profile.name} />;
}
