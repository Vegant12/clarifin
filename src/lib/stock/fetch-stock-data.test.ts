import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock yahoo-finance2 BEFORE importing the module under test
vi.mock("yahoo-finance2", () => ({
  default: {
    quote: vi.fn(),
    quoteSummary: vi.fn(),
  },
}));

// Mock supabaseAdmin so fetchStockData unit tests don't touch DB
vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import yahooFinance from "yahoo-finance2";

import { fetchStockData } from "./fetch-stock-data";

const mockedQuote = vi.mocked(yahooFinance.quote);
const mockedSummary = vi.mocked(yahooFinance.quoteSummary);

beforeEach(() => {
  mockedQuote.mockReset();
  mockedSummary.mockReset();
});

describe("fetchStockData (Phase 9, STOCK-01/02/03/05)", () => {
  it("returns null when ticker is malformed", async () => {
    // No mock setup — should return early before any yahoo call
    const res = await fetchStockData("invalid-ticker");
    expect(res).toBeNull();
    expect(mockedQuote).not.toHaveBeenCalled();
  });

  it("appends .JK suffix before calling yahoo-finance2", async () => {
    mockedQuote.mockResolvedValueOnce({
      regularMarketPrice: 9275,
      trailingPE: 12.4,
      priceToBook: 1.8,
      dividendYield: 0.032,
    } as never);
    mockedSummary.mockResolvedValueOnce({
      incomeStatementHistory: { incomeStatementHistory: [] },
    } as never);
    await fetchStockData("BBCA");
    expect(mockedQuote).toHaveBeenCalledWith("BBCA.JK");
    expect(mockedSummary).toHaveBeenCalledWith("BBCA.JK", {
      modules: ["incomeStatementHistory"],
    });
  });

  it("returns null when yahoo-finance2 throws non-rate-limit error", async () => {
    mockedQuote.mockRejectedValueOnce(new Error("network failure"));
    mockedSummary.mockRejectedValueOnce(new Error("network failure"));
    const res = await fetchStockData("BBCA");
    expect(res).toBeNull();
  });

  it("converts dividendYield fraction to percent (0.032 → 3.2)", async () => {
    mockedQuote.mockResolvedValueOnce({
      regularMarketPrice: 9275,
      trailingPE: 12.4,
      priceToBook: 1.8,
      dividendYield: 0.032,
    } as never);
    mockedSummary.mockResolvedValueOnce({
      incomeStatementHistory: { incomeStatementHistory: [] },
    } as never);
    const res = await fetchStockData("BBCA");
    expect(res?.quote.dividendYieldPct).toBe(3.2);
  });

  it("computes netMarginPct from totalRevenue + netIncome", async () => {
    mockedQuote.mockResolvedValueOnce({
      regularMarketPrice: 9000,
    } as never);
    mockedSummary.mockResolvedValueOnce({
      incomeStatementHistory: {
        incomeStatementHistory: [
          {
            endDate: new Date("2023-12-31"),
            totalRevenue: 100_000_000_000_000,
            netIncome: 18_500_000_000_000,
          },
        ],
      },
    } as never);
    const res = await fetchStockData("BBCA");
    expect(res?.history[0]?.year).toBe("2023");
    expect(res?.history[0]?.netMarginPct).toBe(18.5);
  });

  it("returns null fields when yahoo quote returns no data fields", async () => {
    mockedQuote.mockResolvedValueOnce({} as never);
    mockedSummary.mockResolvedValueOnce({
      incomeStatementHistory: { incomeStatementHistory: [] },
    } as never);
    const res = await fetchStockData("BBCA");
    expect(res?.quote.price).toBeNull();
    expect(res?.quote.pe).toBeNull();
    expect(res?.quote.pb).toBeNull();
    expect(res?.quote.dividendYieldPct).toBeNull();
    expect(res?.history).toEqual([]);
  });

  it("sorts history by year ascending", async () => {
    mockedQuote.mockResolvedValueOnce({ regularMarketPrice: 1 } as never);
    mockedSummary.mockResolvedValueOnce({
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: new Date("2023-12-31"), totalRevenue: 100, netIncome: 10 },
          { endDate: new Date("2021-12-31"), totalRevenue: 80, netIncome: 8 },
          { endDate: new Date("2022-12-31"), totalRevenue: 90, netIncome: 9 },
        ],
      },
    } as never);
    const res = await fetchStockData("BBCA");
    expect(res?.history.map((h) => h.year)).toEqual(["2021", "2022", "2023"]);
  });

  it("returns null when yahoo quote rejects with rate-limit even after retries", async () => {
    // 4 calls (1 initial + 3 retries) all reject with 429
    const err = new Error("HTTP 429 rate-limited");
    mockedQuote.mockRejectedValue(err);
    mockedSummary.mockRejectedValue(err);
    const res = await fetchStockData("BBCA");
    expect(res).toBeNull();
    // 1 initial + 3 retries = 4 attempts (quote) + 4 attempts (summary) — but each has its own withBackoff
    expect(mockedQuote.mock.calls.length).toBe(4);
  }, 10000);

  it("skips history rows with null/zero totalRevenue (no divide-by-zero)", async () => {
    mockedQuote.mockResolvedValueOnce({ regularMarketPrice: 1 } as never);
    mockedSummary.mockResolvedValueOnce({
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: new Date("2023-12-31"), totalRevenue: 0, netIncome: 10 },
          { endDate: new Date("2022-12-31"), totalRevenue: 100, netIncome: 10 },
        ],
      },
    } as never);
    const res = await fetchStockData("BBCA");
    // 2023 entry: revenue=0 → netMarginPct should be null (no div-by-zero)
    const r2023 = res?.history.find((h) => h.year === "2023");
    expect(r2023?.netMarginPct).toBeNull();
  });
});
