import { describe, it, expect } from "vitest";
import { scoreSchema, SCORE_RESPONSE_SCHEMA, type ScoreResult } from "../score-schema";

const validDim = (name: string, score = 7) => ({
  name,
  score,
  reasoning: "Stable margins.",
  snippets: [{ text: "Net profit increased 12%.", page: 47 }],
});
const validFixture = {
  overall_score: 7,
  dimensions: ["Profitability", "Balance Sheet", "Growth Trend", "Valuation Context"].map((n) =>
    validDim(n),
  ),
};

describe("scoreSchema", () => {
  it("SCORE-01: accepts valid 1-10 overall_score", () => {
    expect(() => scoreSchema.parse(validFixture)).not.toThrow();
  });
  it("SCORE-01: rejects out-of-range overall_score (0 and 11)", () => {
    expect(() => scoreSchema.parse({ ...validFixture, overall_score: 0 })).toThrow();
    expect(() => scoreSchema.parse({ ...validFixture, overall_score: 11 })).toThrow();
  });
  it("SCORE-02: rejects when dimensions.length !== 4", () => {
    expect(() =>
      scoreSchema.parse({ ...validFixture, dimensions: validFixture.dimensions.slice(0, 3) }),
    ).toThrow();
  });
  it("SCORE-02: rejects when dimensions.length > 4", () => {
    expect(() =>
      scoreSchema.parse({
        ...validFixture,
        dimensions: [...validFixture.dimensions, validDim("Extra")],
      }),
    ).toThrow();
  });
  it("SCORE-04: rejects when snippets.length > 3", () => {
    const fourSnips = Array.from({ length: 4 }, () => ({ text: "x", page: 1 }));
    const badDim = { ...validDim("Profitability"), snippets: fourSnips };
    expect(() =>
      scoreSchema.parse({
        overall_score: 7,
        dimensions: [badDim, validDim("a"), validDim("b"), validDim("c")],
      }),
    ).toThrow();
  });
  it("SCORE-04: rejects when snippets is empty array", () => {
    const badDim = { ...validDim("Profitability"), snippets: [] };
    expect(() =>
      scoreSchema.parse({
        overall_score: 7,
        dimensions: [badDim, validDim("a"), validDim("b"), validDim("c")],
      }),
    ).toThrow();
  });
  it("SCORE-04: requires snippet.page >= 1", () => {
    const badDim = { ...validDim("Profitability"), snippets: [{ text: "x", page: 0 }] };
    expect(() =>
      scoreSchema.parse({
        overall_score: 7,
        dimensions: [badDim, validDim("a"), validDim("b"), validDim("c")],
      }),
    ).toThrow();
  });
  it("SCORE-04: rejects non-integer page (page = 1.5)", () => {
    const badDim = { ...validDim("Profitability"), snippets: [{ text: "x", page: 1.5 }] };
    expect(() =>
      scoreSchema.parse({
        overall_score: 7,
        dimensions: [badDim, validDim("a"), validDim("b"), validDim("c")],
      }),
    ).toThrow();
  });
  it("SCORE-04: rejects empty snippet text", () => {
    const badDim = { ...validDim("Profitability"), snippets: [{ text: "", page: 1 }] };
    expect(() =>
      scoreSchema.parse({
        overall_score: 7,
        dimensions: [badDim, validDim("a"), validDim("b"), validDim("c")],
      }),
    ).toThrow();
  });
  it("SCORE-01: rejects decimal overall_score", () => {
    expect(() => scoreSchema.parse({ ...validFixture, overall_score: 7.5 })).toThrow();
  });
});

describe("SCORE_RESPONSE_SCHEMA", () => {
  it("SCORE-02: declares minItems: 4 and maxItems: 4 for dimensions", () => {
    expect(SCORE_RESPONSE_SCHEMA.properties.dimensions.minItems).toBe(4);
    expect(SCORE_RESPONSE_SCHEMA.properties.dimensions.maxItems).toBe(4);
  });
  it("SCORE-04: declares minItems: 1, maxItems: 3 for snippets", () => {
    const snippets = SCORE_RESPONSE_SCHEMA.properties.dimensions.items.properties.snippets;
    expect(snippets.minItems).toBe(1);
    expect(snippets.maxItems).toBe(3);
  });
  it("SCORE-01: declares minimum: 1, maximum: 10 for overall_score (integer)", () => {
    expect(SCORE_RESPONSE_SCHEMA.properties.overall_score.type).toBe("integer");
    expect(SCORE_RESPONSE_SCHEMA.properties.overall_score.minimum).toBe(1);
    expect(SCORE_RESPONSE_SCHEMA.properties.overall_score.maximum).toBe(10);
  });
});

// ScoreResult type check — structural verification at compile time
// This declaration would fail TypeScript if ScoreResult type is not exported correctly.
const _typeCheck: ScoreResult = {
  overall_score: 5,
  dimensions: ["Profitability", "Balance Sheet", "Growth Trend", "Valuation Context"].map((n) => ({
    name: n,
    score: 5,
    reasoning: "Test.",
    snippets: [{ text: "snippet", page: 1 }],
  })),
};
void _typeCheck;
