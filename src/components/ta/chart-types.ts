/**
 * Phase 13 T1 — chart-types.ts
 * Pure types and constants shared across all TA chart components.
 * NOT "use client" — safe to import from both server and client modules.
 */

import type { IndicatorSet } from "@/lib/ta/indicator-schema";

// ─── OHLCV bar shape (serialisable — passed from RSC as plain props) ──────────

export interface ChartOHLCV {
  date: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

// ─── Range selector ───────────────────────────────────────────────────────────

export type RangeKey = "1M" | "3M" | "6M" | "1Y" | "2Y";

/** Trading days per range, used for client-side OHLCV slicing */
export const RANGE_TO_DAYS: Record<RangeKey, number> = {
  "1M": 21,
  "3M": 63,
  "6M": 126,
  "1Y": 252,
  "2Y": 504,
};

// ─── Overlay keys ─────────────────────────────────────────────────────────────

export type OverlayKey = "BB" | "EMA20" | "EMA50" | "EMA200";

// ─── Chart color palette (from UI-SPEC) ──────────────────────────────────────

export const CHART_COLORS = {
  /** Candlestick up body — emerald-600 */
  upColor: "#059669",
  /** Candlestick down body — red-600 */
  downColor: "#dc2626",
  /** Candlestick up border — emerald-700 */
  borderUpColor: "#047857",
  /** Candlestick down border — red-700 */
  borderDownColor: "#b91c1c",
  /** RSI line — blue-500 */
  rsiLine: "#3b82f6",
  /** MACD fast (MACD) line — indigo-500 */
  macdFast: "#6366f1",
  /** MACD signal line — orange-500 */
  macdSignal: "#f97316",
  /** EMA-20 line — blue-400 */
  ema20: "#60a5fa",
  /** EMA-50 line — amber-400 */
  ema50: "#fbbf24",
  /** EMA-200 line — violet-500 */
  ema200: "#8b5cf6",
  /** Bollinger Bands — zinc-500 at 40% opacity */
  bollingerBand: "#71717a66",
  /** Volume up bar — emerald-600 */
  volumeUp: "#059669",
  /** Volume down bar — red-600 */
  volumeDown: "#dc2626",
  /** RSI reference lines (30/70) — zinc-400 */
  rsiReference: "#a1a1aa",
} as const;

// ─── Re-export IndicatorSet type for convenience ──────────────────────────────

export type { IndicatorSet };
