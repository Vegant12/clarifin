import { describe, expect, it } from "vitest";

import { jargonDictionary } from "@/lib/jargon";

const JARGON_02_ENGLISH_KEYS = [
  "revenue",
  "ebitda",
  "gross margin",
  "operating margin",
  "net margin",
  "roe",
  "roa",
  "current ratio",
  "quick ratio",
  "debt-to-equity",
  "p/e",
  "p/b",
  "dividend yield",
  "free cash flow",
];

const PSAK_BAHASA_KEYS = [
  "laba bersih",
  "aset lancar",
  "ekuitas",
  "laba ditahan",
  "pendapatan komprehensif lain",
  "catatan atas laporan keuangan",
  "beban pokok penjualan",
  "arus kas dari aktivitas operasi",
];

describe("jargon-dictionary", () => {
  it("Test 1: dictionary contains at least 60 entries", () => {
    expect(Object.keys(jargonDictionary).length).toBeGreaterThanOrEqual(60);
  });

  it("Test 2: all JARGON-02 required English terms are present (lowercased)", () => {
    for (const term of JARGON_02_ENGLISH_KEYS) {
      expect(jargonDictionary).toHaveProperty(term, expect.any(String));
    }
  });

  it("Test 3: all PSAK Bahasa Indonesia terms are present", () => {
    for (const term of PSAK_BAHASA_KEYS) {
      expect(jargonDictionary).toHaveProperty(term, expect.any(String));
    }
  });

  it("Test 4: every key is lowercase (no uppercase letters)", () => {
    const uppercase = Object.keys(jargonDictionary).filter((k) => /[A-Z]/.test(k));
    expect(uppercase).toHaveLength(0);
  });

  it("Test 5: every value ends with exactly one sentence-terminating period", () => {
    for (const [key, v] of Object.entries(jargonDictionary)) {
      // Must end with a period
      expect(v.trim().endsWith("."), `"${key}": value must end with a period`).toBe(true);
      // Must have exactly one trailing dot (sentence terminator)
      const trailingDotCount = v.match(/\.(?=\s|$)/g)?.length ?? 0;
      expect(trailingDotCount, `"${key}": must have exactly 1 sentence-terminating period`).toBe(1);
    }
  });

  it("Test 6: every value is between 20 and 200 characters", () => {
    for (const [key, v] of Object.entries(jargonDictionary)) {
      expect(v.length, `"${key}": value too short (${v.length})`).toBeGreaterThanOrEqual(20);
      expect(v.length, `"${key}": value too long (${v.length})`).toBeLessThanOrEqual(200);
    }
  });

  it("Test 7: jargonDictionary exported from index is a Record<string,string> matching JSON content", () => {
    // Must be a plain object (not null, not array)
    expect(typeof jargonDictionary).toBe("object");
    expect(Array.isArray(jargonDictionary)).toBe(false);
    expect(jargonDictionary).not.toBeNull();
    // All values must be strings
    for (const [key, v] of Object.entries(jargonDictionary)) {
      expect(typeof v, `"${key}": value must be a string`).toBe("string");
    }
  });
});
