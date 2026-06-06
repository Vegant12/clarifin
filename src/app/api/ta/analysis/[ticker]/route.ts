/**
 * Phase 13 Plan 04 — TA-TICKER-01/TA-CHART-08: Cached OHLCV analysis route.
 *
 * GET /api/ta/analysis/[ticker]
 *
 * Returns AnalysisPayload from ohlcv_cache + computed indicators + snapshot copy.
 * Does NOT call yahoo-finance2 directly — reads only the pre-populated cache.
 * Sparse gate: returns sparse:true (no indicators/snapshot) when candle_count < 30.
 *
 * Security (T-13-13): ticker path param validated by Zod regex before any DB access.
 * Cache: s-maxage=3600 (analysis is nightly-refreshed, not real-time).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { computeIndicators } from "@/lib/ta/compute-indicators";
import { buildSnapshotCopy } from "@/lib/ta/snapshot-copy";
import { analysisPayloadSchema } from "@/lib/ta/analysis-schema";
import type { AnalysisPayload } from "@/lib/ta/analysis-schema";
import type { OHLCVBar } from "@/lib/ta/ohlcv-schema";

export const maxDuration = 60;
export const runtime = "nodejs";

// T-13-13: strict ticker validation at trust boundary — 400 on failure
const tickerSchema = z.string().regex(/^[A-Z]{1,5}$/);

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const { ticker: rawTicker } = await context.params;
  const parsed = tickerSchema.safeParse(rawTicker);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid ticker. Must be 1-5 uppercase letters." },
      { status: 400 },
    );
  }

  const ticker = parsed.data;

  // Step 1: Metadata lookup — confirm ticker exists in ticker_metadata
  const { data: meta, error: metaError } = await supabaseAdmin
    .from("ticker_metadata")
    .select("ticker, name_en")
    .eq("ticker", ticker)
    .maybeSingle();

  if (metaError) {
    console.error(`[ta/analysis] ticker_metadata lookup error for ${ticker}:`, metaError.message);
    return NextResponse.json(
      { data: null, error: "Failed to look up ticker metadata." },
      { status: 500 },
    );
  }

  if (!meta) {
    return NextResponse.json(
      { data: null, error: "Ticker not found." },
      { status: 404 },
    );
  }

  // Step 2: Read OHLCV from cache — up to 520 bars (~2 years of trading days)
  const { data: rows, error: ohlcvError } = await supabaseAdmin
    .from("ohlcv_cache")
    .select("date, open, high, low, close, adj_close, volume")
    .eq("ticker", ticker)
    .order("date", { ascending: true })
    .limit(520);

  if (ohlcvError) {
    console.error(`[ta/analysis] ohlcv_cache read error for ${ticker}:`, ohlcvError.message);
    return NextResponse.json(
      { data: null, error: "Failed to read price history." },
      { status: 500 },
    );
  }

  // Map DB column names to OHLCVBar field names (adj_close → adjClose)
  const bars: OHLCVBar[] = (rows ?? []).map((row) => ({
    date: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    adjClose: row.adj_close,
    volume: row.volume,
  }));

  const candle_count = bars.length;
  // TA-CHART-08: sparse gate — do not compute indicators on <30 bars (avoids NaN)
  const sparse = candle_count < 30;

  let payload: AnalysisPayload;

  if (sparse) {
    // Return minimal payload with empty indicators/snapshot — page gates rendering
    payload = {
      ticker,
      name_en: meta.name_en ?? ticker,
      last_updated: bars[bars.length - 1]?.date ?? "",
      ohlcv: bars,
      indicators: {
        rsi: [],
        macd: [],
        macdSignal: [],
        macdHistogram: [],
        bollingerUpper: [],
        bollingerMiddle: [],
        bollingerLower: [],
        ema20: [],
        ema50: [],
        ema200: [],
        sma50: [],
        atr: [],
        stochastic: [],
        obv: [],
      },
      snapshot: {},
      candle_count,
      sparse: true,
    };
  } else {
    const indicators = computeIndicators(bars);
    // Spread into a plain Record<string,string> so it satisfies the AnalysisPayload type
    const snapshot: Record<string, string> = { ...buildSnapshotCopy(indicators, bars) };
    const lastBar = bars[bars.length - 1];

    payload = {
      ticker,
      name_en: meta.name_en ?? ticker,
      last_updated: lastBar?.date ?? "",
      ohlcv: bars,
      indicators,
      snapshot,
      candle_count,
      sparse: false,
    };
  }

  // Validate outgoing shape — log on mismatch (never fail the request for this)
  const validation = analysisPayloadSchema.safeParse(payload);
  if (!validation.success) {
    console.error(
      `[ta/analysis] payload schema mismatch for ${ticker}:`,
      validation.error.issues,
    );
  }

  return NextResponse.json(
    { data: payload, error: null },
    {
      status: 200,
      headers: {
        // 1-hour CDN cache — analysis is nightly-refreshed, not real-time
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    },
  );
}
