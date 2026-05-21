import { describe, it, expect } from "vitest";
import { isInvestmentAdviceQuery } from "../guardrail";

describe("isInvestmentAdviceQuery (CHAT-06)", () => {
  // 10 phrase variants — 6 EN + 4 ID (per RESEARCH.md Pitfall 5)
  const BLOCKED: ReadonlyArray<[string, string]> = [
    ["should I buy", "Should I buy this stock?"],
    ["should I sell", "Should I sell now?"],
    ["recommend", "What would you recommend for my portfolio?"],
    ["worth buying", "Is this stock worth buying?"],
    ["price target", "What's the price target on BBCA?"],
    ["accumulate", "Time to accumulate this name?"],
    ["beli saham", "Apakah saya harus beli saham ini?"],
    ["jual saham", "Sebaiknya jual saham sekarang?"],
    ["rekomendasikan", "Tolong rekomendasikan saham bagus"],
    ["layak dibeli", "Saham ini layak dibeli?"],
  ];

  for (const [label, query] of BLOCKED) {
    it(`blocks "${label}"`, () => {
      expect(isInvestmentAdviceQuery(query)).toBe(true);
    });
  }

  it("CHAT-06: passes neutral financial question (no false positive)", () => {
    expect(isInvestmentAdviceQuery("What was net income in 2023?")).toBe(false);
  });

  it("CHAT-06: respects word boundaries — 'buyer' does not match 'buy'", () => {
    expect(isInvestmentAdviceQuery("the buyer of the company")).toBe(false);
  });
});
