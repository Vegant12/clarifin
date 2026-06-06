"use client";

/**
 * Phase 13 Plan 07 — ta-chart-shell.tsx
 * Client shell that owns range and overlay state and composes the Plan 05 chart components.
 *
 * Slices ohlcv/indicators to the last RANGE_TO_DAYS[range] bars and passes them
 * to CandlestickChart which re-renders on each change.
 *
 * Props: the full AnalysisPayload fields (ticker, name_en, last_updated, ohlcv, indicators, snapshot).
 */

import { useState } from "react";

import { CandlestickChart } from "@/components/ta/candlestick-chart";
import { IndicatorSnapshotStrip } from "@/components/ta/indicator-snapshot-strip";
import { OverlayToggles } from "@/components/ta/overlay-toggles";
import { RangeSelector } from "@/components/ta/range-selector";
import {
  RANGE_TO_DAYS,
  type IndicatorSet,
  type OverlayKey,
  type RangeKey,
} from "@/components/ta/chart-types";
import type { ChartOHLCV } from "@/components/ta/chart-types";

interface TaChartShellProps {
  ticker: string;
  name_en: string;
  last_updated: string;
  ohlcv: ChartOHLCV[];
  indicators: IndicatorSet;
  snapshot: Record<string, string>;
}

const DEFAULT_OVERLAYS: Record<OverlayKey, boolean> = {
  BB: false,
  EMA20: false,
  EMA50: true,
  EMA200: true,
};

export function TaChartShell({
  ticker,
  name_en,
  last_updated,
  ohlcv,
  indicators,
  snapshot,
}: TaChartShellProps) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [overlays, setOverlays] =
    useState<Record<OverlayKey, boolean>>(DEFAULT_OVERLAYS);

  // Slice OHLCV and indicators to the last N trading days for the selected range.
  const days = RANGE_TO_DAYS[range];
  const slicedOhlcv = ohlcv.slice(-days);
  // Slice each indicator array in parallel so indices remain aligned with slicedOhlcv.
  const sliceFrom = ohlcv.length - slicedOhlcv.length;
  const slicedIndicators: IndicatorSet = {
    rsi: indicators.rsi.slice(sliceFrom),
    macd: indicators.macd.slice(sliceFrom),
    macdSignal: indicators.macdSignal.slice(sliceFrom),
    macdHistogram: indicators.macdHistogram.slice(sliceFrom),
    bollingerUpper: indicators.bollingerUpper.slice(sliceFrom),
    bollingerMiddle: indicators.bollingerMiddle.slice(sliceFrom),
    bollingerLower: indicators.bollingerLower.slice(sliceFrom),
    ema20: indicators.ema20.slice(sliceFrom),
    ema50: indicators.ema50.slice(sliceFrom),
    ema200: indicators.ema200.slice(sliceFrom),
    sma50: indicators.sma50.slice(sliceFrom),
    atr: indicators.atr.slice(sliceFrom),
    stochastic: indicators.stochastic.slice(sliceFrom),
    obv: indicators.obv.slice(sliceFrom),
  };

  function handleToggle(key: OverlayKey) {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <section
      aria-label={`Technical analysis for ${ticker}`}
      className="flex flex-col gap-4"
    >
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {ticker} &mdash; {name_en}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          IDX &middot; Last updated: {last_updated}
        </p>
      </div>

      {/* Range + overlay controls */}
      <div className="flex flex-wrap items-center gap-3">
        <RangeSelector value={range} onChange={setRange} />
        <OverlayToggles active={overlays} onToggle={handleToggle} />
      </div>

      {/* Main chart (candlestick + subpanels) */}
      <CandlestickChart
        ticker={ticker}
        ohlcv={slicedOhlcv}
        indicators={slicedIndicators}
        overlays={overlays}
        range={range}
      />

      {/* Indicator snapshot strip */}
      <IndicatorSnapshotStrip snapshot={snapshot} className="mt-2" />
    </section>
  );
}
