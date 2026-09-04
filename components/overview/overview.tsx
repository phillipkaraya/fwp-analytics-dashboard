"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadAllPosts,
  loadContentVault,
  loadFollowerHistory,
  loadScrapeState,
} from "@/lib/data";
import { pickWindow } from "@/lib/derive";
import type { ContentVault, FollowerSnapshot, Post, ScrapeState } from "@/lib/types";
import { PageHero } from "@/components/layout/page-hero";
import { Hero } from "./hero";
import { PlatformStatusRow } from "./platform-status";
import { TopicsRibbon } from "./topics-ribbon";
import { PostActivity } from "./post-activity";
import { PlatformCharts } from "./platform-charts";
import { TopPosts } from "./top-posts";

export function Overview() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [scrape, setScrape] = useState<ScrapeState | null>(null);
  const [history, setHistory] = useState<FollowerSnapshot[]>([]);
  const [vault, setVault] = useState<ContentVault | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadAllPosts(),
      loadScrapeState(),
      loadFollowerHistory(),
      loadContentVault(),
    ])
      .then(([p, s, h, v]) => {
        if (cancelled) return;
        setPosts(p);
        setScrape(s);
        setHistory(h);
        setVault(v);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One window for the hero and the top-posts table so they reconcile.
  const days = useMemo(() => pickWindow(posts), [posts]);

  if (loading || !scrape) {
    return <PageHero eyebrow="Loading data" title="Overview" />;
  }

  return (
    <>
      <Hero posts={posts} scrape={scrape} history={history} days={days} />
      <div className="mx-auto max-w-[1500px] space-y-8 px-6 py-8">
        <PlatformStatusRow posts={posts} scrape={scrape} history={history} />
        {vault && vault.categories.length > 0 && <TopicsRibbon vault={vault} />}
        <PostActivity posts={posts} />
        <PlatformCharts posts={posts} />
        <TopPosts posts={posts} days={days} />
      </div>
    </>
  );
}
