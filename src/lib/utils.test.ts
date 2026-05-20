import { describe, expect, it } from "vitest";

import { formatIDR, formatIDRShort } from "@/lib/utils";

describe("formatIDR", () => {
  it("formats triliun: 85_000_000_000_000 → 'Rp 85.00 triliun'", () => {
    expect(formatIDR(85_000_000_000_000)).toBe("Rp 85.00 triliun");
  });

  it("formats miliar: 1_250_000_000 → 'Rp 1.25 miliar'", () => {
    expect(formatIDR(1_250_000_000)).toBe("Rp 1.25 miliar");
  });

  it("formats juta: 500_000_000 → 'Rp 500.00 juta'", () => {
    expect(formatIDR(500_000_000)).toBe("Rp 500.00 juta");
  });

  it("formats small amount using id-ID locale: 9275 → 'Rp 9.275'", () => {
    // id-ID locale uses '.' as thousand separator
    expect(formatIDR(9275)).toBe("Rp 9.275");
  });

  it("formats zero: 0 → 'Rp 0'", () => {
    expect(formatIDR(0)).toBe("Rp 0");
  });

  it("formats negative miliar: -1_000_000_000 → '-Rp 1.00 miliar'", () => {
    expect(formatIDR(-1_000_000_000)).toBe("-Rp 1.00 miliar");
  });
});

describe("formatIDRShort", () => {
  it("formats triliun short: 85_000_000_000_000 → 'Rp 85T'", () => {
    expect(formatIDRShort(85_000_000_000_000)).toBe("Rp 85T");
  });

  it("formats miliar short: 1_250_000_000 → 'Rp 1M'", () => {
    // M = miliar per UI-SPEC axis abbreviation
    expect(formatIDRShort(1_250_000_000)).toBe("Rp 1M");
  });

  it("formats juta short: 500_000_000 → 'Rp 500Jt'", () => {
    expect(formatIDRShort(500_000_000)).toBe("Rp 500Jt");
  });

  it("formats small amount using id-ID locale: 9275 → 'Rp 9.275'", () => {
    expect(formatIDRShort(9275)).toBe("Rp 9.275");
  });
});
