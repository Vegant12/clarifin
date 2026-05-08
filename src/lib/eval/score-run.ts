import type { EvalExtraction, GroundTruthFixture } from "@/lib/eval/schema";

export type DocumentScoreBreakdown = {
  documentId: string;
  numericHits: number;
  numericTotal: number;
  numericPct: number;
  citationHits: number;
  citationTotal: number;
  citationPct: number;
};

function withinTolerance(observed: number, expected: number, tolerancePct: number): boolean {
  if (!Number.isFinite(observed) || !Number.isFinite(expected)) return false;
  if (expected === 0) return observed === 0;
  const rel = Math.abs(observed - expected) / Math.abs(expected);
  return rel <= tolerancePct / 100;
}

/**
 * Numeric + citation correctness for one document extraction vs curator ground truth.
 */
export function scoreDocument(
  truth: GroundTruthFixture,
  extraction: EvalExtraction,
): Omit<DocumentScoreBreakdown, "documentId"> {
  let numericHits = 0;
  const numericTotal = truth.numericExpectations.length;
  for (const row of truth.numericExpectations) {
    const hit = extraction.numericExtractions.find((n) => n.key === row.key);
    if (hit && withinTolerance(hit.valueIDR, row.valueIDR, row.tolerancePct)) {
      numericHits += 1;
    }
  }

  let citationHits = 0;
  const citationTotal = truth.citationExpectations.length;
  const allowed = (pages: number[]) => new Set(pages);
  for (const cite of truth.citationExpectations) {
    const fact = extraction.citedFacts.find((f) => f.id === cite.id);
    const allowSet = allowed(cite.allowedPages);
    if (fact?.citedPages.some((p) => allowSet.has(p))) citationHits += 1;
  }

  const numericPct = numericTotal === 0 ? 100 : (numericHits / numericTotal) * 100;
  const citationPct = citationTotal === 0 ? 100 : (citationHits / citationTotal) * 100;

  return {
    numericHits,
    numericTotal,
    numericPct,
    citationHits,
    citationTotal,
    citationPct,
  };
}

export type AggregateEvalScore = {
  documents: DocumentScoreBreakdown[];
  overallNumericPct: number;
  overallCitationPct: number;
  passNumeric: boolean;
  passCitation: boolean;
};

export function aggregateScores(
  rows: DocumentScoreBreakdown[],
  minNumericPct: number,
  minCitationPct: number,
): AggregateEvalScore {
  const numWeight = rows.reduce((a, r) => a + r.numericTotal, 0);
  const citWeight = rows.reduce((a, r) => a + r.citationTotal, 0);
  const numSum = rows.reduce((a, r) => a + r.numericHits, 0);
  const citSum = rows.reduce((a, r) => a + r.citationHits, 0);
  const overallNumericPct = numWeight === 0 ? 100 : (numSum / numWeight) * 100;
  const overallCitationPct = citWeight === 0 ? 100 : (citSum / citWeight) * 100;
  return {
    documents: rows,
    overallNumericPct,
    overallCitationPct,
    passNumeric: overallNumericPct >= minNumericPct,
    passCitation: overallCitationPct >= minCitationPct,
  };
}
