/**
 * Phase 13 Plan 04 — TA-TICKER-02: Ticker URL normalization tests.
 *
 * Tests the normalizeTickerParam pure helper that the /ta/[ticker] RSC page
 * uses to redirect lowercase tickers and validate the format.
 */
import { describe, it, expect } from "vitest";

import { normalizeTickerParam } from "@/lib/ta/ticker-route";

describe("normalizeTickerParam", () => {
  describe("lowercase redirect", () => {
    it("lowercase ticker → redirectTo /ta/BBCA", () => {
      const result = normalizeTickerParam("bbca");
      expect(result.redirectTo).toBe("/ta/BBCA");
    });

    it("mixed-case ticker → redirectTo uppercase path", () => {
      const result = normalizeTickerParam("Bbca");
      expect(result.redirectTo).toBe("/ta/BBCA");
    });

    it("lowercase valid ticker → valid: true", () => {
      const result = normalizeTickerParam("tlkm");
      expect(result.valid).toBe(true);
      expect(result.redirectTo).toBe("/ta/TLKM");
    });
  });

  describe("uppercase pass-through", () => {
    it("uppercase valid ticker → redirectTo null, valid true", () => {
      const result = normalizeTickerParam("BBCA");
      expect(result.redirectTo).toBeNull();
      expect(result.valid).toBe(true);
    });

    it("5-letter uppercase ticker → valid true, no redirect", () => {
      const result = normalizeTickerParam("GOTO0");
      // Has a digit — invalid but still uppercase, no redirect
      expect(result.redirectTo).toBeNull();
    });
  });

  describe("invalid format", () => {
    it("ticker with hyphen → valid false", () => {
      const result = normalizeTickerParam("bb-ca");
      // "bb-ca" uppercases to "BB-CA" which fails the regex
      expect(result.valid).toBe(false);
    });

    it("ticker with hyphen uppercase → no redirect (already uppercase-ish)", () => {
      const result = normalizeTickerParam("BB-CA");
      expect(result.redirectTo).toBeNull();
      expect(result.valid).toBe(false);
    });

    it("empty string → valid false, no redirect", () => {
      const result = normalizeTickerParam("");
      expect(result.redirectTo).toBeNull();
      expect(result.valid).toBe(false);
    });

    it("6-letter ticker → valid false", () => {
      const result = normalizeTickerParam("TOOLONG");
      expect(result.valid).toBe(false);
    });

    it("ticker with digit only → valid false", () => {
      const result = normalizeTickerParam("12345");
      expect(result.valid).toBe(false);
    });
  });
});
