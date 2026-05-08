/** Side-effect `.env.local` before `@/lib/env` parses. Must stay first relative import group. */
import "./register-env";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { extractEvalClaims } from "@/lib/eval/gemini-eval-extract";
import { loadGroundTruth, loadManifest } from "@/lib/eval/load-manifest";
import type { DocumentScoreBreakdown } from "@/lib/eval/score-run";
import { aggregateScores, scoreDocument } from "@/lib/eval/score-run";

type RowStatus =
  | { id: string; kind: "ok"; breakdown: DocumentScoreBreakdown }
  | { id: string; kind: "missing_pdf" | "missing_fixture" | "not_ready"; detail: string }
  | { id: string; kind: "invalid_ready"; detail: string };

function validateReadyFixture(fixture: ReturnType<typeof loadGroundTruth>): string[] {
  const errs: string[] = [];
  if (fixture.fixtureStatus !== "ready") return errs;
  if (fixture.numericExpectations.length === 0) {
    errs.push("numericExpectations must be non-empty when fixtureStatus is ready.");
  }
  if (fixture.citationExpectations.length === 0) {
    errs.push("citationExpectations must be non-empty when fixtureStatus is ready.");
  }
  return errs;
}

async function main() {
  const evalRoot = path.resolve(process.cwd(), "eval");
  if (!existsSync(evalRoot)) {
    console.error("eval/ folder missing.");
    process.exit(1);
  }

  const minNumericPct = Number(process.env.EVAL_MIN_NUMERIC_PCT ?? "90");
  const minCitationPct = Number(process.env.EVAL_MIN_CITATION_PCT ?? "90");
  const promptVariant = process.env.EVAL_PROMPT_VARIANT === "broken" ? "broken" : "baseline";

  const manifest = loadManifest(evalRoot);

  const rowsStatus: RowStatus[] = [];

  for (const doc of manifest.documents) {
    const pdfAbs = path.resolve(evalRoot, doc.relativePdf);
    const fixtureAbs = path.resolve(evalRoot, doc.relativeGroundTruth);

    if (!existsSync(fixtureAbs)) {
      rowsStatus.push({
        id: doc.id,
        kind: "missing_fixture",
        detail: fixtureAbs,
      });
      continue;
    }

    const fixture = loadGroundTruth(fixtureAbs);
    if (fixture.documentId !== doc.id) {
      rowsStatus.push({
        id: doc.id,
        kind: "invalid_ready",
        detail: `fixture documentId (${fixture.documentId}) does not match manifest id.`,
      });
      continue;
    }

    if (fixture.fixtureStatus === "placeholder") {
      rowsStatus.push({
        id: doc.id,
        kind: "not_ready",
        detail:
          'Ground truth fixture is still "placeholder" — add PDF under eval/pdfs/ and switch fixtureStatus to "ready" once curated.',
      });
      continue;
    }

    const vErr = validateReadyFixture(fixture);
    if (vErr.length > 0) {
      rowsStatus.push({
        id: doc.id,
        kind: "invalid_ready",
        detail: vErr.join(" "),
      });
      continue;
    }

    if (!existsSync(pdfAbs)) {
      rowsStatus.push({
        id: doc.id,
        kind: "missing_pdf",
        detail: pdfAbs,
      });
      continue;
    }

    const pdfBytes = readFileSync(pdfAbs);
    const extraction = await extractEvalClaims({
      pdfBytes,
      filename: path.basename(doc.relativePdf),
      promptVariant,
    });

    const sc = scoreDocument(fixture, extraction);
    rowsStatus.push({
      id: doc.id,
      kind: "ok",
      breakdown: {
        documentId: doc.id,
        ...sc,
      },
    });
  }

  console.error("");
  console.error("Clarifin eval harness (Phase 5)");
  console.error(`Eval root: ${evalRoot}`);
  console.error(`Prompt variant: ${promptVariant}`);
  console.error(`Thresholds: numeric ≥ ${minNumericPct}% · citation ≥ ${minCitationPct}%`);
  console.error("");

  for (const r of rowsStatus) {
    if (r.kind !== "ok") {
      console.error(`✗ ${r.id}: ${r.kind} — ${r.detail}`);
      continue;
    }
    console.error(
      `✓ ${r.id}: numeric ${r.breakdown.numericHits}/${r.breakdown.numericTotal} (${r.breakdown.numericPct.toFixed(1)}%), citation ${r.breakdown.citationHits}/${r.breakdown.citationTotal} (${r.breakdown.citationPct.toFixed(1)}%)`,
    );
  }
  console.error("");

  const failures = rowsStatus.filter((r) => r.kind !== "ok");
  if (failures.length > 0) {
    console.error(
      `Eval gate blocked: ${failures.length}/${manifest.documents.length} documents missing or not curator-ready.`,
    );
    console.error("See eval/README.md and .planning/STATE.md.");
    process.exit(1);
  }

  const okRows = rowsStatus.map((r) => {
    if (r.kind !== "ok") throw new Error("unreachable");
    return r.breakdown;
  });

  const aggregate = aggregateScores(okRows, minNumericPct, minCitationPct);

  const report = {
    overallNumericPct: aggregate.overallNumericPct,
    overallCitationPct: aggregate.overallCitationPct,
    passNumeric: aggregate.passNumeric,
    passCitation: aggregate.passCitation,
    documents: aggregate.documents,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!aggregate.passNumeric || !aggregate.passCitation) {
    console.error("Eval thresholds not met.");
    process.exit(1);
  }

  console.error(
    `Gate passed ✓ (${aggregate.overallNumericPct.toFixed(1)}% numeric / ${aggregate.overallCitationPct.toFixed(1)}% citation weighted).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
