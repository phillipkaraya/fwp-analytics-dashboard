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

export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="-mx-6 overflow-x-auto px-6 pb-px"
    >
      <ul className="flex min-w-max gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "relative inline-block whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-brand"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
