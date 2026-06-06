import "server-only";

/**
 * Phase 13 Plan 07 — TA-INFRA-02: runTaRefreshOhlcv job.
 *
 * Appends the latest trading bars for every ticker in ticker_metadata.
 * Fetches the last 5 trading days from yahoo-finance2 and upserts into
 * ohlcv_cache. The onConflict="ticker,date" upsert is idempotent — re-runs
 * after a partial failure simply re-insert already-existing rows without
 * duplicates (PITFALLS.md P2).
 *
 * Uses a deadline budget to avoid overrunning Vercel's 60s function cap.
 * Each ticker is processed until the deadline, after which the remaining
 * tickers are recorded as skipped. The next daily cron will pick them up.
 *
 * Security: ticker values come from the DB (ticker_metadata); they still
 * pass through fetchOHLCV which validates /^[A-Z]{1,5}$/ before the
 * .JK append (T-13-10).
 */

import { supabaseAdmin } from "@/db/client";
import { fetchOHLCV } from "@/lib/ta/fetch-ohlcv";
import { upsertOHLCV } from "@/lib/ta/upsert-ohlcv";

interface RefreshOhlcvOpts {
  /** Hard deadline — stop processing new tickers after this timestamp. */
  deadline: Date;
}

interface RefreshOhlcvResult {
  tickersProcessed: number;
  tickersSkippedForDeadline: number;
  tickersWithError: number;
}

export async function runTaRefreshOhlcv(
  opts: RefreshOhlcvOpts,
): Promise<Record<string, unknown>> {
  const { deadline } = opts;

  // Read the full seeded ticker list from ticker_metadata.
  const { data: tickers, error: listError } = await supabaseAdmin
    .from("ticker_metadata")
    .select("ticker")
    .order("ticker", { ascending: true });

  if (listError) {
    console.error("[runTaRefreshOhlcv] failed to read ticker_metadata", listError.message);
    return { error: listError.message, tickersProcessed: 0 };
  }

  if (!tickers || tickers.length === 0) {
    console.warn("[runTaRefreshOhlcv] no tickers in ticker_metadata — nothing to refresh");
    return { tickersProcessed: 0, tickersSkippedForDeadline: 0, tickersWithError: 0 };
  }

  const result: RefreshOhlcvResult = {
    tickersProcessed: 0,
    tickersSkippedForDeadline: 0,
    tickersWithError: 0,
  };

  // Fetch the last ~5 trading days (7 calendar days covers weekends).
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const row of tickers) {
    // T-13-27: check deadline before each ticker to stay within budget.
    if (Date.now() >= deadline.getTime()) {
      result.tickersSkippedForDeadline++;
      continue;
    }

    const ticker = row.ticker;
    try {
      const bars = await fetchOHLCV(ticker, sevenDaysAgo, today);
      if (bars && bars.length > 0) {
        await upsertOHLCV(ticker, bars);
      }
      result.tickersProcessed++;
    } catch (err) {
      // Log-and-continue: one ticker failing should not abort the others.
      console.error(
        "[runTaRefreshOhlcv] error refreshing ticker",
        ticker,
        err instanceof Error ? err.message : err,
      );
      result.tickersWithError++;
    }
  }

  console.log(
    `[runTaRefreshOhlcv] done — processed=${result.tickersProcessed} skipped=${result.tickersSkippedForDeadline} errors=${result.tickersWithError}`,
  );

  // Spread into a plain object so the return satisfies Record<string, unknown>
  // (TypeScript strict mode does not widen a typed interface to an index-signature type).
  return { ...result };
}
