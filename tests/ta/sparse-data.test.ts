/**
 * Phase 13 Plan 07 — sparse-data.test.ts
 * TA-CHART-08: Unit tests for the shouldRenderSparse gate helper.
 *
 * Confirms that the chart render path is never triggered when fewer than
 * 30 candles are available (avoiding NaN in indicator computations).
 */

import { describe, expect, it } from "vitest";

import { shouldRenderSparse } from "@/lib/ta/ticker-route";

describe("shouldRenderSparse (TA-CHART-08)", () => {
  it("returns true when candle_count is 10 (far below threshold)", () => {
    expect(shouldRenderSparse({ candle_count: 10, sparse: false })).toBe(true);
  });

  it("returns true when candle_count is 29 (one below threshold)", () => {
    expect(shouldRenderSparse({ candle_count: 29, sparse: false })).toBe(true);
  });

  it("returns false when candle_count is 30 (exactly at threshold)", () => {
    expect(shouldRenderSparse({ candle_count: 30, sparse: false })).toBe(false);
  });

  it("returns false when candle_count is 250 and sparse is false", () => {
    expect(shouldRenderSparse({ candle_count: 250, sparse: false })).toBe(false);
  });

  it("returns true when sparse flag is true regardless of candle_count", () => {
    expect(shouldRenderSparse({ candle_count: 250, sparse: true })).toBe(true);
  });

  it("returns true when sparse flag is true AND candle_count is below threshold", () => {
    expect(shouldRenderSparse({ candle_count: 10, sparse: true })).toBe(true);
  });

  it("returns false when candle_count is 520 (full 2yr backfill) and sparse is false", () => {
    expect(shouldRenderSparse({ candle_count: 520, sparse: false })).toBe(false);
  });
});
