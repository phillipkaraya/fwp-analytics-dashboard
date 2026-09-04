import Link from "next/link";
import { Section } from "@/components/charts/section";
import { fmt } from "@/lib/format";
import type { ContentVault } from "@/lib/types";

const MIN_POSTS = 20;

/** Topics ranked by average views per post. The Vault is the full home for
 *  topics; this card is the pointer to it from the Insights story. */
export function TopicsCard({ vault }: { vault: ContentVault }) {
  const rows = vault.categories
    .filter((c) => c.slug !== "other" && c.count >= MIN_POSTS)
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5);
  const max = rows[0]?.avgViews || 1;

  return (
    <Section
      title="Topics that travel"
      hint={`Average views per post, topics with ${MIN_POSTS}+ posts`}
      action={
        <Link
          href="/vault"
          className="whitespace-nowrap text-xs font-medium text-brand underline-offset-4 hover:underline"
        >
          Open in Vault →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          No topics with enough posts yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((c, i) => (
            <li key={c.slug}>
              <Link
                href={{ pathname: "/vault", query: { topic: c.slug } }}
                className="group block"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-ink-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium text-ink group-hover:text-brand">
                      {c.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {fmt(c.count)} posts
                    </span>
                  </span>
                  <span className="tabular text-ink-soft">{fmt(c.avgViews)} avg</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${Math.max(4, (c.avgViews / max) * 100)}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
