"use client";

/**
 * Phase 13 T1 — candlestick-chart.tsx
 * Orchestrates the main lightweight-charts candlestick panel + three synced subpanels
 * (volume, RSI, MACD). Renders EMA and Bollinger overlay series with togglable visibility.
 *
 * v5 API note: uses chart.addSeries(CandlestickSeries, opts) — NOT addCandlestickSeries().
 * Series plugins: CandlestickSeries, LineSeries, HistogramSeries from lightweight-charts.
 *
 * Security:
 *   T-13-17: mandatory isSyncing guard prevents infinite re-entrant sync loops (Pitfall 1)
 *   T-13-18: createChart called only inside useEffect with SSR null-ref guard (Pitfall 6)
 *   T-13-19: null indicator values mapped to omitted whitespace points (not NaN)
 *   T-13-20: no server secrets imported; pure presentational component
 */

import {
  CandlestickSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHART_COLORS,
  type ChartOHLCV,
  type IndicatorSet,
  type OverlayKey,
  type RangeKey,
} from "./chart-types";
import { IndicatorSubpanel } from "./indicator-subpanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TooltipData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  x: number;
  y: number;
}

interface CandlestickChartProps {
  ticker: string;
  ohlcv: ChartOHLCV[];
  indicators: IndicatorSet;
  /** Overlay visibility state managed by parent (Plan 07) */
  overlays: Record<OverlayKey, boolean>;
  /** Current range key for aria-label */
  range: RangeKey;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CandlestickChart({
  ticker,
  ohlcv,
  indicators,
  overlays,
  range,
}: CandlestickChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);

  // Series refs lifted so OverlayToggles (parent) can call applyOptions({ visible })
  const ema20Ref = useRef<ISeriesApi<SeriesType> | null>(null);
  const ema50Ref = useRef<ISeriesApi<SeriesType> | null>(null);
  const ema200Ref = useRef<ISeriesApi<SeriesType> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<SeriesType> | null>(null);

  // Subpanel chart refs collected via onChartReady callbacks
  const subpanelCharts = useRef<IChartApi[]>([]);

  // Hover tooltip state
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // ─── onChartReady callbacks for subpanels ────────────────────────────────
  // Using useCallback to stabilise references (though effect dep is ohlcv, not callback)
  const handleSubpanelReady = useCallback((chart: IChartApi) => {
    subpanelCharts.current.push(chart);
  }, []);

  // ─── Main chart lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    // T-13-18: SSR guard — ref.current is null on the server
    if (!mainRef.current) return;

    const container = mainRef.current;

