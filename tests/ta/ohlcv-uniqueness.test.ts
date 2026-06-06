import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabaseAdmin before importing the module under test
vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from "@/db/client";
import { upsertOHLCV } from "@/lib/ta/upsert-ohlcv";
import type { OHLCVBar } from "@/lib/ta/ohlcv-schema";

const mockFrom = vi.mocked(supabaseAdmin.from);

/**
 * Wave 0 RED test stubs — UNIQUE(ticker, date) contract (TA-INGEST-01, PITFALLS.md P2).
 * Documents that upsertOHLCV MUST call supabase upsert with onConflict:"ticker,date".
 * Without this, concurrent cron runs create duplicate rows.
 *
 * These tests are RED until Plan 03 implements upsertOHLCV.
 */
describe("upsertOHLCV — UNIQUE(ticker, date) contract", () => {
  const sampleBars: OHLCVBar[] = [
    {
      date: "2024-01-04",
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      adjClose: 104.9,
      volume: 1000000,
    },
    {
      date: "2024-01-05",
      open: 105,
      high: 115,
      low: 95,
      close: 110,
      adjClose: 109.8,
      volume: 1200000,
    },
  ];

  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("calls supabase upsert with onConflict:'ticker,date' (CRITICAL — prevents duplicates)", async () => {
    // RED until Plan 03 — stub throws before calling supabase
    const mockUpsert = vi.fn().mockResolvedValueOnce({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert } as never);

    await upsertOHLCV("BBCA", sampleBars);

    expect(mockFrom).toHaveBeenCalledWith("ohlcv_cache");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: "ticker,date" }),
    );
  });

  it("does nothing when bars array is empty (no unnecessary DB calls)", async () => {
    // RED until Plan 03 — stub throws regardless of input
    await upsertOHLCV("BBCA", []);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("maps adjClose to adj_close column in the upserted rows", async () => {
    // RED until Plan 03 — documents the column name mapping contract
    const mockUpsert = vi.fn().mockResolvedValueOnce({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert } as never);

    await upsertOHLCV("BBCA", sampleBars);

    const upsertedRows = mockUpsert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(upsertedRows?.[0]).toMatchObject({
      ticker: "BBCA",
      date: "2024-01-04",
      adj_close: 104.9, // adjClose mapped to adj_close (snake_case DB column)
    });
  });
});
