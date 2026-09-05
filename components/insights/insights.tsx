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
import { TopQuestions } from "./top-questions";
import { DoesntFollowBack } from "./follow-back";
import { HeroPanel, HeroRow, PageHero } from "@/components/layout/page-hero";
import { fmt, fmtDate, fmtShort } from "@/lib/format";

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
    return <PageHero eyebrow="Loading insights" title="Insights" />;
  }

  const topHook = a.hookTypes
    ? [...a.hookTypes].sort((x, y) => y.avgViews - x.avgViews)[0]
    : null;
  const topHashtag = a.hashtagPerformance
    ? [...a.hashtagPerformance].sort((x, y) => y.avgViews - x.avgViews)[0]
    : null;
  const overlap = a.audienceOverlap;
  const overlapCount = Array.isArray(overlap?.crossPlatformUsers)
    ? overlap.crossPlatformUsers.length
    : 0;

  return (
    <>
      <PageHero
        eyebrow={`Patterns · behaviors · opportunities${
          a.generatedAt ? ` · computed ${fmtDate(a.generatedAt)}` : ""
        }`}
        title="Insights"
        lede="What the numbers say about what to make next, computed from every post and the comment snapshot."
        stats={[
          { label: "Viral posts", value: fmtShort(a.viralPosts?.length ?? 0), hint: "3× the platform average" },
          { label: "Cross-posts", value: fmtShort(a.crossPosts?.length ?? 0), hint: "same idea on 2+ platforms" },
          {
            label: "Cross-platform fans",
            value: fmtShort(overlapCount),
            hint: overlap ? `of ${fmt(overlap.totalUniqueUsers)} unique commenters` : undefined,
          },
          {
            label: "Audience questions",
            value: fmtShort(a.questionCount ?? a.highValueComments?.length ?? 0),
            hint: "in the comment snapshot, top 50 ranked below",
          },
        ]}
        aside={
          <HeroPanel label="Standouts">
            <ul className="mt-4 space-y-2.5">
              <HeroRow label="Best hook">
                <span className="font-medium capitalize">
                  {topHook?.type?.replace(/_/g, " ") ?? "none"}
                </span>
                <span className="tabular w-16 text-right font-mono text-[11px] text-white/55">
                  {topHook ? `${fmt(topHook.avgViews)} avg` : ""}
                </span>
              </HeroRow>
              <HeroRow label="Top hashtag">
                <span className="max-w-[160px] truncate font-medium">{topHashtag?.tag ?? "none"}</span>
                <span className="tabular w-16 text-right font-mono text-[11px] text-white/55">
                  {topHashtag ? `${fmt(topHashtag.avgViews)} avg` : ""}
                </span>
              </HeroRow>
              <HeroRow label="Comments through">
                <span className="tabular font-medium">
                  {a.dataAsOf?.comments ? fmtDate(a.dataAsOf.comments) : "n/a"}
                </span>
              </HeroRow>
            </ul>
          </HeroPanel>
        }
      />
      <div className="mx-auto max-w-[1500px] space-y-8 px-6 py-8">

      {/* Most actionable insights first: viral posts + hook library */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {a.viralPosts && (
          <Numbered n={1}>
            <ViralPosts posts={a.viralPosts} />
          </Numbered>
        )}
        {a.highValueComments && (
          <TopQuestions comments={a.highValueComments} asOf={a.dataAsOf?.comments} />
        )}
      </div>

      {a.hookTypes && a.topHooks && (
        <HookAnalysis hookTypes={a.hookTypes} topHooks={a.topHooks} />
      )}

      {/* Pattern analysis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
    </>
  );
}
