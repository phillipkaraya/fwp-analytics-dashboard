"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { DataStatusBar } from "./data-status-bar";
import { cn } from "@/lib/utils";

/**
 * On the Overview the header sits inside the dark hero band; everywhere else
 * it is a slim sticky bar over the light-blue page. Both variants share the
 * same row: brand, segmented nav, live status.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const onOverview = pathname.replace(/\/+$/, "") === "";
  const tone = onOverview ? "dark" : "light";

  return (
    <div className="min-h-screen bg-background">
      <header
        className={cn(
          onOverview
            ? "bg-[var(--ink)] text-white"
            : "sticky top-0 z-30 border-b border-border bg-background/85 text-ink backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.22em]",
                onOverview ? "text-white/60" : "text-ink-muted",
              )}
            >
              Finance With Phil
            </p>
            <span
              aria-hidden
              className={cn("h-3 w-px", onOverview ? "bg-white/25" : "bg-border")}
            />
            <h1 className="font-display text-base font-medium leading-none">
              Social Media{" "}
              <em className={cn("italic", onOverview ? "text-white" : "text-brand")}>
                Analytics
              </em>
            </h1>
          </div>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <Nav tone={tone} />
          </div>
          <DataStatusBar tone={tone} />
        </div>
      </header>
      <main className={cn(!onOverview && "mx-auto max-w-[1500px] px-6 py-8")}>
        {children}
      </main>
    </div>
  );
}
