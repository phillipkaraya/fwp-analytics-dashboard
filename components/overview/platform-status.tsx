import { fmt, fmtDate, platformLabel, relativeTime } from "@/lib/format";
import { PlatformDot } from "@/components/charts/platform-badge";
import {
  PLATFORMS,
  byPlatform,
  followerDeltas,
  platformCadence,
  platformLastPosted,
} from "@/lib/derive";
import type { FollowerSnapshot, Platform, Post, ScrapeState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlatformStatusRow({
  posts,
  scrape,
  history,
}: {
  posts: Post[];
  scrape: ScrapeState;
  history: FollowerSnapshot[];
}) {
  const grouped = byPlatform(posts, (p) => p.platform);
  const deltas = followerDeltas(history);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {PLATFORMS.map((p, i) => {
        const last = platformLastPosted(grouped[p]);
        const cad = platformCadence(grouped[p]);
        const followers = scrape.followers?.[p] ?? 0;
        const delta = deltas.byPlatform[p];
        const stale = (last.daysAgo ?? 0) > 7;
        return (
          <div
            key={p}
            className="rise rounded-lg border border-border bg-card p-4 shadow-sm"
            style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlatformDot platform={p} />
                <h4 className="text-sm font-semibold text-ink">
                  {platformLabel[p]}
                </h4>
              </div>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                  stale
                    ? "bg-warn-soft text-warn"
                    : "bg-positive-soft text-positive",
                )}
              >
                {stale ? "quiet" : "active"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <p className="font-display tabular text-2xl font-semibold leading-none text-ink">
                {fmt(followers)}
              </p>
              <span className="text-xs text-ink-muted">followers</span>
              {delta !== null && deltas.since && (
                <span
                  className={cn(
                    "tabular ml-auto font-mono text-[11px]",
                    delta > 0
                      ? "text-positive"
                      : delta < 0
                        ? "text-negative"
                        : "text-ink-muted",
                  )}
                  title={`Since ${fmtDate(deltas.since)}`}
                >
                  {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                  {fmt(Math.abs(delta))}
                </span>
              )}
            </div>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              <div className="flex justify-between">
                <dt>Last post</dt>
                <dd className="text-ink-soft">
                  {last.date ? relativeTime(last.date) : "none"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Cadence</dt>
                <dd className="tabular text-ink-soft">
                  {cad.perWeek.toFixed(1)}/wk · {cad.perMonth.toFixed(1)}/mo
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Posts</dt>
                <dd className="tabular text-ink-soft">
                  {fmt(grouped[p].length)}
                </dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

export type { Platform };
