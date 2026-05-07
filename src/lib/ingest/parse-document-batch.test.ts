import { describe, expect, it } from "vitest";
import { MAX_BATCH_WALL_MS, MAX_PAGES_PER_BATCH } from "./parse-document-batch";

describe("parse-document-batch", () => {
  it("uses batch caps from Phase 3 plan (Hobby wall time + page budget)", () => {
    expect(MAX_PAGES_PER_BATCH).toBe(8);
    expect(MAX_BATCH_WALL_MS).toBe(45_000);
  });
});
