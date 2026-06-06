#!/usr/bin/env npx tsx
/**
 * One-shot: seed ticker_metadata with market-cap top-100 IDX tickers (≥2yr history)
 * and backfill 5yr OHLCV per seeded ticker into ohlcv_cache.
 *
 * Prerequisites: ohlcv_cache + ticker_metadata tables must exist (Plan 01 migration).
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same as dev .env.local).
 *
 * Run: pnpm ta:seed
 * Re-running is idempotent — upserts use onConflict keys.
 *
 * Requirements: TA-DATA-01 (D-02, D-03, D-06)
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import YahooFinance from "yahoo-finance2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} must be set (use .env.local or export before running)`,
    );
  }
  return v;
}

const RETRY_DELAYS_MS = [500, 1000, 2000] as const;

function isRateLimitError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /(429|rate.?limit|quota|RESOURCE_EXHAUSTED|too many requests)/i.test(
      err.message,
    )
  );
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt === RETRY_DELAYS_MS.length) {
        console.warn(
          "[seed] fetch error:",
          err instanceof Error ? err.message : String(err),
        );
        return null;
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
      console.warn(`[seed] rate-limited, retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bar validation (TA-INGEST-01 rules)
// keep in sync with fetch-ohlcv.ts TA-INGEST-01 rules
// ---------------------------------------------------------------------------

interface RawBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number | null;
  volume: number;
}

function isValidBar(b: RawBar, prevClose: number | null): boolean {
  // Rule 1: high must be >= low
  if (b.high < b.low) return false;
  // Rule 2: close must be positive
  if (b.close <= 0) return false;
  // Rule 3: volume must be non-negative
  if (b.volume < 0) return false;
  // Rule 4: single-bar return > 50% flagged as likely uncorrected split
  if (prevClose !== null && prevClose > 0) {
    const ret = Math.abs(b.close - prevClose) / prevClose;
    if (ret > 0.5) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const yahooFinance = new YahooFinance();

  // -------------------------------------------------------------------------
  // Step 1: Load candidate tickers from committed JSON
  // -------------------------------------------------------------------------
  const candidatesPath = resolve(__dirname, "idx-candidates.json");
  // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON import
  const candidateCodes: string[] = ((await import(candidatesPath, { assert: { type: "json" } })) as unknown as { default: string[] }).default;
  console.log(
    `[seed] loaded ${candidateCodes.length} candidate tickers from idx-candidates.json`,
  );

  // -------------------------------------------------------------------------
  // Step 2: Quote each candidate to get marketCap + firstTradeDate
  // -------------------------------------------------------------------------
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  type TickerRow = {
    ticker: string;
    name_en: string;
    name_id: string | null;
    sector: string | null;
    market_cap: number | null;
    first_trade_date: string | null;
  };

  const qualified: TickerRow[] = [];
  let quoteFailures = 0;

  for (let i = 0; i < candidateCodes.length; i++) {
    const code = candidateCodes[i] as string;
    process.stdout.write(
      `  [${i + 1}/${candidateCodes.length}] quoting ${code}.JK…\r`,
    );

    const quote = await withBackoff(() =>
      yahooFinance.quote(`${code}.JK`, {
        fields: [
          "longName",
          "shortName",
          "marketCap",
          "firstTradeDateMilliseconds",
          "sector",
        ] as const,
      }),
    );

    if (!quote) {
      console.warn(`[seed] skipping ${code} — quote failed`);
      quoteFailures++;
      continue;
    }

    // Derive firstTradeDate from firstTradeDateMilliseconds
    const firstTradeDateMs =
      (quote as unknown as { firstTradeDateMilliseconds?: number })
        .firstTradeDateMilliseconds ?? null;
    const firstTradeDate = firstTradeDateMs
      ? new Date(firstTradeDateMs)
      : null;

    // D-03: filter out tickers with < 2yr trading history
    if (!firstTradeDate || firstTradeDate > twoYearsAgo) {
      console.warn(
        `[seed] skipping ${code} — insufficient history (firstTradeDate: ${firstTradeDate?.toISOString() ?? "unknown"})`,
      );
      continue;
    }

    const nameEn =
      (quote as unknown as { longName?: string; shortName?: string }).longName ??
      (quote as unknown as { longName?: string; shortName?: string }).shortName ??
      code;
    const marketCap =
      (quote as unknown as { marketCap?: number }).marketCap ?? null;
    const sector =
      (quote as unknown as { sector?: string }).sector ?? null;

    qualified.push({
      ticker: code,
      name_en: nameEn,
      name_id: null,
      sector,
      market_cap: marketCap,
      first_trade_date: firstTradeDate.toISOString().slice(0, 10),
    });
  }

  console.log(
    `\n[seed] ${qualified.length} tickers passed ≥2yr filter (${quoteFailures} quote failures)`,
  );

  // -------------------------------------------------------------------------
  // Step 3: Sort by market cap desc, take top 100
  // -------------------------------------------------------------------------
  const sorted = qualified
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 100);

  console.log(
    `[seed] top-${sorted.length} by market cap selected. Top 5:`,
    sorted.slice(0, 5).map((t) => `${t.ticker}(${t.market_cap?.toLocaleString() ?? "?"})`).join(", "),
  );

  // -------------------------------------------------------------------------
  // Step 4: Write seed-tickers.json (sorted by ticker code for stable diffs)
  // D-02: committed JSON for deterministic deploys
  // -------------------------------------------------------------------------
  const seedListPath = resolve(__dirname, "seed-tickers.json");
  const seedList = [...sorted].sort((a, b) =>
    a.ticker.localeCompare(b.ticker),
  );
  writeFileSync(seedListPath, JSON.stringify(seedList, null, 2) + "\n");
  console.log(`[seed] wrote seed-tickers.json (${seedList.length} entries)`);

  // -------------------------------------------------------------------------
  // Step 5: Upsert into ticker_metadata
  // -------------------------------------------------------------------------
  const { error: metaErr } = await supabase
    .from("ticker_metadata")
    .upsert(sorted, { onConflict: "ticker" });

  if (metaErr) {
    throw new Error(`ticker_metadata upsert failed: ${metaErr.message}`);
  }
  console.log(`[seed] upserted ${sorted.length} rows into ticker_metadata`);

  // -------------------------------------------------------------------------
  // Step 6: 5yr OHLCV backfill per seeded ticker into ohlcv_cache
  // D-06: backfill ships in T1 to preserve T2 ‖ T3 critical-path parallelisation
  // -------------------------------------------------------------------------
  const fiveYearsAgo = new Date(today);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const BATCH_SIZE = 500;
  let totalBarsInserted = 0;
  let ohlcvFailures = 0;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (!row) continue;
    const { ticker } = row;
    process.stdout.write(
      `  [${i + 1}/${sorted.length}] backfilling ${ticker}…\r`,
    );

    const rawBars = await withBackoff(() =>
      yahooFinance.historical(`${ticker}.JK`, {
        period1: fiveYearsAgo,
        period2: today,
        interval: "1d",
      }),
    );

    if (!rawBars || rawBars.length === 0) {
      console.warn(`\n[seed] skipping ${ticker} — no OHLCV data returned`);
      ohlcvFailures++;
      continue;
    }

    // Validate bars (TA-INGEST-01 four-rule filter)
    const validBars: {
      ticker: string;
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      adj_close: number;
      volume: number;
      fetched_at: string;
    }[] = [];
    let rejectedCount = 0;
    let prevClose: number | null = null;

    for (const b of rawBars) {
      if (!isValidBar(b, prevClose)) {
        rejectedCount++;
        // Update prevClose even for rejected bars so we don't double-flag splits
        prevClose = b.close;
        continue;
      }
      validBars.push({
        ticker,
        date: b.date.toISOString().slice(0, 10),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        // Use adjClose if available (corporate-action-adjusted), fall back to close
        adj_close: b.adjClose ?? b.close,
        volume: b.volume,
        fetched_at: new Date().toISOString(),
      });
      prevClose = b.close;
    }

    if (rejectedCount > 0) {
      console.warn(
        `\n[seed] ${ticker}: rejected ${rejectedCount}/${rawBars.length} bars (failed TA-INGEST-01 validation)`,
      );
    }

    if (validBars.length === 0) {
      console.warn(`\n[seed] skipping ${ticker} — all bars failed validation`);
      ohlcvFailures++;
      continue;
    }

    // Upsert in batches to avoid request size limits
    for (let j = 0; j < validBars.length; j += BATCH_SIZE) {
      const batch = validBars.slice(j, j + BATCH_SIZE);
      const { error: upsertErr } = await supabase
        .from("ohlcv_cache")
        .upsert(batch, { onConflict: "ticker,date" });

      if (upsertErr) {
        console.warn(
          `\n[seed] ${ticker} batch upsert error:`,
          upsertErr.message,
        );
        // Log-and-continue per D-06 — don't abort the entire run
      } else {
        totalBarsInserted += batch.length;
      }
    }
  }

  console.log(`\n[seed] backfill complete.`);
  console.log(`  tickers seeded:    ${sorted.length}`);
  console.log(`  OHLCV failures:    ${ohlcvFailures}`);
  console.log(`  total bars upserted: ${totalBarsInserted}`);
  console.log(
    `\nNext steps:\n  1. Verify: select count(*) from ticker_metadata;\n  2. Verify: select count(*) from ohlcv_cache;\n  3. Spot-check: select * from ohlcv_cache where ticker='BBCA' order by date desc limit 3;`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
