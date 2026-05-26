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

  // quick-260526-c5k: multi-page citation blocks
  it("Test 9: multi-page citation `[p.49, p.111]` yields two consecutive citation tokens", () => {
    const result = parseCitations("See [p.49, p.111] for details.");
    expect(result).toEqual([
      { kind: "text", value: "See " },
      { kind: "citation", page: 49 },
      { kind: "citation", page: 111 },
      { kind: "text", value: " for details." },
    ]);
  });

  it("Test 10: multi-page block where second page omits `p.` prefix `[p.49, 111]`", () => {
    const result = parseCitations("[p.49, 111]");
    expect(result).toEqual([
      { kind: "citation", page: 49 },
      { kind: "citation", page: 111 },
    ]);
  });

  it("Test 11: three-page citation `[p.49, 111, 123]`", () => {
    const result = parseCitations("[p.49, 111, 123]");
    expect(result).toEqual([
      { kind: "citation", page: 49 },
      { kind: "citation", page: 111 },
      { kind: "citation", page: 123 },
    ]);
  });

  it("Test 12: page range endpoints `[p.49 - p.55]` parse as both endpoints", () => {
    const result = parseCitations("[p.49 - p.55]");
    expect(result).toEqual([
      { kind: "citation", page: 49 },
      { kind: "citation", page: 55 },
    ]);
  });

  it("Test 13: `[p.0]` is dropped entirely (no tokens emitted)", () => {
    const result = parseCitations("[p.0]");
    expect(result).toEqual([]);
  });

  it("Test 14: `[p.]` (no digits) is dropped entirely", () => {
    const result = parseCitations("[p.]");
    expect(result).toEqual([]);
  });

  it("Test 15: non `p.` block `[foo]` is preserved as plain text", () => {
    const result = parseCitations("[foo]");
    expect(result).toEqual([{ kind: "text", value: "[foo]" }]);
  });

  it("Test 16: malformed citation `[p.0]` between text drops the block but keeps surrounding text", () => {
    // When a malformed block is dropped, the surrounding text slices stay
    // (they may merge into adjacent runs depending on impl; documenting actual behavior).
    const result = parseCitations("text [p.0] more");
    // The block is consumed silently; the slices "text " and " more" are emitted as two text tokens
    expect(result).toEqual([
      { kind: "text", value: "text " },
      { kind: "text", value: " more" },
    ]);
  });
});
