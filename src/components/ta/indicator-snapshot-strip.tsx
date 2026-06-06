"use client";

/**
 * Phase 13 T1 — indicator-snapshot-strip.tsx
 * Horizontal scrollable strip of indicator summary cards.
 * Each card shows a plain-English one-liner for the indicator (TA-IND-05)
 * wrapped in an IndicatorTooltip with a full definition on hover (TA-IND-06).
 *
 * Props: snapshot — Record<string, string> of indicator key → one-liner string.
 * Example: { rsi: "RSI: Near oversold territory (39)", macd: "MACD: Bullish crossover yesterday" }
 */

import { Card } from "@/components/ui/card";
import { IndicatorTooltip } from "./indicator-tooltip";

/** Display labels for each indicator key shown in the strip */
const INDICATOR_LABELS: Record<string, string> = {
  rsi: "RSI",
  macd: "MACD",
  bollingerBands: "Bollinger Bands",
  bb: "Bollinger Bands",
  ema20: "EMA 20",
  ema50: "EMA 50",
  ema200: "EMA 200",
  sma50: "SMA 50",
  atr: "ATR",
  stochastic: "Stochastic",
  obv: "OBV",
};

interface IndicatorSnapshotStripProps {
  snapshot: Record<string, string>;
  className?: string;
}

export function IndicatorSnapshotStrip({
  snapshot,
  className,
}: IndicatorSnapshotStripProps) {
  const keys = Object.keys(snapshot);

  if (keys.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Indicator summary"
      className={`flex flex-wrap gap-2 overflow-x-auto ${className ?? ""}`}
    >
      {keys.map((key) => {
        const label = INDICATOR_LABELS[key.toLowerCase()] ?? key.toUpperCase();
        const oneLiner = snapshot[key]!;

        return (
          <IndicatorTooltip key={key} indicatorKey={key} indicatorName={label}>
            <Card className="min-w-[120px] max-w-[200px] flex-shrink-0 cursor-default gap-1 px-3 py-2 rounded-lg shadow-none">
              <p className="text-xs font-semibold text-muted-foreground leading-none">
                {label}
              </p>
              <p className="text-sm text-foreground leading-snug">{oneLiner}</p>
            </Card>
          </IndicatorTooltip>
        );
      })}
    </div>
  );
}
