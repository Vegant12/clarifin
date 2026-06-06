/**
 * Phase 13 Plan 04 — TA-IND-05: Indicator snapshot copy generator tests.
 *
 * Tests:
 * 1. No value is a bare numeric triplet (e.g., "1.23 / 0.98 / 0.25")
 * 2. RSI < 30 → "Near oversold territory (NN)"
 * 3. RSI > 70 → "In overbought territory (NN)"
 * 4. RSI neutral → "Neutral momentum (NN)"
 * 5. MACD bullish crossover (line crossed above signal on last bar)
 * 6. MACD bearish crossover (line crossed below signal on last bar)
 * 7. EMA-50: price above → "short-term uptrend"
 * 8. EMA-200: price below → "long-term downtrend"
 * 9. Sparse handling: null values → "Not enough data yet"
 * 10. All values match "Label: words" shape
 */
import { describe, it, expect } from "vitest";

import { buildSnapshotCopy } from "@/lib/ta/snapshot-copy";
import type { IndicatorSet } from "@/lib/ta/indicator-schema";
import type { OHLCVBar } from "@/lib/ta/ohlcv-schema";

// Helper to create a minimal IndicatorSet with nulls for most fields
function makeIndicators(overrides: Partial<IndicatorSet> = {}): IndicatorSet {
  return {
    rsi: [null, null, null, null, null],
    macd: [null, null, null, null, null],
    macdSignal: [null, null, null, null, null],
    macdHistogram: [null, null, null, null, null],
    bollingerUpper: [null, null, null, null, null],
    bollingerMiddle: [null, null, null, null, null],
    bollingerLower: [null, null, null, null, null],
    ema20: [null, null, null, null, null],
    ema50: [null, null, null, null, null],
    ema200: [null, null, null, null, null],
    sma50: [null, null, null, null, null],
    atr: [null, null, null, null, null],
    stochastic: [null, null, null, null, null],
    obv: [null, null, null, null, null],
    ...overrides,
  };
}

// Helper to create minimal OHLCVBar
function makeBar(close: number, volume = 1_000_000, date = "2024-01-01"): OHLCVBar {
  return {
    date,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    adjClose: close,
    volume,
  };
}

function makeBars(closes: number[]): OHLCVBar[] {
  return closes.map((c, i) =>
    makeBar(c, 1_000_000, `2024-01-${String(i + 1).padStart(2, "0")}`),
  );
}

