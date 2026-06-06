import "server-only";

import type { OHLCVBar } from "./ohlcv-schema";

/**
 * Phase 13 T1 — TA-INGEST-01: fetch OHLCV bars from yahoo-finance2 for an IDX ticker.
 * STUB — Plan 03 replaces the body with the full implementation.
 *
 * Returns null on ANY failure path (return-null-on-failure convention from fetch-stock-data.ts).
 */
export async function fetchOHLCV(
  ticker: string,
  period1: Date,
  period2: Date,
): Promise<OHLCVBar[] | null> {
  // Ticker validation guard: same regex used throughout v1.0 for IDX ticker validation.
  // This partial implementation lets ohlcv-validation.test.ts ticker-rejection tests pass.
  if (!/^[A-Z]{1,5}$/.test(ticker)) {
    console.error("[fetchOHLCV] invalid ticker rejected", ticker);
    return null;
  }

  // Suppress unused parameter warnings in stub
  void period1;
  void period2;

  throw new Error("not implemented — Plan 03");
}
