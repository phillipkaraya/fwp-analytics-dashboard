import { BarChart } from "@/components/charts/bar-chart";
import { Numbered } from "@/components/charts/numbered";
import { Section } from "@/components/charts/section";
import { fmt, fmtPct, platformLabel, platformShort } from "@/lib/format";
import { PLATFORMS, byPlatform, hasViews, totals, avgEngagementRate } from "@/lib/derive";
import type { Post } from "@/lib/types";

const PLATFORM_COLOR: Record<string, string> = {
  Instagram: "var(--ig)",
  TikTok: "var(--tt)",
  YouTube: "var(--yt)",
  Threads: "var(--th)",
  "Threads (likes)": "var(--th)",
  LinkedIn: "var(--li)",
  "LinkedIn (likes)": "var(--li)",
};

// Phone-width fallback for the x axis: "LinkedIn (likes)" becomes "LI".
const PLATFORM_SHORT: Record<string, string> = Object.fromEntries(
  PLATFORMS.flatMap((p) => [
    [platformLabel[p], platformShort[p]],
    [`${platformLabel[p]} (likes)`, platformShort[p]],
  ]),
);

export function PlatformCharts({ posts }: { posts: Post[] }) {
  const grouped = byPlatform(posts, (p) => p.platform);
  const engagementData = PLATFORMS.map((p) => ({
    platform: platformLabel[p],
    rate: Number(avgEngagementRate(grouped[p]).toFixed(2)),
  }));

  // Viewless platforms (Threads, LinkedIn) get a likes bar that says so.
  const viewsData = PLATFORMS.map((p) => ({
    platform: hasViews(p) ? platformLabel[p] : `${platformLabel[p]} (likes)`,
    views: hasViews(p) ? totals(grouped[p]).views : totals(grouped[p]).likes,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Numbered n={3}>
        <Section kicker="By platform"
          title="Engagement Rate" hint="Average % per post. Threads and LinkedIn are measured against followers, since they publish no view count.">
          <BarChart
            data={engagementData}
            xKey="platform"
            yKey="rate"
            colorMap={PLATFORM_COLOR}
            shortLabels={PLATFORM_SHORT}
            yFormatter={(v) => fmtPct(v, 1)}
          />
        </Section>
      </Numbered>
      <Numbered n={4}>
        <Section kicker="By platform"
          title="Reach" hint="Lifetime views. Threads and LinkedIn count likes, since they publish no view count.">
          <BarChart
            data={viewsData}
            xKey="platform"
            yKey="views"
            colorMap={PLATFORM_COLOR}
            shortLabels={PLATFORM_SHORT}
            yFormatter={(v) => fmt(v)}
          />
        </Section>
      </Numbered>
    </div>
  );
}
