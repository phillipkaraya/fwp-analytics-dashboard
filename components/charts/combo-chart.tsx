"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt } from "@/lib/format";

export interface ComboPoint {
  month: string;
  views: number;
  posts: number;
}

/** Views as bars on the left axis, post count as a line on the right axis.
 *  Same axis and tooltip styling as bar-chart.tsx so the two sit together. */
export function ComboChart({ data, height = 280 }: { data: ComboPoint[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: 0 }} barCategoryGap={22}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            yAxisId="views"
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
            width={44}
          />
          <YAxis
            yAxisId="posts"
            orientation="right"
            allowDecimals={false}
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
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
            formatter={(v, name) => {
              const n = typeof v === "number" ? v : Number(v) || 0;
              return name === "views" ? [fmt(n), "Views"] : [String(n), "Posts"];
            }}
          />
          <Bar yAxisId="views" dataKey="views" fill="var(--brand)" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="posts"
            type="monotone"
            dataKey="posts"
            stroke="var(--ink)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--ink)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--brand-deep)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
