import { describe, expect, it } from "vitest";

import { detectTicker, IDX_TICKER_BLOCKLIST } from "./detect-ticker";

describe("detectTicker (Phase 9, TICKER-01)", () => {
  it("returns BBCA from text containing 'Kode Efek: BBCA'", () => {
    expect(detectTicker(["Laporan Tahunan\nKode Efek: BBCA\nPT Bank Central Asia"])).toBe("BBCA");
  });

  it("returns TLKM from text containing 'BEI: TLKM'", () => {
    expect(detectTicker(["Cover Page", "BEI: TLKM\nPT Telkom Indonesia"])).toBe("TLKM");
  });

  it("returns GOTO from text containing 'IDX: GOTO'", () => {
    expect(detectTicker(["IDX: GOTO\nPT GoTo Gojek Tokopedia"])).toBe("GOTO");
  });

  it("returns ASII from text containing 'Kode saham: ASII'", () => {
    expect(detectTicker(["Kode saham: ASII"])).toBe("ASII");
  });

  it("returns BBRI from text containing 'Kode Emiten: BBRI'", () => {
    expect(detectTicker(["Kode Emiten: BBRI"])).toBe("BBRI");
  });

  it("returns BBCA from 'PT Bank Central Asia BBCA Tbk' (XXXX + Tbk proximity)", () => {
    expect(detectTicker(["PT Bank Central Asia BBCA Tbk"])).toBe("BBCA");
  });

  it("returns null when no ticker pattern is present", () => {
    expect(detectTicker(["plain text without any IDX markers"])).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectTicker([])).toBeNull();
  });

  it("returns null for IFRS (blocklist)", () => {
    // IFRS appears without context anchor; pattern 2 requires + Tbk, which isn't present
    expect(detectTicker(["IFRS standards are applied across this report"])).toBeNull();
  });

  it("returns null when blocklist word matches a context-anchored pattern", () => {
    // Even with 'Kode Efek: BANK', BANK is in the blocklist
    expect(detectTicker(["Kode Efek: BANK"])).toBeNull();
  });

  it("only scans the first 5 pages — ignores page-6 match", () => {
    expect(
      detectTicker(["a", "b", "c", "d", "e", "Kode Efek: BBCA"]),
    ).toBeNull();
  });

  it("scans page 5 (zero-indexed page 4) inclusively", () => {
    expect(detectTicker(["a", "b", "c", "d", "Kode Efek: BBCA"])).toBe("BBCA");
  });

  it("is case-insensitive on prefix; returns uppercased ticker", () => {
    expect(detectTicker(["kode efek: bbca"])).toBe("BBCA");
  });

  it("skips non-string entries safely", () => {
    expect(
      detectTicker([null as unknown as string, "Kode Efek: TLKM"]),
    ).toBe("TLKM");
  });

  it("returns null on internal exception (defensive try/catch)", () => {
    // Force a throw: pass a non-array — typescript prevents this at compile time but
    // runtime defensive behavior should still return null
    expect(detectTicker(null as unknown as string[])).toBeNull();
  });

  it("blocklist exports common false-positive abbreviations", () => {
    expect(IDX_TICKER_BLOCKLIST.has("PSAK")).toBe(true);
    expect(IDX_TICKER_BLOCKLIST.has("IFRS")).toBe(true);
    expect(IDX_TICKER_BLOCKLIST.has("GAAP")).toBe(true);
  });
});
