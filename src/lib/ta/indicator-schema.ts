/**
 * Phase 13 T1 — TA-IND-01..04: Zod schema + TypeScript type for the indicator set
 * returned by computeIndicators. Co-located with compute-indicators.ts, mirroring
 * the stock-schema.ts pattern.
 *
 * Consumed by T2 (pattern gates) and T3 (feature encoder) — shape must not change
 * without updating both consumers.
 */
import { z } from "zod";

// A nullable number array — each element is either a computed value or null (warmup padding).
const nullableNumberArray = z.array(z.number().nullable());

export const indicatorSetSchema = z.object({
  rsi: nullableNumberArray,
  macd: nullableNumberArray,
  macdSignal: nullableNumberArray,
  macdHistogram: nullableNumberArray,
  bollingerUpper: nullableNumberArray,
  bollingerLower: nullableNumberArray,
  bollingerMiddle: nullableNumberArray,
  ema20: nullableNumberArray,
  ema50: nullableNumberArray,
  ema200: nullableNumberArray,
  sma50: nullableNumberArray,
  atr: nullableNumberArray,
  stochastic: nullableNumberArray,
  obv: nullableNumberArray,
});

export type IndicatorSet = z.infer<typeof indicatorSetSchema>;
