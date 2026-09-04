import { ComboChart } from "@/components/charts/combo-chart";
import { Numbered } from "@/components/charts/numbered";
import { Section } from "@/components/charts/section";
import type { Post } from "@/lib/types";
import { monthlyActivity } from "@/lib/derive";

export function PostActivity({ posts }: { posts: Post[] }) {
  const data = monthlyActivity(posts).map((d) => ({
    month: formatMonth(d.month),
    views: d.views,
    posts: d.posts,
  }));
  return (
    <Numbered n={1}>
      <Section
        title="Monthly Activity"
        hint="Lifetime views earned by the posts published each month (bars) and how many went out (line). Last 18 months."
      >
        <ComboChart data={data} />
      </Section>
    </Numbered>
  );
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}
