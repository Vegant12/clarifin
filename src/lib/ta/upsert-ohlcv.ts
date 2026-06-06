import "server-only";

import type { OHLCVBar } from "./ohlcv-schema";

/**
 * Phase 13 T1 — TA-INGEST-01: upsert OHLCV bars into ohlcv_cache.
 * STUB — Plan 03 replaces the body with the full implementation.
 *
 * CRITICAL: upsert MUST use onConflict:"ticker,date" to prevent duplicate rows
 * from concurrent cron runs (PITFALLS.md P2, T1-OWNED, TA-INGEST-01).
 * Asserted by tests/ta/ohlcv-uniqueness.test.ts.
 */
export async function upsertOHLCV(
  _ticker: string,
  _bars: OHLCVBar[],
): Promise<void> {
  throw new Error("not implemented — Plan 03");
}
