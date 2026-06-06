import type { OHLCVBar } from "./ohlcv-schema";

/**
 * Phase 13 T1 — TA-IND-01..04: compute technical indicators from OHLCV bars.
 * STUB — Plan 03 replaces the body with the full implementation using technicalindicators.
 *
 * IndicatorSet shape is defined here so tests can import and assert against it.
 */

export type IndicatorSet = {
  rsi: (number | null)[];
  macd: (number | null)[];
  macdSignal: (number | null)[];
  macdHistogram: (number | null)[];
  bollingerUpper: (number | null)[];
  bollingerLower: (number | null)[];
  bollingerMiddle: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  sma50: (number | null)[];
  atr: (number | null)[];
  stochastic: (number | null)[];
  obv: (number | null)[];
};

export function computeIndicators(_bars: OHLCVBar[]): IndicatorSet {
  throw new Error("not implemented — Plan 03");
}
