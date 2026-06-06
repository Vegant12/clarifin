/**
 * Phase 13 Plan 04 — TA-TICKER-01/TA-IND-05: AnalysisPayload Zod schema and type.
 *
 * Shared contract between:
 * - src/app/api/ta/analysis/[ticker]/route.ts (producer)
 * - src/components/ta/candlestick-chart.tsx (Plan 05 consumer)
 * - src/app/ta/[ticker]/page.tsx (Plan 07 consumer)
 *
 * Mirrors stock-schema.ts pattern: Zod schema + co-located TypeScript type.
 */
import { z } from "zod";

import { ohlcvBarSchema } from "./ohlcv-schema";
import { indicatorSetSchema } from "./indicator-schema";

/**
 * AnalysisPayload — full response from GET /api/ta/analysis/[ticker].
 *
 * Fields:
 * - ticker: validated IDX ticker code (1-5 uppercase letters)
 * - name_en: English company name from ticker_metadata
 * - last_updated: ISO date of the latest OHLCV bar ("YYYY-MM-DD")
 * - ohlcv: up to 2 years of OHLCV bars, ascending by date
 * - indicators: all 10 computed indicators, null-padded to ohlcv.length (TA-IND-01..04)
 * - snapshot: plain-English one-liner per indicator (TA-IND-05)
 * - candle_count: number of OHLCV bars available
 * - sparse: true if candle_count < 30 — page gates rendering on this flag (TA-CHART-08)
 */
export const analysisPayloadSchema = z.object({
  ticker: z.string().regex(/^[A-Z]{1,5}$/),
  name_en: z.string(),
  last_updated: z.string(), // ISO date "YYYY-MM-DD"
  ohlcv: z.array(ohlcvBarSchema),
  indicators: indicatorSetSchema,
  snapshot: z.record(z.string(), z.string()), // Record<string, string> — key per indicator
  candle_count: z.number().int().nonnegative(),
  sparse: z.boolean(),
});

export type AnalysisPayload = z.infer<typeof analysisPayloadSchema>;
