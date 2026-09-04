"use client";

import { useSyncExternalStore } from "react";
import { isAuthenticated, subscribeAuth } from "@/lib/auth";
import { PinWall } from "./pin-wall";

// null = not yet known (server render and the first hydration pass);
// afterwards it mirrors sessionStorage through subscribeAuth().
function getSnapshot(): boolean | null {
  return isAuthenticated();
}
function getServerSnapshot(): boolean | null {
  return null;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const authed = useSyncExternalStore(subscribeAuth, getSnapshot, getServerSnapshot);

  if (authed === null) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-background">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-ink-muted">
          Loading
        </div>
      </div>
    );
  }

  // PinWall calls markAuthenticated(), which notifies the store; nothing
  // else to do on success.
  if (!authed) return <PinWall onSuccess={() => undefined} />;

  return <>{children}</>;
}
