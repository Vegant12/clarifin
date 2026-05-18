import { describe, expect, it } from "vitest";

import { parseCitations } from "@/lib/citations/parse-citations";

describe("parseCitations", () => {
  it("Test 1: returns a single text token for plain text with no citations", () => {
    const result = parseCitations("plain text");
    expect(result).toEqual([{ kind: "text", value: "plain text" }]);
  });

  it("Test 2: splits text + citation + text correctly", () => {
    const result = parseCitations("Revenue grew 18% [p.12] last year.");
    expect(result).toEqual([
      { kind: "text", value: "Revenue grew 18% " },
      { kind: "citation", page: 12 },
      { kind: "text", value: " last year." },
    ]);
  });

  it("Test 3: handles citations at both string boundaries (no empty text tokens)", () => {
    const result = parseCitations("[p.1] starts and ends [p.99]");
    expect(result).toEqual([
      { kind: "citation", page: 1 },
      { kind: "text", value: " starts and ends " },
      { kind: "citation", page: 99 },
    ]);
    // No empty string text tokens
    for (const tok of result) {
      if (tok.kind === "text") {
        expect(tok.value.length).toBeGreaterThan(0);
      }
    }
  });

  it("Test 4: multiple citations produce 5 tokens: text, citation(1), text, citation(2), text", () => {
    const result = parseCitations("a [p.1] b [p.2] c");
    expect(result).toEqual([
      { kind: "text", value: "a " },
      { kind: "citation", page: 1 },
      { kind: "text", value: " b " },
      { kind: "citation", page: 2 },
      { kind: "text", value: " c" },
    ]);
    expect(result).toHaveLength(5);
  });

  it("Test 5: adjacent citations produce two citation tokens with no empty text between", () => {
    const result = parseCitations("[p.1][p.2]");
    expect(result).toEqual([
      { kind: "citation", page: 1 },
      { kind: "citation", page: 2 },
    ]);
    expect(result).toHaveLength(2);
  });

  it("Test 6: non-matching brackets preserved as text (no false-positive citation)", () => {
    const result = parseCitations("see [page 1] for details");
    expect(result).toEqual([{ kind: "text", value: "see [page 1] for details" }]);
  });

  it("Test 7: multi-digit page numbers are parsed correctly", () => {
    const result = parseCitations("[p.123]");
    expect(result).toEqual([{ kind: "citation", page: 123 }]);
  });

  it("Test 8: returns empty array for empty input", () => {
    const result = parseCitations("");
    expect(result).toEqual([]);
  });
});
