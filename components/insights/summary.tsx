import { KpiCard } from "@/components/charts/kpi-card";
import { fmt } from "@/lib/format";
import type { AnalyticsBundle } from "@/lib/types";

interface SummaryProps {
  data: AnalyticsBundle;
}

export function InsightsSummary({ data }: SummaryProps) {
  const viralCount = data.viralPosts?.length ?? 0;
  const topHook = data.hookTypes
    ? [...data.hookTypes].sort((a, b) => b.avgViews - a.avgViews)[0]
    : null;
  const topHashtag = data.hashtagPerformance
    ? [...data.hashtagPerformance].sort((a, b) => b.avgViews - a.avgViews)[0]
    : null;
  const crossPostCount = data.crossPosts?.length ?? 0;
  const overlap = data.audienceOverlap;
  const overlapCount = Array.isArray(overlap?.crossPlatformUsers)
    ? overlap.crossPlatformUsers.length
    : 0;
  const unreplied = data.highValueComments?.length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Viral Posts"
        value={fmt(viralCount)}
        hint="3× platform avg"
        emphasis="brand"
      />
      <KpiCard
        label="Best Hook"
        value={topHook?.type?.replace(/_/g, " ") ?? "—"}
        hint={topHook ? `${fmt(topHook.avgViews)} avg views` : ""}
      />
      <KpiCard
        label="Top Hashtag"
        value={topHashtag?.tag ?? "—"}
        hint={topHashtag ? `${fmt(topHashtag.avgViews)} avg views` : ""}
      />
      <KpiCard
        label="Cross-Posts"
        value={fmt(crossPostCount)}
        hint="multi-platform"
      />
      <KpiCard
        label="Cross-Platform Fans"
        value={fmt(overlapCount)}
        hint={overlap ? `of ${fmt(overlap.totalUniqueUsers)} unique` : ""}
      />
      <KpiCard
        label="Unreplied Q's"
        value={fmt(unreplied)}
        hint="high engagement"
      />
    </div>
  );
}