describe("buildSnapshotCopy", () => {
  describe("return shape", () => {
    it("returns an object with the expected keys", () => {
      const indicators = makeIndicators({
        rsi: [null, null, 25],
        ema50: [null, null, 1000],
        ema200: [null, null, 900],
      });
      const bars = makeBars([980, 990, 1050]);
      const result = buildSnapshotCopy(indicators, bars);

      expect(result).toBeTypeOf("object");
      const expectedKeys = [
        "rsi",
        "macd",
        "bollingerBands",
        "ema20",
        "ema50",
        "ema200",
        "sma50",
        "atr",
        "stochastic",
        "obv",
      ];
      for (const key of expectedKeys) {
        expect(result).toHaveProperty(key);
      }
    });

    it("all values match 'Label: words' shape (leading letter, colon, then prose)", () => {
      const indicators = makeIndicators({
        rsi: [null, null, 55],
        macd: [null, null, 1.0],
        macdSignal: [null, null, 0.8],
        macdHistogram: [null, null, 0.2],
        bollingerUpper: [null, null, 1100],
        bollingerMiddle: [null, null, 1000],
        bollingerLower: [null, null, 900],
        ema20: [null, null, 990],
        ema50: [null, null, 980],
        ema200: [null, null, 970],
        sma50: [null, null, 985],
        atr: [null, null, 25.5],
        stochastic: [null, null, 55],
        obv: [null, null, 5_000_000],
      });
      const bars = makeBars([985, 995, 1000]);
      const result = buildSnapshotCopy(indicators, bars);

      for (const [key, value] of Object.entries(result)) {
        // Must start with a letter, followed by colon + space + prose
        expect(value, `key '${key}' value '${value}' must match 'Label: words' shape`).toMatch(
          /^[A-Za-z].+:\s.+/,
        );
      }
    });

    it("no value is a bare numeric triplet (e.g. '1.23 / 0.98 / 0.25')", () => {
      const indicators = makeIndicators({
        rsi: [null, null, 55],
        macd: [null, null, 1.23],
        macdSignal: [null, null, 0.98],
        macdHistogram: [null, null, 0.25],
        bollingerUpper: [null, null, 1100],
        bollingerMiddle: [null, null, 1000],
        bollingerLower: [null, null, 900],
        ema20: [null, null, 990],
        ema50: [null, null, 980],
        ema200: [null, null, 970],
        sma50: [null, null, 985],
        atr: [null, null, 25.5],
        stochastic: [null, null, 55],
        obv: [null, null, 5_000_000],
      });
      const bars = makeBars([985, 995, 1000]);
      const result = buildSnapshotCopy(indicators, bars);

      // Pattern: bare number triplet like "1.23 / 0.98 / 0.25" or "1.23/0.98/0.25"
      const bareNumericTriplet = /^\d+(\.\d+)?\s*[/,]\s*\d+(\.\d+)?\s*[/,]\s*\d+(\.\d+)?$/;
      for (const [key, value] of Object.entries(result)) {
        // Strip the "Label: " prefix and check what's left
        const prose = value.replace(/^[^:]+:\s*/, "");
        expect(
          bareNumericTriplet.test(prose),
          `key '${key}' has bare numeric triplet: '${prose}'`,
        ).toBe(false);
      }
    });
  });

  describe("RSI copy rules", () => {
    it("RSI < 30 → contains 'Near oversold territory'", () => {
      const indicators = makeIndicators({ rsi: [null, null, 25] });
      const bars = makeBars([980, 990, 1000]);
      const { rsi } = buildSnapshotCopy(indicators, bars);

      expect(rsi).toContain("Near oversold territory");
      expect(rsi).toMatch(/\(25\)/);
    });

    it("RSI > 70 → contains 'In overbought territory'", () => {
      const indicators = makeIndicators({ rsi: [null, null, 78] });
      const bars = makeBars([980, 990, 1000]);
      const { rsi } = buildSnapshotCopy(indicators, bars);

      expect(rsi).toContain("In overbought territory");
      expect(rsi).toMatch(/\(78\)/);
    });

    it("RSI neutral (30-70) → contains 'Neutral momentum'", () => {
      const indicators = makeIndicators({ rsi: [null, null, 55] });
      const bars = makeBars([980, 990, 1000]);
      const { rsi } = buildSnapshotCopy(indicators, bars);

      expect(rsi).toContain("Neutral momentum");
      expect(rsi).toMatch(/\(55\)/);
    });

    it("RSI all null → 'Not enough data yet'", () => {
      const indicators = makeIndicators({ rsi: [null, null, null] });
      const bars = makeBars([980, 990, 1000]);
      const { rsi } = buildSnapshotCopy(indicators, bars);

      expect(rsi).toContain("Not enough data yet");
    });
  });

  describe("MACD copy rules", () => {
    it("MACD line crosses above signal on last bar → 'Bullish crossover yesterday'", () => {
      // Prior bar: line below signal; Last bar: line above signal
      const indicators = makeIndicators({
        macd: [null, -0.5, 0.3],
        macdSignal: [null, -0.2, 0.1],
      });
      const bars = makeBars([980, 990, 1000]);
      const { macd } = buildSnapshotCopy(indicators, bars);

      expect(macd).toContain("Bullish crossover");
    });

    it("MACD line crosses below signal on last bar → 'Bearish crossover yesterday'", () => {
      // Prior bar: line above signal; Last bar: line below signal
      const indicators = makeIndicators({
        macd: [null, 0.3, -0.2],
        macdSignal: [null, 0.1, 0.05],
      });
      const bars = makeBars([980, 990, 1000]);
      const { macd } = buildSnapshotCopy(indicators, bars);

      expect(macd).toContain("Bearish crossover");
    });

    it("MACD line above signal (no crossover) → contains 'above signal line'", () => {
      const indicators = makeIndicators({
        macd: [null, 0.5, 0.6],
        macdSignal: [null, 0.2, 0.25],
      });
      const bars = makeBars([980, 990, 1000]);
      const { macd } = buildSnapshotCopy(indicators, bars);

      expect(macd.toLowerCase()).toContain("above signal");
    });

    it("MACD all null → 'Not enough data yet'", () => {
      const indicators = makeIndicators({
        macd: [null, null, null],
        macdSignal: [null, null, null],
      });
      const bars = makeBars([980, 990, 1000]);
      const { macd } = buildSnapshotCopy(indicators, bars);

      expect(macd).toContain("Not enough data yet");
    });
  });

  describe("EMA copy rules", () => {
    it("EMA-50: price above last EMA → 'short-term uptrend'", () => {
      const indicators = makeIndicators({ ema50: [null, null, 980] });
      const bars = makeBars([980, 990, 1000]); // last close=1000 > ema50=980
      const { ema50 } = buildSnapshotCopy(indicators, bars);

      expect(ema50.toLowerCase()).toContain("above");
      expect(ema50.toLowerCase()).toContain("uptrend");
    });

    it("EMA-50: price below last EMA → downtrend", () => {
      const indicators = makeIndicators({ ema50: [null, null, 1020] });
      const bars = makeBars([980, 990, 1000]); // last close=1000 < ema50=1020
      const { ema50 } = buildSnapshotCopy(indicators, bars);

      expect(ema50.toLowerCase()).toContain("below");
    });

    it("EMA-200: price below last EMA → 'long-term downtrend'", () => {
      const indicators = makeIndicators({ ema200: [null, null, 1100] });
      const bars = makeBars([980, 990, 1000]); // last close=1000 < ema200=1100
      const { ema200 } = buildSnapshotCopy(indicators, bars);

      expect(ema200.toLowerCase()).toContain("below");
      expect(ema200.toLowerCase()).toContain("downtrend");
    });

    it("EMA-50 all null → 'Not enough data yet'", () => {
      const indicators = makeIndicators({ ema50: [null, null, null] });
      const bars = makeBars([980, 990, 1000]);
      const { ema50 } = buildSnapshotCopy(indicators, bars);

      expect(ema50).toContain("Not enough data yet");
    });
  });

  describe("sparse handling", () => {
    it("when ATR is all null → 'Not enough data yet'", () => {
      const indicators = makeIndicators({ atr: [null, null, null] });
      const bars = makeBars([980, 990, 1000]);
      const { atr } = buildSnapshotCopy(indicators, bars);

      expect(atr).toContain("Not enough data yet");
    });

    it("when stochastic is all null → 'Not enough data yet'", () => {
      const indicators = makeIndicators({ stochastic: [null, null, null] });
      const bars = makeBars([980, 990, 1000]);
      const { stochastic } = buildSnapshotCopy(indicators, bars);

      expect(stochastic).toContain("Not enough data yet");
    });

    it("when OBV is all null → 'Not enough data yet'", () => {
      const indicators = makeIndicators({ obv: [null, null, null] });
      const bars = makeBars([980, 990, 1000]);
      const { obv } = buildSnapshotCopy(indicators, bars);

      expect(obv).toContain("Not enough data yet");
    });
  });
});
