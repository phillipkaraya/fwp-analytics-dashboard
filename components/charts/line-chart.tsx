"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";

interface LineChartProps {
  data: Array<Record<string, number | string>>;
  xKey: string;
  yKey: string;
  height?: number;
  yFormatter?: (v: number) => string;
}

/** A line with a soft brand gradient underneath. Same axes and tooltip as
 *  the bar chart so the cards read as one family. */
export function LineChart({ data, xKey, yKey, height = 260, yFormatter }: LineChartProps) {
  const gradId = useId().replace(/:/g, "");
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey={xKey}
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
            cursor={{ stroke: "var(--brand)", strokeWidth: 1, strokeDasharray: "3 3" }}
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
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="var(--brand)"
            strokeWidth={2.25}
            fill={`url(#${gradId})`}
            dot={{ r: 2.5, fill: "var(--brand)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--brand-deep)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
