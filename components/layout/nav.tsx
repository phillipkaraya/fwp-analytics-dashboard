"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/posts", label: "Post Analysis" },
  { href: "/comments", label: "Comments" },
  { href: "/insights", label: "Insights" },
  { href: "/vault", label: "Content Vault" },
] as const;

export function Nav({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = (usePathname() ?? "/").replace(/\/+$/, "") || "/";
  const dark = tone === "dark";
  return (
    <nav aria-label="Primary" className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <ul
        className={cn(
          "flex min-w-max gap-0.5 rounded-full p-1",
          dark ? "bg-white/10" : "bg-muted",
        )}
      >
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? dark
                      ? "bg-white text-ink shadow-sm"
                      : "bg-card text-brand-deep shadow-sm"
                    : dark
                      ? "text-white/70 hover:bg-white/10 hover:text-white"
                      : "text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
