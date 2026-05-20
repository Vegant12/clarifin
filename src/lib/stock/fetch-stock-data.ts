import "server-only";

import yahooFinance from "yahoo-finance2";

import { supabaseAdmin } from "@/db/client";

import {
  type ChartDataPoint,
  type StockData,
  stockDataSchema,
} from "./stock-schema";

// Raw yahoo-finance2 shapes — using loose types because yahoo-finance2 returns
// union types across many quote variants; we only access fields via optional
// chaining + nullish coalescing so unknown-cast is safe.
type YahooQuoteRaw = {
  regularMarketPrice?: number;
  trailingPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  [key: string]: unknown;
};

type YahooIncomeStatement = {
  endDate?: Date | string;
  totalRevenue?: number;
  netIncome?: number;
};

type YahooSummaryRaw = {
  incomeStatementHistory?: {
    incomeStatementHistory?: YahooIncomeStatement[];
  };
  [key: string]: unknown;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;

// Mirrors isTransientGeminiError pattern from analyze-document-batch.ts (consistency).
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
        console.error("[fetchStockData/withBackoff] giving up", err);
        return null;
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

/**
 * Fetches current quote + multi-year income history for an IDX ticker.
 * Returns null on ANY failure path (STOCK-03: never throws to caller).
 * Does NOT write cache — pure fetch + transform. Caller writes cache.
 */
export async function fetchStockData(ticker: string): Promise<StockData | null> {
  if (!/^[A-Z]{1,5}$/.test(ticker)) {
    console.error("[fetchStockData] invalid ticker rejected", ticker);
    return null;
  }
  const symbol = `${ticker}.JK`;

  // Cast via unknown → typed raw shape so TypeScript can verify field access below.
  const quoteRes = (await withBackoff(() => yahooFinance.quote(symbol))) as YahooQuoteRaw | null;
  const summaryRes = (await withBackoff(() =>
    yahooFinance.quoteSummary(symbol, {
      modules: ["incomeStatementHistory"],
    }),
  )) as YahooSummaryRaw | null;

  if (!quoteRes && !summaryRes) {
    return null;
  }

  const quote = {
    price: quoteRes?.regularMarketPrice ?? null,
    pe: quoteRes?.trailingPE ?? null,
    pb: quoteRes?.priceToBook ?? null,
    // Yahoo returns dividendYield as a fraction (0.032 → 3.2%). Convert at boundary.
    dividendYieldPct:
      typeof quoteRes?.dividendYield === "number"
        ? Math.round(quoteRes.dividendYield * 1000) / 10
        : null,
  };

  const rawStatements: ReadonlyArray<YahooIncomeStatement> =
    summaryRes?.incomeStatementHistory?.incomeStatementHistory ?? [];

  const history: ChartDataPoint[] = rawStatements
    .map((s): ChartDataPoint | null => {
      if (!s.endDate) return null;
      const year = new Date(s.endDate).getFullYear();
      if (Number.isNaN(year)) return null;
      const revenue = typeof s.totalRevenue === "number" ? s.totalRevenue : null;
      const netIncome = typeof s.netIncome === "number" ? s.netIncome : null;
      const netMarginPct =
        revenue && revenue !== 0 && netIncome !== null
          ? Math.round((netIncome / revenue) * 1000) / 10
          : null;
      return {
        year: year.toString(),
        revenue,
        netIncome,
        netMarginPct,
      };
    })
    .filter((row): row is ChartDataPoint => row !== null)
    .sort((a, b) => a.year.localeCompare(b.year));

  const result: StockData = {
    ticker,
    quote,
    history,
    fetchedAt: new Date().toISOString(),
  };

  // Final shape validation — defensive against future schema drift.
  const parsed = stockDataSchema.safeParse(result);
  if (!parsed.success) {
    console.error("[fetchStockData] schema validation failed", parsed.error);
    return null;
  }
  return parsed.data;
}

/**
 * Reads documents.ticker; if non-null, returns cached stock_data (when fresh)
 * or fetches fresh and writes the cache. Returns null when ticker is null
 * or fetch fails. Caller should treat null as "no widget, no chart."
 */
export async function fetchStockDataForDocument(
  docId: string,
): Promise<StockData | null> {
  const docRes = await supabaseAdmin
    .from("documents")
    .select("ticker, stock_data, stock_fetched_at")
    .eq("id", docId)
    .maybeSingle();
  if (docRes.error || !docRes.data) return null;
  const { ticker, stock_data, stock_fetched_at } = docRes.data;
  if (!ticker) return null;

  const fresh =
    stock_fetched_at !== null &&
    Date.now() - new Date(stock_fetched_at).getTime() < CACHE_TTL_MS;

  if (fresh && stock_data) {
    const parsed = stockDataSchema.safeParse(stock_data);
    if (parsed.success) return parsed.data;
    // fall through to refetch on schema drift
  }

  const fresh_data = await fetchStockData(ticker);
  if (!fresh_data) return null;

  await supabaseAdmin
    .from("documents")
    .update({
      stock_data: fresh_data,
      stock_fetched_at: fresh_data.fetchedAt,
    })
    .eq("id", docId);

  return fresh_data;
}
