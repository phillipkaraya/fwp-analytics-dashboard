"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { XAxisTickContentProps } from "recharts";

interface BarChartProps<TKey extends string> {
  data: Array<Record<TKey, string | number>>;
  xKey: TKey;
  yKey: TKey;
  height?: number;
  yFormatter?: (v: number) => string;
  colorMap?: Record<string, string>;
  defaultColor?: string;
  /** Short form of an x label, used when a category slot is too narrow
   *  for the full one (five platforms on a phone). */
  shortLabels?: Record<string, string>;
}

/** Widest full label we draw at 11px ("LinkedIn (likes)") plus breathing room. */
const FULL_LABEL_SLOT = 88;

/** Recharts drops overlapping ticks, so five platforms on a 375px screen
 *  showed three names. Draw every tick instead and shorten the label when
 *  the slot cannot hold the full one. */
function makeCompactTick(shortLabels?: Record<string, string>) {
  return function CompactTick({ x = 0, y = 0, payload, width, visibleTicksCount }: XAxisTickContentProps) {
    const full = String(payload?.value ?? "");
    const axisWidth = Number(width) || 0;
    const slot = axisWidth && visibleTicksCount ? axisWidth / visibleTicksCount : Infinity;
    const label = slot < FULL_LABEL_SLOT && shortLabels?.[full] ? shortLabels[full] : full;
    return (
      <text x={Number(x)} y={Number(y)} dy={12} textAnchor="middle" fill="var(--ink-muted)" fontSize={11}>
        {label}
      </text>
    );
  };
}

export function BarChart<TKey extends string>({
  data,
  xKey,
  yKey,
  height = 260,
  yFormatter,
  colorMap,
  defaultColor = "var(--brand)",
  shortLabels,
}: BarChartProps<TKey>) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          barCategoryGap={28}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey={xKey as string}
            // Charts with short forms draw every category; the others keep
            // Recharts' default thinning (the volume chart has 18 months).
            interval={shortLabels ? 0 : "preserveEnd"}
            tick={shortLabels ? makeCompactTick(shortLabels) : { fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormatter}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "var(--brand-soft)", opacity: 0.5 }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--ink)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--ink-muted)" }}
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return yFormatter ? yFormatter(n) : String(n);
            }}
          />
          <Bar dataKey={yKey as string} radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  colorMap?.[String(d[xKey])] ?? defaultColor
                }
              />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
