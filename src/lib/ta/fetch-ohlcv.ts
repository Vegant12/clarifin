import "server-only";

import yahooFinance from "yahoo-finance2";

import type { OHLCVBar } from "./ohlcv-schema";

// Mirrors withBackoff pattern from src/lib/stock/fetch-stock-data.ts (copy verbatim).
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;

function isRateLimitError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /(429|rate.?limit|quota|RESOURCE_EXHAUSTED)/i.test(err.message)
  );
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt === RETRY_DELAYS_MS.length) {
        console.warn(
          "[fetchOHLCV] no data available:",
          err instanceof Error ? err.message : err,
        );
        return null;
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

/**
 * TA-INGEST-01: validate a single OHLCV bar.
 * Exported so seed scripts can reuse the same rule and avoid drift (T-13-09).
 *
 * @param bar - the raw bar to validate
 * @param prevClose - previous bar's close; if null this is the first bar (skip >50% return check)
 */
export function isValidBar(
  bar: { high: number; low: number; close: number; volume: number },
  prevClose: number | null,
): boolean {
  if (bar.high < bar.low) return false;
  if (bar.close <= 0) return false;
  if (bar.volume < 0) return false;
  // Single-bar return >50% filter — only applicable when we have a previous close.
  if (prevClose !== null && Math.abs(bar.close / prevClose - 1) > 0.5) {
    return false;
  }
  return true;
}

/**
 * Phase 13 T1 — TA-INGEST-01: fetch OHLCV bars from yahoo-finance2 for an IDX ticker.
 *
 * Returns null on ANY failure path (return-null-on-failure convention from fetch-stock-data.ts).
 * Returns [] when all bars fail validation.
 *
 * Security (T-13-10): ticker must match /^[A-Z]{1,5}$/ before .JK is appended — no
 * raw input reaches the yahoo call.
 */
export async function fetchOHLCV(
  ticker: string,
  period1: Date,
  period2: Date,
): Promise<OHLCVBar[] | null> {
  // T-13-10: ticker validation guard — same regex used throughout v1.0.
  if (!/^[A-Z]{1,5}$/.test(ticker)) {
    console.error("[fetchOHLCV] invalid ticker rejected", ticker);
    return null;
  }

  const symbol = `${ticker}.JK`;

  // Cast via unknown: yahoo-finance2 historical() returns a complex union type;
  // the generic T inference through withBackoff collapses it to {}.
  // We only access well-known OHLCV fields via optional chaining / nullish coalescing below.
  type RawBar = {
    date: Date | string;
    open: number;
    high: number;
    low: number;
    close: number;
    adjClose?: number | null;
    volume: number;
  };

  const rawBars = (await withBackoff(() =>
    yahooFinance.historical(symbol, {
      period1,
      period2,
      interval: "1d",
    }),
  )) as RawBar[] | null;

  if (!rawBars) return null;

  const validBars: OHLCVBar[] = [];
  let prevClose: number | null = null;

  for (const b of rawBars) {
    if (isValidBar(b, prevClose)) {
      const bar: OHLCVBar = {
        // Normalise date to ISO "YYYY-MM-DD" string — yahoo-finance2 returns a Date object.
        date:
          b.date instanceof Date
            ? b.date.toISOString().slice(0, 10)
            : String(b.date),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        adjClose: b.adjClose ?? b.close,
        volume: b.volume,
      };
      validBars.push(bar);
      // Track prevClose from *raw* bar so the next bar's >50% check is against
      // the value Yahoo returned (before any adjClose substitution).
      prevClose = b.close;
    } else {
      // Reset prevClose to skip the >50% check on the next bar after an invalid one.
      // This is conservative: don't treat the invalid bar's close as the baseline.
      prevClose = null;
    }
  }

  return validBars;
}
