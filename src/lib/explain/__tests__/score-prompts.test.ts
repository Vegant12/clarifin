import { describe, it, expect } from "vitest";
import { SCORE_MODEL_ID, buildScorePrompt, scanForInvestmentAdvice } from "../score-prompts";

describe("SCORE_MODEL_ID", () => {
  it("SCORE-01: equals 'gemini-2.5-flash' (NOT inherited from EXPLANATION_MODEL_ID)", () => {
    expect(SCORE_MODEL_ID).toBe("gemini-2.5-flash");
  });
});

describe("buildScorePrompt", () => {
  it("SCORE-03: contains no-recommendation clause listing blocked verbs", () => {
    const p = buildScorePrompt(100, false);
    for (const w of [
      "buy",
      "sell",
      "invest",
      "recommend",
      "accumulate",
      "avoid",
      "underweight",
      "overweight",
    ]) {
      expect(p).toContain(w);
    }
  });
  it("SCORE-03: lists all 4 dimensions", () => {
    const p = buildScorePrompt(100, false);
    for (const d of ["Profitability", "Balance Sheet", "Growth Trend", "Valuation Context"]) {
      expect(p).toContain(d);
    }
  });
  it("SCORE-03 / TRANSLATE-01: isIndonesian=true injects PSAK language note", () => {
    expect(buildScorePrompt(100, true)).toContain("Bahasa Indonesia");
    expect(buildScorePrompt(100, false)).not.toContain("Bahasa Indonesia");
  });
  it("SCORE-03: instructs overall_score = mean of 4 dimension scores rounded", () => {
    const p = buildScorePrompt(100, false);
    expect(p).toMatch(/overall_score is the mean of the 4 dimension scores/i);
  });
  it("SCORE-03: interpolates totalPages into the prompt", () => {
    expect(buildScorePrompt(247, false)).toContain("247 pages");
  });
  it("SCORE-03: mentions 'mean' and 'rounded' for overall_score computation", () => {
    const p = buildScorePrompt(100, false);
    expect(p).toContain("mean");
    expect(p).toContain("rounded");
  });
});

describe("scanForInvestmentAdvice", () => {
  it("SCORE-05: blocks 'buy' (returns matched term)", () => {
    expect(scanForInvestmentAdvice("This stock is a buy.")).toBe("buy");
  });
  it("SCORE-05: blocks 'sell' case-insensitively (original casing returned)", () => {
    expect(scanForInvestmentAdvice("You should SELL immediately.")).toBe("SELL");
  });
  it("SCORE-05: blocks 'recommend'", () => {
    expect(scanForInvestmentAdvice("we recommend caution")).toBe("recommend");
  });
  it("SCORE-05: blocks 'accumulate'", () => {
    expect(scanForInvestmentAdvice("investors should accumulate shares")).toBe("accumulate");
  });
  it("SCORE-05: returns null when no blocked term present", () => {
    expect(scanForInvestmentAdvice("Net margin declined; revenue grew 12% YoY.")).toBeNull();
  });
  it("SCORE-05: respects word boundaries — 'buyer' does not match 'buy'", () => {
    expect(scanForInvestmentAdvice("the buyer of the company")).toBeNull();
  });
  it("SCORE-05: respects word boundaries — 'seller' does not match 'sell'", () => {
    expect(scanForInvestmentAdvice("the seller reported losses")).toBeNull();
  });
});
