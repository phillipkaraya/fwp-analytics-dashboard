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
  "Threads (likes)": "var(--th)",
};

export function PlatformCharts({ posts }: { posts: Post[] }) {
  const grouped = byPlatform(posts, (p) => p.platform);
  const engagementData = PLATFORMS.map((p) => ({
    platform: platformLabel[p],
    rate: Number(avgEngagementRate(grouped[p]).toFixed(2)),
  }));

  // Threads publishes no view count, so its reach bar is likes and says so.
  const viewsData = PLATFORMS.map((p) => ({
    platform: hasViews(p) ? platformLabel[p] : `${platformLabel[p]} (likes)`,
    views: hasViews(p) ? totals(grouped[p]).views : totals(grouped[p]).likes,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Numbered n={3}>
        <Section kicker="By platform"
          title="Engagement Rate" hint="Average % per post. Threads is measured against followers, since it has no view count.">
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
          title="Reach" hint="Lifetime views. Threads counts likes, since it publishes no view count.">
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