    const mainChart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: "transparent" },
        textColor: "#71717a",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#e4e4e7", visible: true },
        horzLines: { color: "#e4e4e7", visible: true },
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: { color: "#71717a", style: 3 },
        horzLine: { color: "#71717a", style: 3 },
      },
      rightPriceScale: {
        borderColor: "#e4e4e7",
        textColor: "#71717a",
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: "#e4e4e7",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScale: true,
      handleScroll: true,
    });

    // ─── Candlestick series ─────────────────────────────────────────────────
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderUpColor: CHART_COLORS.borderUpColor,
      borderDownColor: CHART_COLORS.borderDownColor,
      wickUpColor: CHART_COLORS.upColor,
      wickDownColor: CHART_COLORS.downColor,
    }) as ISeriesApi<SeriesType>;

    const candleData = ohlcv.map((bar) => ({
      time: bar.date as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
    candleSeries.setData(candleData);

    // ─── EMA overlays ───────────────────────────────────────────────────────
    const ema20Series = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.ema20,
      lineWidth: 1,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false, // EMA-20 OFF by default
    }) as ISeriesApi<SeriesType>;
    ema20Ref.current = ema20Series;

    const ema50Series = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.ema50,
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      visible: true, // EMA-50 ON by default
    }) as ISeriesApi<SeriesType>;
    ema50Ref.current = ema50Series;

    const ema200Series = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.ema200,
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      visible: true, // EMA-200 ON by default
    }) as ISeriesApi<SeriesType>;
    ema200Ref.current = ema200Series;

    // ─── Bollinger Bands overlays ───────────────────────────────────────────
    const bbUpperSeries = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.bollingerBand,
      lineWidth: 1,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false, // BB OFF by default
    }) as ISeriesApi<SeriesType>;
    bbUpperRef.current = bbUpperSeries;

    const bbMiddleSeries = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.bollingerBand,
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false, // BB OFF by default
    }) as ISeriesApi<SeriesType>;
    bbMiddleRef.current = bbMiddleSeries;

    const bbLowerSeries = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.bollingerBand,
      lineWidth: 1,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false, // BB OFF by default
    }) as ISeriesApi<SeriesType>;
    bbLowerRef.current = bbLowerSeries;

    // ─── Set indicator data (null values → whitespace / omitted points) ─────
    setLineData(ema20Series, ohlcv, indicators.ema20);
    setLineData(ema50Series, ohlcv, indicators.ema50);
    setLineData(ema200Series, ohlcv, indicators.ema200);
    setLineData(bbUpperSeries, ohlcv, indicators.bollingerUpper);
    setLineData(bbMiddleSeries, ohlcv, indicators.bollingerMiddle);
    setLineData(bbLowerSeries, ohlcv, indicators.bollingerLower);

    // ─── Subpanel time-sync (T-13-17: mandatory isSyncing guard) ────────────
    // Guard prevents infinite loop: A→B→A→… when scrolling any panel
    let isSyncing = false;

    function syncFrom(source: IChartApi, charts: IChartApi[]) {
      if (isSyncing) return;
      isSyncing = true;
      const r = source.timeScale().getVisibleRange();
      if (r) {
        charts
          .filter((c) => c !== source)
          .forEach((c) => c.timeScale().setVisibleRange(r));
      }
      isSyncing = false;
    }

    mainChart
      .timeScale()
      .subscribeVisibleTimeRangeChange(() =>
        syncFrom(mainChart, subpanelCharts.current)
      );

    // Subpanel → main sync (subscribed in the subpanel ready handler below)
    // Deferred: subpanelCharts.current is populated by the subpanel onChartReady
    // callbacks. We add a post-render subscription via a tiny microtask delay.
    const syncTimer = setTimeout(() => {
      for (const sub of subpanelCharts.current) {
        sub
          .timeScale()
          .subscribeVisibleTimeRangeChange(() =>
            syncFrom(sub, [mainChart, ...subpanelCharts.current])
          );
      }
    }, 0);

    // ─── Hover tooltip ──────────────────────────────────────────────────────
    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setTooltip(null);
        return;
      }

      const candleEntry = param.seriesData.get(candleSeries);
      if (!candleEntry || !("open" in candleEntry)) {
        setTooltip(null);
        return;
      }

      // Find matching bar for volume
      const dateStr = param.time as string;
      const bar = ohlcv.find((b) => b.date === dateStr);

      setTooltip({
        date: dateStr,
        open: candleEntry.open,
        high: candleEntry.high,
        low: candleEntry.low,
        close: candleEntry.close,
        volume: bar?.volume ?? 0,
        x: param.point.x,
        y: param.point.y,
      });
    };

    mainChart.subscribeCrosshairMove(handleCrosshairMove);

    // ─── ResizeObserver ─────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      mainChart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    ro.observe(container);

    return () => {
      clearTimeout(syncTimer);
      ro.disconnect();
      // T-13-18: dispose chart on unmount / re-run
      mainChart.remove();
      // Reset subpanel refs — they will be re-collected on next effect run
      subpanelCharts.current = [];
      setTooltip(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ohlcv, indicators]);

  // ─── Apply overlay visibility when overlays prop changes ─────────────────
  useEffect(() => {
    ema20Ref.current?.applyOptions({ visible: overlays.EMA20 });
    ema50Ref.current?.applyOptions({ visible: overlays.EMA50 });
    ema200Ref.current?.applyOptions({ visible: overlays.EMA200 });
    const bbVisible = overlays.BB;
    bbUpperRef.current?.applyOptions({ visible: bbVisible });
    bbMiddleRef.current?.applyOptions({ visible: bbVisible });
    bbLowerRef.current?.applyOptions({ visible: bbVisible });
  }, [overlays]);

  return (
    <div className="flex flex-col gap-0 relative">
      {/* Main candlestick panel */}
      <div
        ref={mainRef}
        role="img"
        aria-label={`${ticker} interactive price chart, ${range} view`}
        className="h-[300px] w-full"
      />

      {/* Volume subpanel (80px) */}
      <IndicatorSubpanel
        kind="volume"
        ohlcv={ohlcv}
        indicators={indicators}
        heightClass="h-[80px]"
        onChartReady={handleSubpanelReady}
      />

      {/* RSI subpanel (100px) */}
      <IndicatorSubpanel
        kind="rsi"
        ohlcv={ohlcv}
        indicators={indicators}
        heightClass="h-[100px]"
        onChartReady={handleSubpanelReady}
      />

      {/* MACD subpanel (120px) */}
      <IndicatorSubpanel
        kind="macd"
        ohlcv={ohlcv}
        indicators={indicators}
        heightClass="h-[120px]"
        onChartReady={handleSubpanelReady}
      />

      {/* Hover tooltip */}
      {tooltip && (
        <ChartTooltip tooltip={tooltip} />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps null-padded indicator array to sparse time-value data (omitting null points = whitespace). */
function setLineData(
  series: ISeriesApi<SeriesType>,
  ohlcv: ChartOHLCV[],
  values: (number | null)[]
) {
  const data = ohlcv
    .map((bar, i) => {
      const v = values[i];
      if (v === null || v === undefined) return null;
      return { time: bar.date as Time, value: v };
    })
    .filter(Boolean) as { time: Time; value: number }[];
  series.setData(data);
}

// ─── Hover tooltip component ─────────────────────────────────────────────────

function ChartTooltip({ tooltip }: { tooltip: TooltipData }) {
  const isUp = tooltip.close >= tooltip.open;
  const colorClass = isUp ? "text-emerald-600" : "text-red-600";

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm"
      style={{
        left: tooltip.x + 16,
        top: tooltip.y - 60,
        minWidth: 160,
      }}
    >
      <p className="font-semibold text-foreground mb-1">{tooltip.date}</p>
      <p className={colorClass}>
        O: {tooltip.open.toFixed(0)} H: {tooltip.high.toFixed(0)}{" "}
        L: {tooltip.low.toFixed(0)} C: {tooltip.close.toFixed(0)}
      </p>
      <p className="text-muted-foreground text-xs mt-0.5">
        Vol: {(tooltip.volume / 1_000_000).toFixed(1)}M
      </p>
    </div>
  );
}
