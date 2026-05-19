import { describe, it } from "vitest";

describe("scoreSchema", () => {
  it.todo("SCORE-01: accepts valid 1-10 overall_score");
  it.todo("SCORE-01: rejects out-of-range overall_score (0 and 11)");
  it.todo("SCORE-02: rejects when dimensions.length !== 4");
  it.todo("SCORE-04: rejects when snippets.length > 3");
  it.todo("SCORE-04: requires snippet.page >= 1");
});

describe("SCORE_RESPONSE_SCHEMA", () => {
  it.todo("SCORE-02: declares minItems: 4 and maxItems: 4 for dimensions");
  it.todo("SCORE-04: declares minItems: 1, maxItems: 3 for snippets");
  it.todo("SCORE-01: declares minimum: 1, maximum: 10 for overall_score (integer)");
});

describe("scanForInvestmentAdvice", () => {
  it.todo("SCORE-05: blocks 'buy', 'sell', 'recommend' (case-insensitive)");
  it.todo("SCORE-05: returns null when no blocked term present");
});
