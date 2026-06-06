import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock yahoo-finance2 BEFORE importing the module under test
vi.mock("yahoo-finance2", () => ({
  default: {
    historical: vi.fn(),
  },
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import yahooFinance from "yahoo-finance2";

import { fetchOHLCV } from "@/lib/ta/fetch-ohlcv";

const mockedHistorical = vi.mocked(
  (yahooFinance as unknown as { historical: ReturnType<typeof vi.fn> }).historical,
);

beforeEach(() => {
  mockedHistorical.mockReset();
});

/**
 * Wave 0 RED test stubs — TA-INGEST-01 validation contract.
 * These tests are RED until Plan 03 implements fetchOHLCV.
 * The ticker-rejection test passes because the stub implements that guard.
 * All other tests will fail with "not implemented — Plan 03" until Plan 03.
 */
describe("fetchOHLCV (TA-INGEST-01)", () => {
  it("returns null when ticker is malformed (invalid-ticker)", async () => {
    // This assertion passes even in the stub — ticker guard is implemented.
    const res = await fetchOHLCV("invalid-ticker", new Date(), new Date());
    expect(res).toBeNull();
    expect(mockedHistorical).not.toHaveBeenCalled();
  });

  it("returns null when ticker contains lowercase letters (bbca)", async () => {
    const res = await fetchOHLCV("bbca", new Date(), new Date());
    expect(res).toBeNull();
    expect(mockedHistorical).not.toHaveBeenCalled();
  });

  it("appends .JK suffix before calling yahoo-finance2", async () => {
    // RED until Plan 03 — stub throws before reaching yahoo call
    mockedHistorical.mockResolvedValueOnce([] as never);
    await fetchOHLCV("BBCA", new Date(), new Date());
    expect(mockedHistorical).toHaveBeenCalledWith(
      "BBCA.JK",
      expect.any(Object),
    );
  });

  it("filters bars where high < low (invalid OHLCV — data quality)", async () => {
    // RED until Plan 03 — stub throws before filtering
    mockedHistorical.mockResolvedValueOnce([
      {
        date: new Date("2024-01-01"),
        open: 100,
        high: 90, // high < low — invalid
        low: 100,
        close: 95,
        adjClose: 95,
        volume: 1000,
      },
    ] as never);
    const res = await fetchOHLCV("BBCA", new Date(), new Date());
    expect(res).toEqual([]); // invalid bar filtered out
  });

  it("filters bars where close <= 0 (zero/negative price — data corruption)", async () => {
    // RED until Plan 03
    mockedHistorical.mockResolvedValueOnce([
      {
        date: new Date("2024-01-02"),
        open: 100,
        high: 110,
        low: 90,
        close: 0, // close <= 0 — invalid
        adjClose: 0,
        volume: 1000,
      },
    ] as never);
    const res = await fetchOHLCV("BBCA", new Date(), new Date());
    expect(res).toEqual([]);
  });

  it("filters bars where volume < 0 (negative volume — data corruption)", async () => {
    // RED until Plan 03
    mockedHistorical.mockResolvedValueOnce([
      {
        date: new Date("2024-01-03"),
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        adjClose: 105,
        volume: -1, // negative volume — invalid
      },
    ] as never);
    const res = await fetchOHLCV("BBCA", new Date(), new Date());
    expect(res).toEqual([]);
  });

  it("returns valid bars when data is clean", async () => {
    // RED until Plan 03 — stub throws before returning
    mockedHistorical.mockResolvedValueOnce([
      {
        date: new Date("2024-01-04"),
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        adjClose: 104.9,
        volume: 1000000,
      },
    ] as never);
    const res = await fetchOHLCV("BBCA", new Date(), new Date());
    expect(res).toHaveLength(1);
    expect(res?.[0]?.date).toBe("2024-01-04");
  });
});
