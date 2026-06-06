import { describe, expect, it } from "vitest";

import { computeIndicators } from "@/lib/ta/compute-indicators";

// 250-bar synthetic OHLCV series committed as a fixture (deterministic, fixed seed)
import ohlcvFixture from "./fixtures/ohlcv-250.json";
// Ground-truth values computed offline using the same technicalindicators library
import groundTruth from "./fixtures/indicators-ground-truth.json";

/**
 * Wave 0 RED test stubs — TA-IND-01..04 indicator alignment + tolerance contract.
 * REQUIRED for VERIFICATION.md: these tests must pass before Phase 13 verifies.
 *
 * All tests are RED until Plan 03 implements computeIndicators.
 * The fixture-based approach guards against future regressions (not against the library).
 */
describe("compute-indicators (TA-IND-01..04, REQUIRED for VERIFICATION.md)", () => {
  it("RSI(14) last value matches ground truth within 0.001 tolerance", () => {
    // RED until Plan 03 — computeIndicators throws "not implemented"
    const result = computeIndicators(ohlcvFixture);
    const lastRsi = result.rsi.filter((v): v is number => v !== null).at(-1);
    expect(lastRsi).toBeCloseTo(groundTruth.rsi14Last, 3);
  });

  it("MACD(12,26,9) warmup alignment: first non-null at groundTruth.macdWarmupFirstIndex", () => {
    // RED until Plan 03
    const result = computeIndicators(ohlcvFixture);
    const firstNullIndex = groundTruth.macdWarmupFirstIndex - 1;
    const firstNonNullIndex = groundTruth.macdWarmupFirstIndex;
    // All indices before warmup should be null
    expect(result.macd[firstNullIndex]).toBeNull();
    // First value after warmup should be non-null
    expect(result.macd[firstNonNullIndex]).not.toBeNull();
  });

  it("all aligned arrays have length === bar count (250)", () => {
    // RED until Plan 03 — verifies no off-by-one in alignment padding
    const result = computeIndicators(ohlcvFixture);
    const barCount = ohlcvFixture.length; // 250
    expect(result.rsi).toHaveLength(barCount);
    expect(result.macd).toHaveLength(barCount);
    expect(result.bollingerUpper).toHaveLength(barCount);
    expect(result.ema20).toHaveLength(barCount);
    expect(result.ema50).toHaveLength(barCount);
    expect(result.ema200).toHaveLength(barCount);
    expect(result.obv).toHaveLength(barCount);
  });

  it("BollingerBands(20,2) last upper matches ground truth within 0.001", () => {
    // RED until Plan 03
    const result = computeIndicators(ohlcvFixture);
    const lastBBUpper = result.bollingerUpper
      .filter((v): v is number => v !== null)
      .at(-1);
    expect(lastBBUpper).toBeCloseTo(groundTruth.bbUpper, 3);
  });

  it("BollingerBands(20,2) last lower matches ground truth within 0.001", () => {
    // RED until Plan 03
    const result = computeIndicators(ohlcvFixture);
    const lastBBLower = result.bollingerLower
      .filter((v): v is number => v !== null)
      .at(-1);
    expect(lastBBLower).toBeCloseTo(groundTruth.bbLower, 3);
  });

  it("EMA-20 last value matches ground truth within 0.001", () => {
    // RED until Plan 03
    const result = computeIndicators(ohlcvFixture);
    const lastEma20 = result.ema20.filter((v): v is number => v !== null).at(-1);
    expect(lastEma20).toBeCloseTo(groundTruth.ema20Last, 3);
  });

  it("EMA-50 last value matches ground truth within 0.001", () => {
    // RED until Plan 03
    const result = computeIndicators(ohlcvFixture);
    const lastEma50 = result.ema50.filter((v): v is number => v !== null).at(-1);
    expect(lastEma50).toBeCloseTo(groundTruth.ema50Last, 3);
  });

  it("EMA-200 last value matches ground truth within 0.001", () => {
    // RED until Plan 03
    const result = computeIndicators(ohlcvFixture);
    const lastEma200 = result.ema200
      .filter((v): v is number => v !== null)
      .at(-1);
    expect(lastEma200).toBeCloseTo(groundTruth.ema200Last, 3);
  });
});
