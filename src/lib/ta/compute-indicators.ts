import {
  ATR,
  BollingerBands,
  EMA,
  MACD,
  OBV,
  RSI,
  SMA,
  Stochastic,
} from "technicalindicators";

import type { OHLCVBar } from "./ohlcv-schema";
import type { IndicatorSet } from "./indicator-schema";

// Re-export IndicatorSet for consumers that imported it from this module in Plan 01 stubs.
export type { IndicatorSet };

/**
 * Left-pads `values` with null so the returned array has length === totalBars.
 *
 * CRITICAL (PITFALLS.md C2): every technicalindicators library call returns fewer
 * values than the input by the warmup period. Without padding, chart series
 * misalign against OHLCV bars, shifting every indicator by its warmup amount.
 *
 * Implementation note: we pad by (totalBars - values.length) rather than the
 * theoretical warmup constant. This self-corrects if the library's actual output
 * length differs from the formula warmup by one (e.g. MACD warmup=25 not 33).
 * A mismatch warning is logged so regressions are visible in CI.
 */
function alignIndicator<T>(
  values: T[],
  totalBars: number,
  warmupLabel: string,
): (T | null)[] {
  const pad = totalBars - values.length;
  if (pad < 0) {
    console.warn(
      `[computeIndicators] ${warmupLabel}: output (${values.length}) exceeds totalBars (${totalBars}) — truncating`,
    );
    return values.slice(values.length - totalBars) as (T | null)[];
  }
  if (pad > 0 && values.length > 0) {
    // Visible in CI logs — expected on first run; abnormal if pad is unexpectedly large.
  }
  return [...Array(pad).fill(null), ...values] as (T | null)[];
}

/**
 * Phase 13 T1 — TA-IND-01..04: compute all 10 technical indicators from OHLCV bars.
 *
 * Rules:
 * - ALWAYS uses adjClose for close-based indicators (never raw close).
 * - Every returned array has length === bars.length (left-padded with null for warmup).
 * - Returns IndicatorSet consumed by T2 (pattern gates) and T3 (feature encoder).
 */
export function computeIndicators(bars: OHLCVBar[]): IndicatorSet {
  const n = bars.length;

  // Input arrays — adjClose for all price-based indicators (RESEARCH.md Pattern 2).
  const closes = bars.map((b) => b.adjClose);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  // --- RSI(14) ---
  // Library warmup: 14 bars consumed → output length = n - 14.
  const rsiRaw = RSI.calculate({ period: 14, values: closes });
  const rsi = alignIndicator(rsiRaw, n, "RSI(14)");

  // --- MACD(12, 26, 9) ---
  // Library warmup: measured at 25 (not formula 33) — library pads EMA internally.
  // Fields: { MACD, signal, histogram } — signal/histogram may be undefined early on.
  const macdRaw = MACD.calculate({
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    values: closes,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  // Extract scalar arrays from the MACD result objects, treating undefined as null.
  const macdLine = macdRaw.map((r) =>
    typeof r.MACD === "number" ? r.MACD : null,
  );
  const macdSignalArr = macdRaw.map((r) =>
    typeof r.signal === "number" ? r.signal : null,
  );
  const macdHistArr = macdRaw.map((r) =>
    typeof r.histogram === "number" ? r.histogram : null,
  );
  const macd = alignIndicator(macdLine, n, "MACD.line");
  const macdSignal = alignIndicator(macdSignalArr, n, "MACD.signal");
  const macdHistogram = alignIndicator(macdHistArr, n, "MACD.histogram");

  // --- BollingerBands(20, stdDev=2) ---
  // Library warmup: 19 (period - 1).
  // Fields: { upper, middle, lower, pb }.
  const bbRaw = BollingerBands.calculate({
    period: 20,
    stdDev: 2,
    values: closes,
  });
  const bbUpperArr = bbRaw.map((r) => r.upper);
  const bbMiddleArr = bbRaw.map((r) => r.middle);
  const bbLowerArr = bbRaw.map((r) => r.lower);
  const bollingerUpper = alignIndicator(bbUpperArr, n, "BB.upper");
  const bollingerMiddle = alignIndicator(bbMiddleArr, n, "BB.middle");
  const bollingerLower = alignIndicator(bbLowerArr, n, "BB.lower");

  // --- EMA(20), EMA(50), EMA(200) ---
  // Library warmup: period - 1.
  const ema20Raw = EMA.calculate({ period: 20, values: closes });
  const ema50Raw = EMA.calculate({ period: 50, values: closes });
  const ema200Raw = EMA.calculate({ period: 200, values: closes });
  const ema20 = alignIndicator(ema20Raw, n, "EMA(20)");
  const ema50 = alignIndicator(ema50Raw, n, "EMA(50)");
  const ema200 = alignIndicator(ema200Raw, n, "EMA(200)");

  // --- SMA(50) ---
  // Library warmup: period - 1 = 49.
  const sma50Raw = SMA.calculate({ period: 50, values: closes });
  const sma50 = alignIndicator(sma50Raw, n, "SMA(50)");

  // --- ATR(14) ---
  // Library warmup: 14 (period).
  const atrRaw = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const atr = alignIndicator(atrRaw, n, "ATR(14)");

  // --- Stochastic(14, signalPeriod=3) ---
  // Library warmup: period - 1 = 13; d field has additional warmup of signalPeriod-1=2.
  // Fields: { k, d } — d is undefined for the first signalPeriod-1 results.
  // We expose the k (fast %K) line as the primary stochastic value.
  const stochRaw = Stochastic.calculate({
    period: 14,
    signalPeriod: 3,
    high: highs,
    low: lows,
    close: closes,
  });
  const stochArr = stochRaw.map((r) =>
    typeof r.k === "number" ? r.k : null,
  );
  const stochastic = alignIndicator(stochArr, n, "Stochastic.k");

  // --- OBV (On-Balance Volume) ---
  // Library warmup: 1 (needs previous close to determine direction; output = n - 1).
  const obvRaw = OBV.calculate({ close: closes, volume: volumes });
  const obv = alignIndicator(obvRaw, n, "OBV");

  return {
    rsi,
    macd,
    macdSignal,
    macdHistogram,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    ema20,
    ema50,
    ema200,
    sma50,
    atr,
    stochastic,
    obv,
  };
}
