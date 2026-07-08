export type Profile = {
  name: string;
  language: "en" | "hi" | "kn";
  deviceId: string;
  onboardedAt: string;
};

const KEY = "familyos.profile";

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p.name && p.deviceId ? p : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearProfile() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

export function newDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
