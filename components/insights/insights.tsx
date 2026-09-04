"use client";

import { useEffect, useState } from "react";
import { loadAnalytics, loadContentVault, loadFollowData } from "@/lib/data";
import type { AnalyticsBundle, ContentVault, FollowData } from "@/lib/types";
import { Numbered } from "@/components/charts/numbered";
import { PostingHeatmap } from "./heatmap";
import { TopicsCard } from "./topics-card";
import { EngagementFunnel } from "./funnel";
import { ViralPosts } from "./viral-posts";
import { GrowthVelocity } from "./growth";
import { HashtagPerformance } from "./hashtags";
import { CrossPosts } from "./cross-posts";
import { Superfans } from "./superfans";
import { HookAnalysis } from "./hooks";
import { HighValueQuestions } from "./unreplied";
import { DoesntFollowBack } from "./follow-back";
import { InsightsSummary } from "./summary";

export function Insights() {
  const [a, setA] = useState<AnalyticsBundle | null>(null);
  const [follow, setFollow] = useState<FollowData | null>(null);
  const [vault, setVault] = useState<ContentVault | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAnalytics(), loadFollowData(), loadContentVault()])
      .then(([analytics, fd, v]) => {
        setA(analytics);
        setFollow(fd);
        setVault(v);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !a) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          Loading insights
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          Patterns · Behaviors · Opportunities
        </p>
        <h2 className="font-display mt-2 text-3xl font-medium text-ink">
          Insights
        </h2>
      </header>

      <InsightsSummary data={a} />

      {/* Most actionable insights first: viral posts + hook library */}
      <div className="grid gap-4 lg:grid-cols-2">
        {a.viralPosts && (
          <Numbered n={1}>
            <ViralPosts posts={a.viralPosts} />
          </Numbered>
        )}
        {a.highValueComments && (
          <HighValueQuestions
            comments={a.highValueComments}
            asOf={a.dataAsOf?.comments}
          />
        )}
      </div>

      {a.hookTypes && a.topHooks && (
        <HookAnalysis hookTypes={a.hookTypes} topHooks={a.topHooks} />
      )}

      {/* Pattern analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        {a.hashtagPerformance && (
          <Numbered n={2}>
            <HashtagPerformance data={a.hashtagPerformance} />
          </Numbered>
        )}
        {a.crossPosts && (
          <Numbered n={3}>
            <CrossPosts data={a.crossPosts} />
          </Numbered>
        )}
      </div>

      {a.postingHeatmap && <PostingHeatmap data={a.postingHeatmap} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {vault && vault.categories.length > 0 && <TopicsCard vault={vault} />}
        {a.engagementFunnel && (
          <Numbered n={4}>
            <EngagementFunnel data={a.engagementFunnel} />
          </Numbered>
        )}
        {a.growthVelocity && (
          <Numbered n={5}>
            <GrowthVelocity data={a.growthVelocity} />
          </Numbered>
        )}
      </div>

      {a.topCommenters && (
        <Superfans
          commenters={a.topCommenters}
          overlap={a.audienceOverlap}
          asOf={a.dataAsOf?.comments}
        />
      )}

      {follow && <DoesntFollowBack data={follow} />}
    </div>
  );
}
