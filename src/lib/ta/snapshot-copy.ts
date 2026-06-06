/**
 * Phase 13 Plan 04 — TA-IND-05: Indicator snapshot copy generator.
 *
 * buildSnapshotCopy produces plain-English direction-only one-liners for each
 * indicator in the IndicatorSet. These are computed server-side and returned
 * as part of the AnalysisPayload — never computed on the client.
 *
 * Format (locked by UI-SPEC IndicatorSnapshotStrip): "{Label}: {plain-English description}"
 * Rules:
 * - NO bare numeric triplets as the whole description (numbers only inside parens or after prose)
 * - Direction-only: RSI oversold/overbought/neutral; MACD crossover/direction; EMA above/below
 * - Sparse fallback: if last non-null value is absent, returns "Not enough data yet"
 */

import type { IndicatorSet } from "./indicator-schema";
import type { OHLCVBar } from "./ohlcv-schema";

/** Extract the last non-null value from a nullable array, or null if none found. */
function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v: number | null | undefined = arr[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/** Round a number to the nearest integer string for display in parens. */
function fmt(n: number): string {
  return String(Math.round(n));
}

/**
 * Build RSI one-liner.
 * < 30 → "Near oversold territory (NN)"
 * > 70 → "In overbought territory (NN)"
 * else → "Neutral momentum (NN)"
 */
function rsiCopy(rsi: (number | null)[]): string {
  const last = lastNonNull(rsi);
  if (last === null) return "RSI: Not enough data yet";
  if (last < 30) return `RSI: Near oversold territory (${fmt(last)})`;
  if (last > 70) return `RSI: In overbought territory (${fmt(last)})`;
  return `RSI: Neutral momentum (${fmt(last)})`;
}

/**
 * Build MACD one-liner.
 * Detects crossover by comparing last two bars' MACD vs signal relationship.
 * - line was below signal, now above → "Bullish crossover yesterday"
 * - line was above signal, now below → "Bearish crossover yesterday"
 * - no crossover, line above → "Above signal line — bullish momentum"
 * - no crossover, line below → "Below signal line — bearish momentum"
 */
function macdCopy(
  macdLine: (number | null)[],
  macdSignal: (number | null)[],
): string {
  const n = macdLine.length;
  let lastMacd: number | null = null;
  let lastSignal: number | null = null;
  let prevMacd: number | null = null;
  let prevSignal: number | null = null;

  // Scan from end to find last two bars with both line and signal present
  for (let i = n - 1; i >= 0; i--) {
    const ml: number | null | undefined = macdLine[i];
    const ms: number | null | undefined = macdSignal[i];
    const mlVal = ml !== null && ml !== undefined ? ml : null;
    const msVal = ms !== null && ms !== undefined ? ms : null;
    if (mlVal !== null && msVal !== null) {
      if (lastMacd === null) {
        lastMacd = mlVal;
        lastSignal = msVal;
      } else if (prevMacd === null) {
        prevMacd = mlVal;
        prevSignal = msVal;
        break;
      }
    }
  }

  if (lastMacd === null || lastSignal === null) return "MACD: Not enough data yet";

  // Crossover detection: requires two data points
  if (prevMacd !== null && prevSignal !== null) {
    const prevAbove = prevMacd > prevSignal;
    const lastAbove = lastMacd > lastSignal;
    if (!prevAbove && lastAbove) return "MACD: Bullish crossover yesterday";
    if (prevAbove && !lastAbove) return "MACD: Bearish crossover yesterday";
  }

  // No crossover — describe current position
  if (lastMacd > lastSignal) return "MACD: Above signal line — bullish momentum";
  if (lastMacd < lastSignal) return "MACD: Below signal line — bearish momentum";
  return "MACD: At signal line — no clear direction";
}

/**
 * Build Bollinger Bands one-liner.
 * Uses last close vs upper/lower to determine band proximity.
 */
function bollingerCopy(
  upper: (number | null)[],
  middle: (number | null)[],
  lower: (number | null)[],
  lastClose: number,
): string {
  const lastUpper = lastNonNull(upper);
  const lastMiddle = lastNonNull(middle);
  const lastLower = lastNonNull(lower);
  if (lastUpper === null || lastMiddle === null || lastLower === null) {
    return "Bollinger Bands: Not enough data yet";
  }

  const bandWidth = lastUpper - lastLower;
  if (bandWidth === 0) return "Bollinger Bands: Narrow band — low volatility";

  const positionPct = (lastClose - lastLower) / bandWidth;

  if (positionPct >= 0.8) return "Bollinger Bands: Price near upper band — extended";
  if (positionPct <= 0.2) return "Bollinger Bands: Price near lower band — potential support";
  return "Bollinger Bands: Price within normal band range";
}

/**
 * Build EMA one-liner (shared for EMA-20, EMA-50, EMA-200).
 * Price above EMA → uptrend; below → downtrend.
 */
function emaCopy(
  label: string,
  ema: (number | null)[],
  lastClose: number,
  trendSuffix: { above: string; below: string },
): string {
  const lastEma = lastNonNull(ema);
  if (lastEma === null) return `${label}: Not enough data yet`;
  if (lastClose > lastEma) return `${label}: Price trading above — ${trendSuffix.above}`;
  if (lastClose < lastEma) return `${label}: Price below — ${trendSuffix.below}`;
  return `${label}: Price at EMA — no clear signal`;
}

/**
 * Build SMA-50 one-liner.
 */
function sma50Copy(sma50: (number | null)[], lastClose: number): string {
  const lastSma = lastNonNull(sma50);
  if (lastSma === null) return "SMA-50: Not enough data yet";
  if (lastClose > lastSma) return "SMA-50: Price trading above — short-term strength";
  if (lastClose < lastSma) return "SMA-50: Price below — short-term weakness";
  return "SMA-50: Price at moving average — neutral";
}

/**
 * Build ATR one-liner.
 * ATR is an absolute volatility measure — uses ATR as % of price for classification.
 * Format: "ATR: Moderate volatility (Rp NNN / share)"
 */
function atrCopy(atr: (number | null)[], lastClose: number): string {
  const lastAtr = lastNonNull(atr);
  if (lastAtr === null) return "ATR: Not enough data yet";

  // Classify volatility by ATR as % of price
  const atrPct = lastClose > 0 ? lastAtr / lastClose : 0;
  let qualifier: string;
  if (atrPct < 0.01) qualifier = "Low";
  else if (atrPct < 0.025) qualifier = "Moderate";
  else qualifier = "High";

  // Format ATR as IDR amount (rounded to whole number)
  const atrFormatted = Math.round(lastAtr).toLocaleString("id-ID");
  return `ATR: ${qualifier} volatility (Rp ${atrFormatted} / share)`;
}

/**
 * Build Stochastic one-liner.
 * < 20 → oversold zone; > 80 → overbought zone; else → neutral.
 * Uses k (%K fast line) as the primary value.
 */
function stochasticCopy(stochastic: (number | null)[]): string {
  const lastK = lastNonNull(stochastic);
  if (lastK === null) return "Stochastic: Not enough data yet";
  if (lastK < 20) return `Stochastic: In oversold zone (${fmt(lastK)})`;
  if (lastK > 80) return `Stochastic: In overbought zone (${fmt(lastK)})`;
  return `Stochastic: In neutral zone (${fmt(lastK)})`;
}

/**
 * Build OBV one-liner.
 * Compares recent OBV trend (last vs prior) against price trend to check confirmation.
 */
function obvCopy(obv: (number | null)[], bars: OHLCVBar[]): string {
  const lastObv = lastNonNull(obv);
  if (lastObv === null) return "OBV: Not enough data yet";

  // Find second-to-last non-null OBV for direction
  let prevObv: number | null = null;
  let foundLast = false;
  for (let i = obv.length - 1; i >= 0; i--) {
    const v: number | null | undefined = obv[i];
    const vVal = v !== null && v !== undefined ? v : null;
    if (vVal !== null) {
      if (!foundLast) {
        foundLast = true;
      } else {
        prevObv = vVal;
        break;
      }
    }
  }

  if (prevObv === null) return "OBV: Rising — volume accumulation";

  const obvRising = lastObv > prevObv;
  // Use last two closes for price direction
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];

  if (lastBar !== undefined && prevBar !== undefined) {
    const priceRising = lastBar.adjClose > prevBar.adjClose;
    if (obvRising && priceRising) return "OBV: Rising with price — volume confirms trend";
    if (!obvRising && !priceRising) return "OBV: Falling with price — volume confirms downtrend";
    if (obvRising && !priceRising) return "OBV: Rising despite price dip — potential accumulation";
    return "OBV: Falling despite price rise — potential distribution";
  }

  return obvRising
    ? "OBV: Rising — volume accumulation"
    : "OBV: Falling — volume distribution";
}

