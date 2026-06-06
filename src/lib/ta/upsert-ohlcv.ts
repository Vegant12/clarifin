import "server-only";

import { supabaseAdmin } from "@/db/client";
import type { OHLCVBar } from "./ohlcv-schema";

/**
 * Phase 13 T1 — TA-INGEST-01: upsert OHLCV bars into ohlcv_cache.
 *
 * CRITICAL (T-13-11, PITFALLS.md P2): uses onConflict:"ticker,date" so concurrent
 * cron runs are idempotent — the DB UNIQUE(ticker, date) constraint backs this.
 *
 * Errors are logged and swallowed (return-null-on-failure convention). The nightly
 * cron will retry on the next run.
 *
 * Security (T-13-12): import "server-only" prevents accidental client-bundle inclusion.
 */
export async function upsertOHLCV(
  ticker: string,
  bars: OHLCVBar[],
): Promise<void> {
  if (bars.length === 0) return;

  const { error } = await supabaseAdmin
    .from("ohlcv_cache")
    .upsert(
      bars.map((b) => ({
        ticker,
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        adj_close: b.adjClose, // OHLCVBar.adjClose → snake_case DB column adj_close
        volume: b.volume,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "ticker,date" },
    );

  if (error) {
    console.error("[upsertOHLCV] upsert error", ticker, error.message);
    // Do not throw — match fetch-stock-data.ts return-null-on-failure convention.
  }
}
