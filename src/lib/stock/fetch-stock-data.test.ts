import { describe, it } from "vitest";

// import { fetchStockData } from "./fetch-stock-data"; // Plan 03 creates

describe("fetchStockData (Phase 9, STOCK-01/02/03/05)", () => {
  it.todo("returns null when yahoo-finance2 throws (STOCK-03 error boundary)");
  it.todo("returns null when ticker has no quote data");
  it.todo("retries on 429 / rate-limit errors with exponential backoff (STOCK-05)");
  it.todo("returns cached data when stock_fetched_at is within 24h (STOCK-05)");
  it.todo("re-fetches when stock_fetched_at is older than 24h");
  it.todo("appends .JK suffix to ticker before calling yahoo-finance2");
  it.todo("returns { quote, history } shape with price/PE/PB/dividendYield and year/revenue/netIncome/netMarginPct");
});
