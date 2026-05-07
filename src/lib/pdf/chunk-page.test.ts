import type { StructuredTextItem } from "unpdf";
import { describe, expect, it } from "vitest";
import { chunkSinglePage, tokenEstimate } from "./chunk-page";

function item(
  over: Partial<StructuredTextItem> & Pick<StructuredTextItem, "str" | "x" | "y" | "fontSize">,
): StructuredTextItem {
  return {
    width: 24,
    height: 10,
    fontFamily: "Helvetica",
    dir: "ltr",
    hasEOL: false,
    ...over,
  };
}

function boundaryOverlap(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  for (let n = max; n >= 0; n--) {
    if (a.slice(-n) === b.slice(0, n)) {
      return n;
    }
  }
  return 0;
}

describe("chunkSinglePage", () => {
  it("emits a single table chunk for two-column numeric rows", () => {
    const items: StructuredTextItem[] = [
      item({ str: "100", x: 50, y: 700, fontSize: 12 }),
      item({ str: "200", x: 300, y: 700, fontSize: 12 }),
      item({ str: "300", x: 50, y: 660, fontSize: 12 }),
      item({ str: "400", x: 300, y: 660, fontSize: 12 }),
    ];
    const chunks = chunkSinglePage({ pageNumber: 1, plainText: "", items });
    const tables = chunks.filter((c) => c.chunk_type === "table");
    expect(tables).toHaveLength(1);
    expect(tables[0]!.content).toBe("100\t200\n300\t400");
    for (const c of chunks) {
      expect(c.page_number).toBe(1);
      expect(c.source_page_start).toBe(1);
      expect(c.source_page_end).toBe(1);
    }
  });

  it("splits a ~2500 character paragraph into prose chunks under token ceiling", () => {
    const para = "Z".repeat(2500);
    const chunks = chunkSinglePage({ pageNumber: 3, plainText: para, items: [] });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(tokenEstimate(c.content)).toBeLessThanOrEqual(620);
    }
  });

  it("gives adjacent prose chunks sufficient character overlap when split", () => {
    const para = `${"abcdefgh".repeat(200)}\n${"ijklmnop".repeat(200)}`;
    const chunks = chunkSinglePage({ pageNumber: 4, plainText: para, items: [] });
    const prose = chunks.filter((c) => c.chunk_type === "prose");
    if (prose.length >= 2) {
      const o = boundaryOverlap(prose[0]!.content, prose[1]!.content);
      expect(o).toBeGreaterThanOrEqual(200);
    }
  });

  it("uses full plainText as one prose chunk when items are empty", () => {
    const chunks = chunkSinglePage({
      pageNumber: 5,
      plainText: "  OCR body  ",
      items: [],
    });
    expect(chunks).toEqual([
      expect.objectContaining({
        chunk_type: "prose",
        content: "OCR body",
        page_number: 5,
        source_page_start: 5,
        source_page_end: 5,
      }),
    ]);
  });
});

describe("tokenEstimate", () => {
  it("matches plan formula", () => {
    expect(tokenEstimate("")).toBe(1);
    expect(tokenEstimate("abcd")).toBe(1);
    expect(tokenEstimate("abcde")).toBe(2);
  });
});
