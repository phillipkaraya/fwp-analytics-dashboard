import Link from "next/link";
import { fmt } from "@/lib/format";
import type { ContentVault } from "@/lib/types";

/**
 * Top topics by total reach, as a horizontally scrolling rail that bleeds
 * past the content column. Each tile deep-links into the Vault with that
 * topic preselected.
 */
export function TopicsRibbon({ vault, limit = 6 }: { vault: ContentVault; limit?: number }) {
  const top = vault.categories
    .filter((c) => c.slug !== "other" && c.count > 0)
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, limit);
  if (top.length === 0) return null;
  const maxViews = top[0].totalViews || 1;

  return (
    <section aria-labelledby="topics-ribbon-heading">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3
            id="topics-ribbon-heading"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
          >
            Topics by reach
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            What the audience actually watches. Open a topic for every post filed under it.
          </p>
        </div>
        <Link
          href="/vault"
          className="whitespace-nowrap text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Open the Vault →
        </Link>
      </div>
      {/* The rail runs past the content column on purpose: one deliberate
          break in the container rhythm, right under the hero. */}
      <div className="-mx-6 mt-4 overflow-x-auto px-6 pb-2 [scrollbar-width:thin]">
        <ol className="flex min-w-max gap-3">
          {top.map((c, i) => (
            <li key={c.slug}>
              <Link
                href={{ pathname: "/vault", query: { topic: c.slug } }}
                className="group block w-[228px] card card-hover p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-ink-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="tabular font-mono text-[11px] text-ink-muted">
                    {fmt(c.count)} posts
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold leading-tight text-ink group-hover:text-brand">
                  {c.label}
                </p>
                <p className="tabular mt-1 text-sm text-ink-soft">
                  {fmt(c.totalViews)} views · {fmt(c.avgViews)} avg
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(4, (c.totalViews / maxViews) * 100)}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
