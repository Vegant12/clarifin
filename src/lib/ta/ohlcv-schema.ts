/**
 * Phase 13 T1 — TA-INGEST-01: typed contract for yahoo-finance2 historical OHLCV output.
 * Used at three boundaries:
 *  1) fetch-ohlcv.ts: validates and maps yahoo-finance2 historical() response.
 *  2) upsert-ohlcv.ts: maps OHLCVBar to ohlcv_cache table rows.
 *  3) compute-indicators.ts: receives OHLCVBar[] as input.
 */
import { z } from "zod";

export const ohlcvBarSchema = z.object({
  date: z.string(), // ISO date string "YYYY-MM-DD"
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  adjClose: z.number(),
  volume: z.number(),
});

export type OHLCVBar = z.infer<typeof ohlcvBarSchema>;
