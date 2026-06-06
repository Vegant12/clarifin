"use client";

/**
 * Phase 13 T1 — indicator-subpanel.tsx
 * Presentational chart subpanel for volume, RSI, and MACD.
 * Creates its own lightweight-charts chart instance inside useEffect and exposes
 * it to the parent (CandlestickChart) via the `onChartReady` callback for sync wiring.
 *
 * Security: T-13-18 — createChart only inside useEffect with SSR null-ref guard.
 */

import {
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import { CHART_COLORS, type ChartOHLCV, type IndicatorSet } from "./chart-types";

export type SubpanelKind = "volume" | "rsi" | "macd";

interface IndicatorSubpanelProps {
  kind: SubpanelKind;
  ohlcv: ChartOHLCV[];
  indicators: IndicatorSet;
  /** Height class string, e.g. "h-[80px]" — matches UI-SPEC subpanel heights */
  heightClass: string;
  /** Called once the chart is ready; parent uses this to wire subscribeVisibleTimeRangeChange */
  onChartReady: (chart: IChartApi) => void;
}

export function IndicatorSubpanel({
  kind,
  ohlcv,
  indicators,
  heightClass,
  onChartReady,
}: IndicatorSubpanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // T-13-18: SSR guard — ref.current is null on the server
    if (!containerRef.current) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: "transparent" },
        textColor: "var(--color-muted-foreground)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "var(--color-border)", visible: true },
        horzLines: { color: "var(--color-border)", visible: true },
      },
      crosshair: {
        vertLine: { color: "var(--color-muted-foreground)", style: 3 },
        horzLine: { color: "var(--color-muted-foreground)", style: 3 },
      },
      rightPriceScale: {
        borderColor: "var(--color-border)",
        textColor: "var(--color-muted-foreground)",
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: "var(--color-border)",
        timeVisible: true,
        secondsVisible: false,
        // Hide axis on all subpanels — main chart provides the time labels
        visible: false,
      },
      handleScale: true,
      handleScroll: true,
    });

    if (kind === "volume") {
      buildVolumePanel(chart, ohlcv);
    } else if (kind === "rsi") {
      buildRsiPanel(chart, ohlcv, indicators);
    } else {
      buildMacdPanel(chart, ohlcv, indicators);
    }

    // Notify parent so it can wire the time-sync subscription
    onChartReady(chart);

    // Resize observer keeps canvas size in sync with container
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove(); // T-13-18: always dispose on unmount / re-run
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ohlcv, indicators]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass}`}
      data-subpanel={kind}
    />
  );
}

// ─── Volume subpanel ──────────────────────────────────────────────────────────

function buildVolumePanel(chart: IChartApi, ohlcv: ChartOHLCV[]) {
  const series = chart.addSeries(HistogramSeries, {
    color: CHART_COLORS.volumeUp,
    priceFormat: { type: "volume" },
    priceScaleId: "right",
  }) as ISeriesApi<SeriesType>;

  const data = ohlcv.map((bar, i) => {
    const isUp = i === 0 ? true : bar.close >= ohlcv[i - 1]!.close;
    return {
      time: bar.date as `${number}-${number}-${number}`,
      value: bar.volume,
      color: isUp
        ? `${CHART_COLORS.volumeUp}99` // 60% opacity
        : `${CHART_COLORS.volumeDown}99`,
    };
  });

  series.setData(data);
}

// ─── RSI subpanel ─────────────────────────────────────────────────────────────

function buildRsiPanel(
  chart: IChartApi,
  ohlcv: ChartOHLCV[],
  indicators: IndicatorSet
) {
  // Apply fixed [0,100] scale
  chart.priceScale("right").applyOptions({
    autoScale: false,
    scaleMargins: { top: 0.05, bottom: 0.05 },
  });

  const rsiSeries = chart.addSeries(LineSeries, {
    color: CHART_COLORS.rsiLine,
    lineWidth: 2,
    priceScaleId: "right",
    priceFormat: { type: "price", precision: 1, minMove: 0.1 },
  });

  const rsiData = ohlcv
    .map((bar, i) => {
      const v = indicators.rsi[i];
      if (v === null || v === undefined) return null;
      return { time: bar.date as `${number}-${number}-${number}`, value: v };
    })
    .filter(Boolean) as { time: `${number}-${number}-${number}`; value: number }[];

  rsiSeries.setData(rsiData);

  // RSI reference lines at 30 and 70 (zinc-400 dashed)
  rsiSeries.createPriceLine({
    price: 70,
    color: CHART_COLORS.rsiReference,
    lineWidth: 1,
    lineStyle: 3, // dashed
    axisLabelVisible: true,
    title: "70",
  });
  rsiSeries.createPriceLine({
    price: 30,
    color: CHART_COLORS.rsiReference,
    lineWidth: 1,
    lineStyle: 3,
    axisLabelVisible: true,
    title: "30",
  });
}

// ─── MACD subpanel ────────────────────────────────────────────────────────────

function buildMacdPanel(
  chart: IChartApi,
  ohlcv: ChartOHLCV[],
  indicators: IndicatorSet
) {
  // Histogram: emerald positive / red negative at 60% opacity
  const histogramSeries = chart.addSeries(HistogramSeries, {
    color: `${CHART_COLORS.upColor}99`,
    priceScaleId: "right",
    priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
  });

  const histogramData = ohlcv
    .map((bar, i) => {
      const v = indicators.macdHistogram[i];
      if (v === null || v === undefined) return null;
      return {
        time: bar.date as `${number}-${number}-${number}`,
        value: v,
        color:
          v >= 0
            ? `${CHART_COLORS.upColor}99` // emerald 60%
            : `${CHART_COLORS.downColor}99`, // red 60%
      };
    })
    .filter(Boolean) as { time: `${number}-${number}-${number}`; value: number; color: string }[];

  histogramSeries.setData(histogramData);

  // MACD fast line (MACD value)
  const macdFastSeries = chart.addSeries(LineSeries, {
    color: CHART_COLORS.macdFast,
    lineWidth: 2,
    priceScaleId: "right",
    priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
  });

  const macdData = ohlcv
    .map((bar, i) => {
      const v = indicators.macd[i];
      if (v === null || v === undefined) return null;
      return { time: bar.date as `${number}-${number}-${number}`, value: v };
    })
    .filter(Boolean) as { time: `${number}-${number}-${number}`; value: number }[];

  macdFastSeries.setData(macdData);

  // MACD signal line
  const macdSignalSeries = chart.addSeries(LineSeries, {
    color: CHART_COLORS.macdSignal,
    lineWidth: 2,
    priceScaleId: "right",
    priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
  });

  const macdSignalData = ohlcv
    .map((bar, i) => {
      const v = indicators.macdSignal[i];
      if (v === null || v === undefined) return null;
      return { time: bar.date as `${number}-${number}-${number}`, value: v };
    })
    .filter(Boolean) as { time: `${number}-${number}-${number}`; value: number }[];

  macdSignalSeries.setData(macdSignalData);
}
