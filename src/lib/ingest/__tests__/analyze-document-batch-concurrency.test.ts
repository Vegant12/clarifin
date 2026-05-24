import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, generateExplanationMock, generateScoreMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  generateExplanationMock: vi.fn(),
  generateScoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ supabaseAdmin: { from: fromMock } }));
vi.mock("@/lib/explain/generate-explanation", () => ({
  generateExplanation: generateExplanationMock,
  isIndonesianDoc: vi.fn(() => false),
  uploadFresh: vi.fn(),
  waitForFileReady: vi.fn(),
}));
vi.mock("@/lib/explain/generate-score", () => ({ generateScore: generateScoreMock }));
// Defensive: mock langfuse so any transitive import does not pull the real client.
vi.mock("@/lib/langfuse", () => ({
  langfuse: {
    trace: vi.fn(() => ({ generation: vi.fn(() => ({ end: vi.fn() })), update: vi.fn() })),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  },
}));

import { runAnalyzeBatch } from "@/lib/ingest/analyze-document-batch";

function mockDocSelect(doc: Record<string, unknown> | null) {
  return {
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: doc, error: null }) }),
    }),
  };
}

function mockAnalyzingCount(count: number, error: Error | null = null) {
  return { select: () => ({ eq: () => Promise.resolve({ count, error }) }) };
}

describe("runAnalyzeBatch — concurrency cap (INFRA-03)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    generateExplanationMock.mockReset();
    generateScoreMock.mockReset();
  });

  it("returns { done: false } and does NOT call Gemini when 3 docs are already analyzing", async () => {
    fromMock
      .mockReturnValueOnce(mockDocSelect({ id: "doc-1", status: "analyzing", storage_path: "p", total_pages: 10, extraction_source: "x", gemini_file_resource_name: null, filename: "f.pdf" }))
      .mockReturnValueOnce(mockAnalyzingCount(3));

    const result = await runAnalyzeBatch({ docId: "doc-1" });

    expect(result).toEqual({ done: false });
    expect(generateExplanationMock).not.toHaveBeenCalled();
    expect(generateScoreMock).not.toHaveBeenCalled();
  });

  it("proceeds past the cap check when count is at threshold (count = 2)", async () => {
    fromMock
      .mockReturnValueOnce(mockDocSelect({ id: "doc-2", status: "analyzing", storage_path: "p", total_pages: 10, extraction_source: "x", gemini_file_resource_name: "files/abc", filename: "f.pdf" }))
      .mockReturnValueOnce(mockAnalyzingCount(2))
      .mockReturnValue({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });

    // We only assert that the cap did NOT short-circuit. Downstream behaviour
    // varies with caching; either { done: true } or a thrown error from missing
    // file resource is acceptable here — both prove the cap did not reject.
    const exec = runAnalyzeBatch({ docId: "doc-2" });
    await expect(exec.then((r) => r, () => ({ thrown: true } as const))).resolves.not.toEqual({ done: false });
  });

  it("fails open when the count query returns an error", async () => {
    fromMock
      .mockReturnValueOnce(mockDocSelect({ id: "doc-3", status: "analyzing", storage_path: "p", total_pages: 10, extraction_source: "x", gemini_file_resource_name: "files/abc", filename: "f.pdf" }))
      .mockReturnValueOnce(mockAnalyzingCount(99, new Error("supabase hiccup")))
      .mockReturnValue({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });

    const exec = runAnalyzeBatch({ docId: "doc-3" });
    // count=99 would normally trip the cap; countError truthy → fail-open
    await expect(exec.then((r) => r, () => ({ thrown: true } as const))).resolves.not.toEqual({ done: false });
  });
});
