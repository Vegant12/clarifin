import { describe, it } from "vitest";

// import { detectTicker } from "./detect-ticker"; // Plan 02 creates this module

describe("detectTicker (Phase 9, TICKER-01)", () => {
  it.todo("returns BBCA from text containing 'Kode Efek: BBCA'");
  it.todo("returns BBCA from text containing 'BEI: BBCA'");
  it.todo("returns TLKM from text containing 'PT Telkom Indonesia TLKM Tbk'");
  it.todo("returns null when no IDX ticker pattern is present");
  it.todo("does NOT return PSAK/IFRS/GAAP (false-positive blocklist)");
  it.todo("only scans first 5 pages — ignores ticker patterns on page 6+");
});
