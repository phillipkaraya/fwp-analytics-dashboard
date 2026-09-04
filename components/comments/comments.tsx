"use client";

import { useEffect, useMemo, useState } from "react";
import { loadComments } from "@/lib/data";
import type { Comment, Platform } from "@/lib/types";
import {
  PLATFORMS,
  byPlatform,
  commentResponseRate,
  sentimentBreakdown,
  inferSentiment,
} from "@/lib/derive";

const PLATFORM_COLOR: Record<string, string> = {
  Instagram: "var(--ig)",
  TikTok: "var(--tt)",
  YouTube: "var(--yt)",
  Threads: "var(--th)",
};
import { fmt, fmtDate, fmtPct, platformLabel } from "@/lib/format";
import { StaleNote } from "@/components/layout/stale-note";
import { Section } from "@/components/charts/section";
import { PlatformBadge } from "@/components/charts/platform-badge";
import { KpiCard } from "@/components/charts/kpi-card";
import { DoughnutChart } from "@/components/charts/doughnut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SentimentFilter = "all" | "positive" | "neutral" | "negative" | "question";
type SortKey = "newest" | "likes";

export function Comments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadComments().then((c) => {
      setComments(c);
      setLoading(false);
    });
  }, []);

  const enriched = useMemo(
    () =>
      comments.map((c) => ({
        ...c,
        sentiment: c.sentiment ?? inferSentiment(c.text),
      })),
    [comments],
  );

  const filtered = useMemo(() => {
    let out = enriched;
    if (platform !== "all") out = out.filter((c) => c.platform === platform);
    if (sentiment !== "all")
      out = out.filter((c) => c.sentiment === sentiment);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.text.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q),
      );
    }
    return [...out].sort((a, b) => {
      if (sort === "likes") return b.likes - a.likes;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [enriched, platform, sentiment, sort, search]);

  const stats = useMemo(() => {
    const r = commentResponseRate(comments);
    const s = sentimentBreakdown(enriched);
    return { ...r, sentiment: s };
  }, [comments, enriched]);

  const sentimentData = [
    { name: "Positive", value: stats.sentiment.positive, color: "var(--positive)" },
    { name: "Neutral", value: stats.sentiment.neutral, color: "var(--ink-muted)" },
    { name: "Negative", value: stats.sentiment.negative, color: "var(--negative)" },
    { name: "Question", value: stats.sentiment.question, color: "var(--brand)" },
  ];

  // Comments are a frozen snapshot until a scraper exists; label the newest date.
  const asOf = useMemo(
    () => comments.reduce<string>((m, c) => (c.date > m ? c.date : m), ""),
    [comments],
  );

  const perPlatform = useMemo(() => {
    const grouped = byPlatform(comments, (c) => c.platform);
    return PLATFORMS.map((p) => ({
      platform: platformLabel[p],
      rate: Number(commentResponseRate(grouped[p]).rate.toFixed(2)),
    }));
  }, [comments]);

  const volume = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of enriched) {
      const month = c.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-18)
      .map(([month, count]) => ({ month, count }));
  }, [enriched]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          Loading comments
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            {fmt(filtered.length)} of {fmt(comments.length)} comments
          </p>
          <h2 className="font-display mt-2 text-3xl font-medium text-ink">
            Comments
          </h2>
        </div>
        <StaleNote
          date={asOf}
          label="Comments"
          detail="No comment scraper yet, so this tab is a snapshot."
        />
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Response Rate"
          value={fmtPct(stats.rate)}
          hint={`${fmt(stats.responded)} replies of ${fmt(stats.total)}`}
          emphasis="brand"
        />
        <KpiCard label="Total Comments" value={fmt(stats.total)} hint="across all posts" />
        <KpiCard
          label="Replies Sent"
          value={fmt(stats.responded)}
          hint={stats.responded === 0 ? "untapped engagement" : "from Phil"}
        />
        <KpiCard
          label="Questions"
          value={fmt(stats.sentiment.question)}
          hint="awaiting reply"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Response Rate by Platform" hint="Share of comments Phil replied to">
          <BarChart
            data={perPlatform}
            xKey="platform"
            yKey="rate"
            colorMap={PLATFORM_COLOR}
            yFormatter={(v) => fmtPct(v, 1)}
          />
        </Section>
        <Section title="Comment Sentiment" hint="Auto-classified by keyword">
          <DoughnutChart
            data={sentimentData}
            centerLabel="Comments"
            centerValue={fmt(stats.total)}
          />
        </Section>
        <Section title="Comment Volume" hint="Last 18 months">
          <BarChart
            data={volume}
            xKey="month"
            yKey="count"
            yFormatter={(v) => fmt(v)}
          />
        </Section>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Field label="Search">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Username or text"
            className="w-[260px]"
          />
        </Field>
        <Field label="Platform">
          <Select
            value={platform}
            onValueChange={(v) => setPlatform(v as Platform | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {platformLabel[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Sentiment">
          <Select
            value={sentiment}
            onValueChange={(v) => setSentiment(v as SentimentFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sentiment</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="question">Question</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Sort">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="likes">Most likes</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Section
        title="Comments"
        bodyClassName="-mx-5 max-h-[640px] overflow-y-auto"
      >
        <table className="data-table tabular w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-y border-border bg-muted/40 text-left">
              <Th>Platform</Th>
              <Th>User</Th>
              <Th>Sentiment</Th>
              <Th>Comment</Th>
              <Th align="right">Likes</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((c) => (
              <tr
                key={c.id}
                className="border-b border-border even:bg-muted/30 last:border-b-0 hover:bg-muted/40"
              >
                <td className="px-5 py-2">
                  <PlatformBadge platform={c.platform} />
                </td>
                <td className="px-2 py-2 text-ink">{c.username}</td>
                <td className="px-2 py-2">
                  <SentimentBadge sentiment={c.sentiment} />
                </td>
                <td className="px-2 py-2 max-w-[440px] truncate text-ink-soft">
                  {c.text}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft">
                  {c.likes}
                </td>
                <td className="px-5 py-2 text-ink-muted">
                  {fmtDate(c.date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && (
          <div className="border-t border-border px-5 py-2 text-center text-[11px] text-ink-muted">
            Showing 300 of {fmt(filtered.length)} comments.
          </div>
        )}
      </Section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted first:pl-5 last:pr-5"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function SentimentBadge({
  sentiment,
}: {
  sentiment: "positive" | "neutral" | "negative" | "question";
}) {
  const map = {
    positive: "bg-positive-soft text-positive",
    neutral: "bg-muted text-ink-muted",
    negative: "bg-negative-soft text-negative",
    question: "bg-brand-soft text-brand-deep",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${map[sentiment]}`}
    >
      {sentiment}
    </span>
  );
}
