"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAllPosts } from "@/lib/data";
import type { Post, Platform } from "@/lib/types";
import { PLATFORMS, avgEngagementRate, byPlatform, toNum, totals } from "@/lib/derive";
import { HeroPanel, HeroRow, PageHero } from "@/components/layout/page-hero";
import { PlatformDot } from "@/components/charts/platform-badge";
import { fmt, fmtDate, fmtPct, fmtShort, platformLabel } from "@/lib/format";
import { Section } from "@/components/charts/section";
import { PlatformBadge } from "@/components/charts/platform-badge";
import { LineChart } from "@/components/charts/line-chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SortKey = "date" | "views" | "likes" | "comments" | "engagement";

export function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [sort, setSort] = useState<SortKey>("views");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Post | null>(null);

  useEffect(() => {
    loadAllPosts().then((p) => {
      setPosts(p);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let out = posts;
    if (platform !== "all") out = out.filter((p) => p.platform === platform);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (p) =>
          (p.title?.toLowerCase().includes(q) ?? false) ||
          (p.caption?.toLowerCase().includes(q) ?? false) ||
          (p.hashtags?.toLowerCase().includes(q) ?? false),
      );
    }
    return [...out].sort((a, b) => {
      if (sort === "date")
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sort === "engagement")
        return toNum(b.engagementRate) - toNum(a.engagementRate);
      return toNum(b[sort]) - toNum(a[sort]);
    });
  }, [posts, platform, sort, search]);

  const performanceData = useMemo(
    () =>
      filtered
        .slice(0, 50)
        .map((p) => ({ date: fmtDate(p.date), views: toNum(p.views) }))
        .reverse(),
    [filtered],
  );

  // Hero numbers follow the filters, so narrowing to one platform or a search
  // term re-states the headline for exactly that slice.
  const slice = useMemo(() => {
    const t = totals(filtered);
    const grouped = byPlatform(filtered, (p) => p.platform);
    return {
      ...t,
      engagement: avgEngagementRate(filtered),
      perPlatform: PLATFORMS.map((pl) => ({
        platform: pl,
        posts: grouped[pl].length,
        views: totals(grouped[pl]).views,
      })),
    };
  }, [filtered]);

  if (loading) {
    return <PageHero eyebrow="Loading posts" title="Post Analysis" />;
  }

  return (
    <>
      <PageHero
        eyebrow={`${fmt(filtered.length)} of ${fmt(posts.length)} posts${
          platform === "all" ? "" : ` · ${platformLabel[platform]}`
        }${search.trim() ? ` · matching "${search.trim()}"` : ""}`}
        title="Post Analysis"
        lede="Every post the scraper knows about. Filter, sort, and click a row for the full detail."
        stats={[
          {
            label: "Posts",
            value: fmtShort(filtered.length),
            hint: filtered.length === posts.length ? "all platforms" : `of ${fmt(posts.length)}`,
          },
          {
            label: "Views",
            value: fmtShort(slice.views),
            hint: filtered.length ? `${fmt(Math.round(slice.views / filtered.length))} per post` : undefined,
          },
          { label: "Likes", value: fmtShort(slice.likes), hint: `${fmt(slice.comments)} comments` },
          { label: "Avg engagement", value: fmtPct(slice.engagement), hint: "per post" },
        ]}
        aside={
          <HeroPanel label="By platform">
            <ul className="mt-4 space-y-2.5">
              {slice.perPlatform.map((row) => (
                <HeroRow
                  key={row.platform}
                  label={
                    <>
                      <PlatformDot platform={row.platform} className="ring-2 ring-white/20" />
                      {platformLabel[row.platform]}
                    </>
                  }
                >
                  <span className="tabular font-medium">{fmt(row.posts)}</span>
                  <span className="tabular w-16 text-right font-mono text-[11px] text-white/55">
                    {fmt(row.views)} views
                  </span>
                </HeroRow>
              ))}
            </ul>
          </HeroPanel>
        }
      />
      <div className="mx-auto max-w-[1500px] space-y-8 px-6 py-8">

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Field label="Search">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caption, title, or hashtag"
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
        <Field label="Sort by">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="views">Views</SelectItem>
              <SelectItem value="likes">Likes</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="date">Date (newest)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Section
        title="Top 50 Performance"
        hint="Views for the current sorted result set. Posting-time patterns live on the Insights heatmap."
      >
        <LineChart
          data={performanceData}
          xKey="date"
          yKey="views"
          yFormatter={(v) => fmt(v)}
        />
      </Section>

      <Section
        title="All Posts"
        hint="Click any row for full detail"
        bodyClassName="-mx-5 max-h-[640px] overflow-y-auto"
      >
        <table className="data-table tabular w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-y border-border bg-muted/40 text-left">
              <Th>Platform</Th>
              <Th>Date</Th>
              <Th>Title</Th>
              <Th align="right">Views</Th>
              <Th align="right">Likes</Th>
              <Th align="right">Comments</Th>
              <Th align="right">Engage</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((p) => (
              <tr
                key={p.id}
                onClick={() => setOpen(p)}
                className="cursor-pointer border-b border-border even:bg-muted/30 last:border-b-0 hover:bg-muted/40"
              >
                <td className="px-5 py-2">
                  <PlatformBadge platform={p.platform} />
                </td>
                <td className="px-2 py-2 text-ink-muted">
                  {fmtDate(p.date)}
                </td>
                <td className="px-2 py-2 max-w-[440px] truncate text-ink">
                  {p.title || p.caption?.slice(0, 80) || "(no title)"}
                </td>
                <td className="px-2 py-2 text-right text-ink">
                  {fmt(p.views)}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft">
                  {fmt(p.likes)}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft">
                  {fmt(p.comments)}
                </td>
                <td className="px-5 py-2 text-right text-brand">
                  {fmtPct(toNum(p.engagementRate))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div className="border-t border-border px-5 py-2 text-center text-[11px] text-ink-muted">
            Showing 200 of {fmt(filtered.length)} posts. Refine filters above.
          </div>
        )}
      </Section>

      <PostDetailDialog post={open} onClose={() => setOpen(null)} />
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

function PostDetailDialog({
  post,
  onClose,
}: {
  post: Post | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!post} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {post && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <PlatformBadge platform={post.platform} />
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                  {fmtDate(post.date)} · {post.time}
                </span>
              </div>
              <DialogTitle className="font-display text-xl leading-tight pt-2">
                {post.title || "(no title)"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-3 py-3">
              <Stat label="Views" value={fmt(post.views)} emphasis />
              <Stat label="Likes" value={fmt(post.likes)} />
              <Stat label="Comments" value={fmt(post.comments)} />
              <Stat
                label="Engage"
                value={fmtPct(toNum(post.engagementRate))}
              />
            </div>
            {post.caption && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-ink-soft whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {post.caption}
              </div>
            )}
            {post.hashtags && (
              <div className="font-mono text-xs text-brand mt-2">
                {post.hashtags}
              </div>
            )}
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-brand hover:underline"
              >
                Open original →
              </a>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div
        className={`tabular font-display text-xl font-medium leading-none mt-1 ${
          emphasis ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
