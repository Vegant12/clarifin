/**
 * Phase 9 — STOCK-01/02/05 + CHART-01/02: typed contract for yahoo-finance2 output.
 * Used at three boundaries:
 *  1) fetch-stock-data.ts: parses live yahoo-finance2 response.
 *  2) page.tsx RSC: parses documents.stock_data JSONB cache.
 *  3) /api/stock/[ticker] route: validates outgoing response shape.
 */
import { z } from "zod";

export const stockQuoteSchema = z.object({
  price: z.number().nullable(),
  pe: z.number().nullable(),
  pb: z.number().nullable(),
  // Yahoo returns dividendYield as a fraction (0.032). We convert to percent (3.2) at
  // the fetch boundary so consumers don't need to know the unit. Null when undefined.
  dividendYieldPct: z.number().nullable(),
});

export const chartDataPointSchema = z.object({
  year: z.string(),
  revenue: z.number().nullable(),
  netIncome: z.number().nullable(),
  // Net margin as a percent (18.5, not 0.185). Pre-computed at fetch boundary.
  netMarginPct: z.number().nullable(),
});

export const stockDataSchema = z.object({
  ticker: z.string().regex(/^[A-Z]{1,5}$/),
  quote: stockQuoteSchema,
  history: z.array(chartDataPointSchema),
  fetchedAt: z.string(),
});

export type StockQuote = z.infer<typeof stockQuoteSchema>;
export type ChartDataPoint = z.infer<typeof chartDataPointSchema>;
export type StockData = z.infer<typeof stockDataSchema>;
