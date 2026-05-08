import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type EvalExtraction,
  type EvalManifest,
  extractionResultSchema,
  type GroundTruthFixture,
  groundTruthFixtureSchema,
  manifestSchema,
} from "@/lib/eval/schema";

export function loadManifest(evalRootAbsolute: string): EvalManifest {
  const raw = readFileSync(resolve(evalRootAbsolute, "manifest.json"), "utf8");
  return manifestSchema.parse(JSON.parse(raw) as unknown);
}

export function loadGroundTruth(fixturePathAbsolute: string): GroundTruthFixture {
  const raw = readFileSync(fixturePathAbsolute, "utf8");
  return groundTruthFixtureSchema.parse(JSON.parse(raw) as unknown);
}

export function parseEvalExtractionResponse(body: string): EvalExtraction {
  const trimmed = body
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return extractionResultSchema.parse(JSON.parse(trimmed) as unknown);
}
