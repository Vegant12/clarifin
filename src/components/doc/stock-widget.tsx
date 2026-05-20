"use client";

import type { StockData } from "@/lib/stock/stock-schema";
import { cn, formatIDR } from "@/lib/utils";

function formatMetric(
  value: number | null,
  kind: "idr" | "ratio" | "percent",
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (kind === "idr") return formatIDR(value);
  if (kind === "ratio") return `${value.toFixed(1)}×`;
  return `${value.toFixed(1)}%`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `as of ${date}, ${time} WIB`;
  } catch {
    return "as of —";
  }
}

export function StockWidget(props: {
  ticker: string;
  data: StockData;
  className?: string;
}) {
  const { ticker, data, className } = props;
  const { price, pe, pb, dividendYieldPct } = data.quote;

  return (
    <section
      aria-label="Market Data"
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-background p-4",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground text-xs font-semibold uppercase">
          {ticker}
        </span>
        <span className="text-xs text-muted-foreground">IDX</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatTimestamp(data.fetchedAt)}
        </span>
      </header>
      <div
        role="group"
        aria-label="Key market metrics"
        className="grid grid-cols-2 gap-px bg-border rounded-md overflow-hidden border border-border"
      >
        <MetricCell label="Price" value={formatMetric(price, "idr")} />
        <MetricCell label="P/E" value={formatMetric(pe, "ratio")} />
        <MetricCell label="P/B" value={formatMetric(pb, "ratio")} />
        <MetricCell
          label="Div. Yield"
          value={formatMetric(dividendYieldPct, "percent")}
        />
      </div>
    </section>
  );
}

function MetricCell(props: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <span className="text-xl font-semibold text-foreground">{props.value}</span>
    </div>
  );
}
