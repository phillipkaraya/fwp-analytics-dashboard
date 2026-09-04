"use client";

import { fmt, fmtDate, fmtPct, platformLabel, relativeTime } from "@/lib/format";
import {
  PLATFORMS,
  followerDeltas,
  pctChange,
  platformLastPosted,
  windowLabel,
  windowTotals,
} from "@/lib/derive";
import type { FollowerSnapshot, Post, ScrapeState } from "@/lib/types";
import { PlatformDot } from "@/components/charts/platform-badge";
import { cn } from "@/lib/utils";

interface HeroProps {
  posts: Post[];
  scrape: ScrapeState;
  history: FollowerSnapshot[];
  /** Rolling window in days, chosen by pickWindow() in the parent. */
  days: number;
}

/**
 * The one dark band on the site. Everything the scraper knows about the
 * last window, at a size you can read from across the room.
 */
export function Hero({ posts, scrape, history, days }: HeroProps) {
  const cur = windowTotals(posts, days);
  const prev = windowTotals(posts, days, days);
  const deltas = followerDeltas(history);
  const last = platformLastPosted(posts);
  const totalFollowers = PLATFORMS.reduce(
    (sum, p) => sum + (scrape.followers?.[p] ?? 0),
    0,
  );

  const stats = [
    { label: "Views", value: cur.views, pct: pctChange(cur.views, prev.views) },
    { label: "Posts published", value: cur.posts, pct: pctChange(cur.posts, prev.posts) },
    { label: "Likes", value: cur.likes, pct: pctChange(cur.likes, prev.likes) },
    { label: "Comments", value: cur.comments, pct: pctChange(cur.comments, prev.comments) },
  ];

  return (
    <section className="hero relative overflow-hidden text-white">
      <div aria-hidden className="hero-grid absolute inset-0" />
      <div className="relative mx-auto max-w-[1500px] px-6 pb-12 pt-8 lg:pb-16 lg:pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-16">
          {/* Left: the window */}
          <div>
            <p className="rise font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              {windowLabel(days)} · all four platforms
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-4 lg:gap-x-10">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="rise min-w-0"
                  style={{ "--rise-delay": `${80 + i * 70}ms` } as React.CSSProperties}
                >
                  <dd className="tabular font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                    {fmt(s.value)}
                  </dd>
                  <dt className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                    {s.label}
                  </dt>
                  <div className="mt-2">
                    <Delta pct={s.pct} />
                  </div>
                </div>
              ))}
            </dl>
            <p
              className="rise mt-8 text-sm text-white/60"
              style={{ "--rise-delay": "380ms" } as React.CSSProperties}
            >
              {last.date ? (
                <>
                  Last post {fmtDate(last.date)} ({relativeTime(last.date)}).
                </>
              ) : (
                "No dated posts yet."
              )}{" "}
              {days > 30 && (
                <>Nothing went out in the last 30 days, so the window is widened.</>
              )}
              {days === 30 && <>Deltas compare against the 30 days before.</>}
            </p>
          </div>

          {/* Right: followers */}
          <aside
            className="rise rounded-lg bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-sm"
            style={{ "--rise-delay": "200ms" } as React.CSSProperties}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              Followers
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tabular font-display text-4xl font-semibold leading-none tracking-[-0.02em]">
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
                <li
                  key={p}
                  className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-sm first:border-t-0 first:pt-0"
                >
                  <span className="flex items-center gap-2 text-white/80">
                    <PlatformDot platform={p} className="ring-2 ring-white/20" />
                    {platformLabel[p]}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="tabular font-medium">
                      {fmt(scrape.followers?.[p] ?? 0)}
                    </span>
                    <span className="tabular w-12 text-right font-mono text-[11px] text-white/55">
                      {deltas.byPlatform[p] === null ? "" : <SignedCount n={deltas.byPlatform[p] ?? 0} />}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Sparkline history={history} />
          </aside>
        </div>
      </div>
    </section>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
        no prior window
      </span>
    );
  }
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium",
        flat ? "text-white/70" : up ? "on-dark-up" : "on-dark-down",
      )}
    >
      {flat ? "=" : up ? "▲" : "▼"} {fmtPct(Math.abs(pct), Math.abs(pct) >= 100 ? 0 : 1)}
      <span className="font-normal text-white/50">vs prior</span>
    </span>
  );
}

function SignedCount({ n }: { n: number }) {
  if (n === 0) return <span>0</span>;
  return (
    <span className={n > 0 ? "on-dark-up" : "on-dark-down"}>
      {n > 0 ? "+" : "−"}
      {fmt(Math.abs(n))}
    </span>
  );
}

/** Only drawn once there are three or more snapshots. Two points is a line,
 *  not a trend, and we would rather show nothing than fake a curve. */
function Sparkline({ history }: { history: FollowerSnapshot[] }) {
  const pts = [...history]
    .filter((h) => h && h.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => h.instagram + h.tiktok + h.youtube + h.threads);
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
