// Computed/derived data from raw posts + comments. Pure functions, no side effects.

import type { Post, Comment, Platform, FollowerSnapshot } from "./types";

const DAY = 86_400_000;

export const PLATFORMS: Platform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "threads",
];

export function toNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function totals(posts: Post[]) {
  return posts.reduce(
    (acc, p) => {
      acc.posts += 1;
      acc.views += toNum(p.views);
      acc.likes += toNum(p.likes);
      acc.comments += toNum(p.comments);
      acc.shares += toNum(p.shares);
      acc.saves += toNum(p.saves);
      return acc;
    },
    { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
  );
}

export function avgEngagementRate(posts: Post[]): number {
  if (!posts.length) return 0;
  const sum = posts.reduce((s, p) => s + toNum(p.engagementRate), 0);
  return sum / posts.length;
}

export function byPlatform<T>(
  items: T[],
  pick: (i: T) => Platform,
): Record<Platform, T[]> {
  const out: Record<Platform, T[]> = {
    instagram: [],
    tiktok: [],
    youtube: [],
    threads: [],
  };
  for (const it of items) out[pick(it)].push(it);
  return out;
}

export function topPosts(posts: Post[], days = 30, limit = 10): Post[] {
  const cutoff = Date.now() - days * 86_400_000;
  return [...posts]
    .filter((p) => {
      const t = new Date(p.date).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => toNum(b.views) - toNum(a.views))
    .slice(0, limit);
}

export function monthlyActivity(
  posts: Post[],
  months = 18,
): Array<{ month: string; posts: number; views: number }> {
  const buckets = new Map<string, { posts: number; views: number }>();
  for (const p of posts) {
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { posts: 0, views: 0 };
    b.posts += 1;
    b.views += toNum(p.views);
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-months)
    .map(([month, b]) => ({ month, ...b }));
}

// --- Rolling windows (Overview hero) ---------------------------------------

export interface WindowTotals {
  posts: number;
  views: number;
  likes: number;
  comments: number;
}

/** Totals for posts dated in (end - days, end], where end = now - offsetDays.
 *  offsetDays = days gives the immediately preceding window of equal length. */
export function windowTotals(
  posts: Post[],
  days: number,
  offsetDays = 0,
  now = Date.now(),
): WindowTotals {
  const end = now - offsetDays * DAY;
  const start = end - days * DAY;
  const out: WindowTotals = { posts: 0, views: 0, likes: 0, comments: 0 };
  for (const p of posts) {
    const t = new Date(p.date).getTime();
    if (!Number.isFinite(t) || t <= start || t > end) continue;
    out.posts += 1;
    out.views += toNum(p.views);
    out.likes += toNum(p.likes);
    out.comments += toNum(p.comments);
  }
  return out;
}

export const WINDOW_CANDIDATES = [30, 90, 365] as const;

/** Shortest candidate window that contains at least one post, so the hero
 *  never opens on a row of zeros after a quiet month. Falls back to a year. */
export function pickWindow(posts: Post[], now = Date.now()): number {
  for (const days of WINDOW_CANDIDATES) {
    if (windowTotals(posts, days, 0, now).posts > 0) return days;
  }
  return 365;
}

export function windowLabel(days: number): string {
  if (days === 30) return "Last 30 days";
  if (days === 90) return "Last 90 days";
  if (days === 365) return "Last 12 months";
  return `Last ${days} days`;
}

/** Percent change, or null when there is no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export interface FollowerDeltas {
  /** Date of the snapshot the deltas are measured from, or null if < 2 points. */
  since: string | null;
  byPlatform: Record<Platform, number | null>;
  total: number | null;
}

/** Change per platform between the two most recent follower snapshots. */
export function followerDeltas(history: FollowerSnapshot[]): FollowerDeltas {
  const empty: FollowerDeltas = {
    since: null,
    byPlatform: { instagram: null, tiktok: null, youtube: null, threads: null },
    total: null,
  };
  const sorted = [...history]
    .filter((h) => h && h.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return empty;
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const byPlatform = { ...empty.byPlatform };
  let total = 0;
  for (const p of PLATFORMS) {
    const d = toNum(last[p]) - toNum(prev[p]);
    byPlatform[p] = d;
    total += d;
  }
  return { since: prev.date, byPlatform, total };
}

export function platformLastPosted(posts: Post[]): {
  date: string | null;
  daysAgo: number | null;
} {
  if (!posts.length) return { date: null, daysAgo: null };
  const dates = posts
    .map((p) => new Date(p.date).getTime())
    .filter((t) => Number.isFinite(t));
  if (!dates.length) return { date: null, daysAgo: null };
  const last = Math.max(...dates);
  const daysAgo = Math.floor((Date.now() - last) / 86_400_000);
  return { date: new Date(last).toISOString().slice(0, 10), daysAgo };
}

export function platformCadence(posts: Post[]): {
  perWeek: number;
  perMonth: number;
} {
  if (!posts.length) return { perWeek: 0, perMonth: 0 };
  const dates = posts
    .map((p) => new Date(p.date).getTime())
    .filter((t) => Number.isFinite(t));
  if (dates.length < 2) return { perWeek: 0, perMonth: 0 };
  const range = (Math.max(...dates) - Math.min(...dates)) / 86_400_000;
  if (range <= 0) return { perWeek: 0, perMonth: 0 };
  const perDay = dates.length / range;
  return {
    perWeek: Number((perDay * 7).toFixed(1)),
    perMonth: Number((perDay * 30).toFixed(1)),
  };
}

export function commentResponseRate(comments: Comment[]): {
  total: number;
  responded: number;
  rate: number;
} {
  const total = comments.length;
  const responded = comments.filter((c) => c.replied).length;
  return {
    total,
    responded,
    rate: total ? (responded / total) * 100 : 0,
  };
}

export function sentimentBreakdown(comments: Comment[]) {
  const out = { positive: 0, neutral: 0, negative: 0, question: 0 };
  for (const c of comments) {
    const s = c.sentiment ?? inferSentiment(c.text);
    out[s] += 1;
  }
  return out;
}

export function inferSentiment(
  text: string,
): "positive" | "neutral" | "negative" | "question" {
  const t = text.toLowerCase();
  if (t.includes("?")) return "question";
  if (/(bad|wrong|hate|poor|terrible|awful|sucks|trash)/.test(t))
    return "negative";
  if (/(love|great|awesome|perfect|amazing|fire|thank)/.test(t))
    return "positive";
  return "neutral";
}