/** Typed snapshot copy shape — all keys present, all values are non-empty strings. */
export interface SnapshotCopy {
  rsi: string;
  macd: string;
  bollingerBands: string;
  ema20: string;
  ema50: string;
  ema200: string;
  sma50: string;
  atr: string;
  stochastic: string;
  obv: string;
}

/**
 * Phase 13 Plan 04 — TA-IND-05: Build plain-English snapshot copy for each indicator.
 *
 * Returns SnapshotCopy with keys: rsi, macd, bollingerBands, ema20, ema50,
 * ema200, sma50, atr, stochastic, obv.
 *
 * Every value matches "{Label}: {prose}" — never bare numeric triplets.
 * Sparse safety: if last non-null value is absent, returns "Not enough data yet".
 *
 * This is a pure function — no I/O, no side effects. Server-side only (called from route).
 */
export function buildSnapshotCopy(
  indicators: IndicatorSet,
  bars: OHLCVBar[],
): SnapshotCopy {
  const lastClose = bars[bars.length - 1]?.adjClose ?? 0;

  return {
    rsi: rsiCopy(indicators.rsi),
    macd: macdCopy(indicators.macd, indicators.macdSignal),
    bollingerBands: bollingerCopy(
      indicators.bollingerUpper,
      indicators.bollingerMiddle,
      indicators.bollingerLower,
      lastClose,
    ),
    ema20: emaCopy("EMA-20", indicators.ema20, lastClose, {
      above: "short-term uptrend",
      below: "short-term downtrend",
    }),
    ema50: emaCopy("EMA-50", indicators.ema50, lastClose, {
      above: "short-term uptrend",
      below: "short-term downtrend",
    }),
    ema200: emaCopy("EMA-200", indicators.ema200, lastClose, {
      above: "long-term uptrend",
      below: "long-term downtrend",
    }),
    sma50: sma50Copy(indicators.sma50, lastClose),
    atr: atrCopy(indicators.atr, lastClose),
    stochastic: stochasticCopy(indicators.stochastic),
    obv: obvCopy(indicators.obv, bars),
  };
}
