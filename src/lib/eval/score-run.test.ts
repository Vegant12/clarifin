import { describe, expect, it } from "vitest";

import type { EvalExtraction, GroundTruthFixture } from "@/lib/eval/schema";
import { aggregateScores, scoreDocument } from "@/lib/eval/score-run";

describe("scoreDocument", () => {
  const truth: GroundTruthFixture = {
    documentId: "test-doc",
    fixtureStatus: "ready",
    numericExpectations: [
      { key: "net_income", valueIDR: 1_000_000_000_000, tolerancePct: 5 },
      { key: "revenue", valueIDR: 5_000_000_000_000, tolerancePct: 2 },
    ],
    citationExpectations: [
      { id: "revenue_note", allowedPages: [42, 43] },
      { id: "profit_note", allowedPages: [100] },
    ],
  };

  it("scores perfect extraction at 100% / 100%", () => {
    const extraction: EvalExtraction = {
      numericExtractions: [
        { key: "net_income", valueIDR: 1_010_000_000_000, sourcePage: 99 },
        { key: "revenue", valueIDR: 5_060_000_000_000, sourcePage: 42 },
      ],
      citedFacts: [
        { id: "revenue_note", text: "Revenue...", citedPages: [42] },
        { id: "profit_note", text: "Net income...", citedPages: [100] },
      ],
    };
    const s = scoreDocument(truth, extraction);
    expect(s.numericPct).toBe(100);
    expect(s.citationPct).toBe(100);
  });

  it("counts missing mismatched citations", () => {
    const extraction: EvalExtraction = {
      numericExtractions: [
        { key: "net_income", valueIDR: 789, sourcePage: 1 },
        { key: "revenue", valueIDR: 1, sourcePage: 1 },
      ],
      citedFacts: [
        { id: "revenue_note", text: "oops", citedPages: [424242] },
        { id: "profit_note", text: "nope", citedPages: [1] },
      ],
    };
    const s = scoreDocument(truth, extraction);
    expect(s.numericHits).toBe(0);
    expect(s.numericPct).toBe(0);
    expect(s.citationHits).toBe(0);
    expect(s.citationPct).toBe(0);
  });
});

describe("aggregateScores gate", () => {
  const row = {
    documentId: "doc-a",
    numericHits: 8,
    numericTotal: 10,
    citationHits: 8,
    citationTotal: 10,
    numericPct: 80,
    citationPct: 80,
  };
  const row2 = {
    documentId: "doc-b",
    numericHits: 10,
    numericTotal: 10,
    citationHits: 10,
    citationTotal: 10,
    numericPct: 100,
    citationPct: 100,
  };

  it("applies weighted overall percentages", () => {
    const agg = aggregateScores([row, row2], 91, 91);
    expect(agg.overallNumericPct).toBeCloseTo(((8 + 10) / 20) * 100);
    expect(agg.overallCitationPct).toBeCloseTo(((8 + 10) / 20) * 100);
    expect(agg.passNumeric).toBe(false);
    expect(agg.passCitation).toBe(false);

    const aggPassLine = aggregateScores([row, row2], 90, 90);
    expect(aggPassLine.passNumeric).toBe(true);
    expect(aggPassLine.passCitation).toBe(true);

    const agg2 = aggregateScores([row2], 90, 90);
    expect(agg2.passNumeric).toBe(true);
    expect(agg2.passCitation).toBe(true);
  });
});
