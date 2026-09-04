"use client";

import { useEffect, useState } from "react";
import { loadAnalytics, loadFollowData } from "@/lib/data";
import type { AnalyticsBundle, FollowData } from "@/lib/types";
import { PostingHeatmap } from "./heatmap";
import { ContentCategories } from "./categories";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAnalytics(), loadFollowData()])
      .then(([analytics, fd]) => {
        setA(analytics);
        setFollow(fd);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
        {a.viralPosts && <ViralPosts posts={a.viralPosts} />}
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
          <HashtagPerformance data={a.hashtagPerformance} />
        )}
        {a.crossPosts && <CrossPosts data={a.crossPosts} />}
      </div>

      {a.postingHeatmap && <PostingHeatmap data={a.postingHeatmap} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {a.contentCategories && (
          <ContentCategories data={a.contentCategories} />
        )}
        {a.engagementFunnel && (
          <EngagementFunnel data={a.engagementFunnel} />
        )}
        {a.growthVelocity && (
          <div className="lg:col-span-1">
            <GrowthVelocity data={a.growthVelocity} />
          </div>
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
