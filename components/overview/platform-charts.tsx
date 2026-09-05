import { BarChart } from "@/components/charts/bar-chart";
import { Numbered } from "@/components/charts/numbered";
import { Section } from "@/components/charts/section";
import { fmt, fmtPct, platformLabel } from "@/lib/format";
import { PLATFORMS, byPlatform, hasViews, totals, avgEngagementRate } from "@/lib/derive";
import type { Post } from "@/lib/types";

const PLATFORM_COLOR: Record<string, string> = {
  Instagram: "var(--ig)",
  TikTok: "var(--tt)",
  YouTube: "var(--yt)",
  Threads: "var(--th)",
};

export function PlatformCharts({ posts }: { posts: Post[] }) {
  const grouped = byPlatform(posts, (p) => p.platform);
  // Threads has no view count, so its 0% and 0 views are absences, not values.
  const measured = PLATFORMS.filter(hasViews);

  const engagementData = measured.map((p) => ({
    platform: platformLabel[p],
    rate: Number(avgEngagementRate(grouped[p]).toFixed(2)),
  }));

  const viewsData = measured.map((p) => ({
    platform: platformLabel[p],
    views: totals(grouped[p]).views,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Numbered n={3}>
        <Section kicker="By platform"
          title="Engagement Rate" hint="Average % per post. Threads has no view count, so it is left out.">
          <BarChart
            data={engagementData}
            xKey="platform"
            yKey="rate"
            colorMap={PLATFORM_COLOR}
            yFormatter={(v) => fmtPct(v, 1)}
          />
        </Section>
      </Numbered>
      <Numbered n={4}>
        <Section kicker="By platform"
          title="Total Views" hint="Lifetime. Threads has no view count, so it is left out.">
          <BarChart
            data={viewsData}
            xKey="platform"
            yKey="views"
            colorMap={PLATFORM_COLOR}
            yFormatter={(v) => fmt(v)}
          />
        </Section>
      </Numbered>
    </div>
  );
}
