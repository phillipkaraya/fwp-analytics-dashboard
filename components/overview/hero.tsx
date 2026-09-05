"use client";

import { fmt, fmtDate, fmtShort, numeralShift, platformLabel, relativeTime } from "@/lib/format";
import { PLATFORMS, followerDeltas, pctChange, platformLastPosted, toNum, windowLabel, windowTotals } from "@/lib/derive";
import type { FollowerSnapshot, Post, ScrapeState } from "@/lib/types";
import { PlatformDot } from "@/components/charts/platform-badge";
import { HeroPanel, HeroRow, PageHero, SignedCount } from "@/components/layout/page-hero";

interface HeroProps {
  posts: Post[];
  scrape: ScrapeState;
  history: FollowerSnapshot[];
  /** Rolling window in days, chosen by pickWindow() in the parent. */
  days: number;
}

/** The Overview band: the last window at display size, followers on the right. */
export function Hero({ posts, scrape, history, days }: HeroProps) {
  const cur = windowTotals(posts, days);
  const prev = windowTotals(posts, days, days);
  const deltas = followerDeltas(history);
  const last = platformLastPosted(posts);
  const totalFollowers = PLATFORMS.reduce(
    (sum, p) => sum + (scrape.followers?.[p] ?? 0),
    0,
  );

  return (
    <PageHero
      eyebrow={`${windowLabel(days)} · all platforms`}
      stats={[
        { label: "Views", value: fmtShort(cur.views), pct: pctChange(cur.views, prev.views) },
        { label: "Posts published", value: fmtShort(cur.posts), pct: pctChange(cur.posts, prev.posts) },
        { label: "Likes", value: fmtShort(cur.likes), pct: pctChange(cur.likes, prev.likes) },
        { label: "Comments", value: fmtShort(cur.comments), pct: pctChange(cur.comments, prev.comments) },
      ]}
      footer={
        <p>
          {last.date ? (
            <>
              Last post {fmtDate(last.date)} ({relativeTime(last.date)}).
            </>
          ) : (
            "No dated posts yet."
          )}{" "}
          {days > 30 && <>Nothing went out in the last 30 days, so the window is widened.</>}
          {days === 30 && <>Deltas compare against the 30 days before.</>}
        </p>
      }
      aside={
        <HeroPanel label="Followers">
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="tabular font-display text-4xl font-semibold leading-none tracking-[-0.02em]"
              style={{ marginLeft: numeralShift(fmt(totalFollowers)) }}
            >
              {fmt(totalFollowers)}
            </span>
            {deltas.total !== null && deltas.since && (
              <span className="text-xs text-white/60">
                <SignedCount n={deltas.total} /> since {fmtDate(deltas.since)}
              </span>
            )}
          </div>
          <ul className="mt-5 space-y-2.5">
            {PLATFORMS.map((p) => (
              <HeroRow
                key={p}
                label={
                  <>
                    <PlatformDot platform={p} className="shrink-0 ring-2 ring-white/20" />
                    <span>{platformLabel[p]}</span>
                  </>
                }
              >
                <span className="tabular font-medium">{fmt(scrape.followers?.[p] ?? 0)}</span>
                <span className="tabular w-12 text-right font-mono text-[11px] text-white/55">
                  {deltas.byPlatform[p] === null ? "" : <SignedCount n={deltas.byPlatform[p] ?? 0} />}
                </span>
              </HeroRow>
            ))}
          </ul>
          <Sparkline history={history} />
        </HeroPanel>
      }
    />
  );
}

/** Only drawn once there are three or more snapshots. Two points is a line,
 *  not a trend, and we would rather show nothing than fake a curve. */
function Sparkline({ history }: { history: FollowerSnapshot[] }) {
  const pts = [...history]
    .filter((h) => h && h.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => PLATFORMS.reduce((sum, p) => sum + toNum(h[p]), 0));
  if (pts.length < 3) return null;
  const w = 280;
  const h = 48;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-5 h-12 w-full text-white/70"
      role="img"
      aria-label={`Total followers across ${pts.length} snapshots`}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
