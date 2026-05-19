import { describe, it } from "vitest";

describe("SCORE_MODEL_ID", () => {
  it.todo("SCORE-01: equals 'gemini-2.5-flash' (NOT inherited from EXPLANATION_MODEL_ID)");
});

describe("buildScorePrompt", () => {
  it.todo("SCORE-03: contains no-recommendation clause listing blocked verbs");
  it.todo("SCORE-03: lists 4 dimension criteria (Profitability, Balance Sheet, Growth Trend, Valuation Context)");
  it.todo("SCORE-03 / TRANSLATE-01: with isIndonesian=true injects PSAK language note");
  it.todo("SCORE-03: instructs overall_score = mean of 4 dimension scores rounded");
});
