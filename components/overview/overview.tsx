"use client";

import { useEffect, useState } from "react";
import { loadAllPosts, loadComments, loadScrapeState } from "@/lib/data";
import type { Comment, Post, ScrapeState } from "@/lib/types";
import { FollowerKpis } from "./follower-kpis";
import { PostActivity } from "./post-activity";
import { PlatformCharts } from "./platform-charts";
import { PlatformStatusRow } from "./platform-status";
import { ResponseRate } from "./response-rate";
import { TopPosts } from "./top-posts";

export function Overview() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [scrape, setScrape] = useState<ScrapeState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAllPosts(), loadComments(), loadScrapeState()])
      .then(([p, c, s]) => {
        if (cancelled) return;
        setPosts(p);
        setComments(c);
        setScrape(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !scrape) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          Loading data
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          Cross-Platform Snapshot
        </p>
        <h2 className="font-display mt-2 text-3xl font-medium text-ink">
          Overview
        </h2>
      </header>

      <FollowerKpis posts={posts} comments={comments} scrape={scrape} />
      <PlatformStatusRow posts={posts} scrape={scrape} />
      <PostActivity posts={posts} />
      <PlatformCharts posts={posts} />
      <ResponseRate comments={comments} />
      <TopPosts posts={posts} />
    </div>
  );
}
