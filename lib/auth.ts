// Client-side PIN gate using SHA-256.
// The hash is configured via NEXT_PUBLIC_DASHBOARD_PIN_HASH at build time
// (falls back to the v1 hash for "1973" so dev still works without env config).

export const PIN_STORAGE_KEY = "fwp_auth";

const FALLBACK_PIN_HASH =
  "9baed8fceea6e36d36670d72429d909547165efc038c293a14a41ef2edf83141";

export function getExpectedHash(): string {
  // GitHub Actions interpolates an unset secret to an empty string, so we
  // explicitly check for that case in addition to undefined.
  const envHash = process.env.NEXT_PUBLIC_DASHBOARD_PIN_HASH?.trim();
  return envHash ? envHash.toLowerCase() : FALLBACK_PIN_HASH;
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = await sha256(pin);
  return hash === getExpectedHash();
}

// Same-tab sessionStorage writes do not fire the "storage" event, so the
// gate subscribes here and mark/sign-out notify explicitly.
const listeners = new Set<() => void>();

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(PIN_STORAGE_KEY) === "true";
}

export function markAuthenticated(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PIN_STORAGE_KEY, "true");
  notify();
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PIN_STORAGE_KEY);
  notify();
}
