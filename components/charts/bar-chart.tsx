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

interface BarChartProps<TKey extends string> {
  data: Array<Record<TKey, string | number>>;
  xKey: TKey;
  yKey: TKey;
  height?: number;
  yFormatter?: (v: number) => string;
  colorMap?: Record<string, string>;
  defaultColor?: string;
}

export function BarChart<TKey extends string>({
  data,
  xKey,
  yKey,
  height = 260,
  yFormatter,
  colorMap,
  defaultColor = "var(--brand)",
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
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
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
