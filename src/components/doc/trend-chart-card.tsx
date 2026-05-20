"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartDataPoint } from "@/lib/stock/stock-schema";
import { cn, formatIDR, formatIDRShort } from "@/lib/utils";

interface TooltipPayloadEntry {
  dataKey?: string;
  value?: number;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value;
  const netIncome = payload.find((p) => p.dataKey === "netIncome")?.value;
  const margin = payload.find((p) => p.dataKey === "netMarginPct")?.value;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {typeof revenue === "number" ? (
        <p className="text-foreground">Revenue: {formatIDR(revenue)}</p>
      ) : null}
      {typeof netIncome === "number" ? (
        <p className="text-foreground">Net Income: {formatIDR(netIncome)}</p>
      ) : null}
      {typeof margin === "number" ? (
        <p className="text-foreground">Net Margin: {margin.toFixed(1)}%</p>
      ) : null}
    </div>
  );
}

export function TrendChartCard(props: {
  ticker: string;
  data: ChartDataPoint[];
  className?: string;
}) {
  const { ticker, data, className } = props;
  const startYear = data[0]?.year ?? "";
  const endYear = data[data.length - 1]?.year ?? "";

  return (
    <section
      aria-label="Financial Trend"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-background p-4",
        className,
      )}
    >
      <header className="flex items-baseline gap-2">
        <h3 className="text-xl font-semibold text-foreground">Financial Trend</h3>
        <span className="text-xs text-muted-foreground">
          ({ticker} · {startYear}–{endYear})
        </span>
      </header>
      <div className="w-full">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(v) => formatIDRShort(Number(v))}
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
            />
            <YAxis
              yAxisId="margin"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              domain={[0, 100]}
            />
            <Tooltip content={<TrendTooltip />} />
            <Legend verticalAlign="bottom" height={28} />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              name="Revenue"
              fill="var(--color-primary)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="netIncome"
              name="Net Income"
              fill="var(--color-secondary)"
              stroke="var(--color-border)"
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="margin"
              dataKey="netMarginPct"
              name="Net Margin"
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 2"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
