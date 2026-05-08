import { describe, expect, it } from "vitest";

import { parseEvalExtractionResponse } from "@/lib/eval/load-manifest";

describe("parseEvalExtractionResponse", () => {
  it("strips fenced JSON", () => {
    const body =
      '```json\n{"numericExtractions":[],"citedFacts":[{"id":"a","text":"t","citedPages":[5]}]}\n```';
    const p = parseEvalExtractionResponse(body);
    expect(p.citedFacts[0]?.citedPages).toEqual([5]);
    expect(p.numericExtractions.length).toBe(0);
  });
});
