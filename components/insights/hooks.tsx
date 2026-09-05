import { Section } from "@/components/charts/section";
import { BarChart } from "@/components/charts/bar-chart";
import { PlatformBadge } from "@/components/charts/platform-badge";
import { fmt, fmtPct } from "@/lib/format";
import type { HookTypeStat, TopHook } from "@/lib/types";

interface HooksProps {
  hookTypes: HookTypeStat[];
  topHooks: TopHook[];
}

export function HookAnalysis({ hookTypes, topHooks }: HooksProps) {
  const chartData = [...hookTypes]
    .sort((a, b) => b.avgViews - a.avgViews)
    .map((h) => ({ type: h.type, views: Math.round(h.avgViews) }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section
        title="Hook Type Performance"
        hint="Avg views by opening hook style"
      >
        <BarChart
          data={chartData}
          xKey="type"
          yKey="views"
          yFormatter={(v) => fmt(v)}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
          {chartData.slice(0, 6).map((h) => {
            const stat = hookTypes.find((s) => s.type === h.type);
            return (
              <div
                key={h.type}
                className="flex items-center justify-between rounded border border-border px-2 py-1"
              >
                <span className="uppercase tracking-wider text-ink-muted">
                  {h.type}
                </span>
                <span className="tabular text-ink">
                  {stat?.count ?? 0} posts
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Caption Hook Library"
        hint="Top 25 highest-performing opening hooks"
        bodyClassName="max-h-[420px] overflow-y-auto"
      >
        <ol className="space-y-2.5">
          {topHooks.slice(0, 25).map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-3 border-b border-border/60 pb-2.5 last:border-b-0"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted pt-0.5 w-6">
                {String(i + 1).padStart(2, "0")}
              </span>
              <PlatformBadge platform={h.platform} />
              <div className="min-w-0 flex-1">
                <a
                  href={h.url ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm leading-snug text-ink hover:text-brand"
                >
                  {h.hook}
                </a>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-brand">
                  {fmt(h.views)}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                  {fmtPct(h.engagement)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
