import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { fromMock, storageMock, generateExplanationMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageMock: vi.fn(),
  generateExplanationMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: fromMock,
    storage: { from: storageMock },
  },
}));

vi.mock("@/lib/explain/generate-explanation", () => ({
  generateExplanation: generateExplanationMock,
}));

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { MAX_ANALYZE_BATCH_WALL_MS, runAnalyzeBatch } from "../analyze-document-batch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_ID = "00000000-0000-4000-8000-000000000001";

const VALID_EXPLANATION = {
  revenue: "Revenue grew 12% [p.5]",
  profitability: "Net income margin 8% [p.7]",
  balance_sheet: "Debt-to-equity 0.4 [p.9]",
  cash_flow: "Operating cash flow positive [p.11]",
  key_risks: "Commodity price risk [p.14]",
};

/** Creates a chainable Supabase query mock that resolves with `data` and no error. */
function makeQueryChain(data: unknown, error: null | object = null) {
  const resolve = () => Promise.resolve({ data, error, count: null });
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order", "limit", "maybeSingle", "update", "upsert", "delete"];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  chain["maybeSingle"] = resolve;
  chain["then"] = (res: (v: unknown) => unknown) => Promise.resolve({ data, error, count: null }).then(res);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyze-document-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // (a) Doc not found
  it("returns { done: false } when document is not found", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }));

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: false });
    expect(generateExplanationMock).not.toHaveBeenCalled();
  });

  // (b) status === "ready" — skip
  it("returns { done: true } and skips generation when doc.status is ready", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: DOC_ID,
                status: "ready",
                storage_path: "pdfs/doc.pdf",
                total_pages: 50,
                extraction_source: "unpdf",
                gemini_file_resource_name: null,
                filename: "report.pdf",
              },
              error: null,
            }),
        }),
      }),
    }));

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: true });
    expect(generateExplanationMock).not.toHaveBeenCalled();
  });

  // (c) status !== "analyzing" — wrong state gate
  it("returns { done: true } and skips generation when doc.status is embedding (wrong state)", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: DOC_ID,
                status: "embedding",
                storage_path: "pdfs/doc.pdf",
                total_pages: 50,
                extraction_source: "unpdf",
                gemini_file_resource_name: null,
                filename: "report.pdf",
              },
              error: null,
            }),
        }),
      }),
    }));

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: true });
    expect(generateExplanationMock).not.toHaveBeenCalled();
  });

  // (d) CACHE HIT — explanation already in document_analysis
  it("returns { done: true } on cache hit and skips generation (EXPLAIN-04)", async () => {
    let callCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "documents") {
        callCount++;
        if (callCount === 1) {
          // First call: read document row
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: DOC_ID,
                      status: "analyzing",
                      storage_path: "pdfs/doc.pdf",
                      total_pages: 50,
                      extraction_source: "unpdf",
                      gemini_file_resource_name: null,
                      filename: "report.pdf",
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (callCount === 2) {
          // Second call: INFRA-03 concurrency count query (count: "exact", head: true)
          return {
            select: () => ({
              eq: () => Promise.resolve({ count: 1, error: null }),
            }),
          };
        }
        // Subsequent calls: status update
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === "document_analysis") {
        // Cache hit — explanation is not null
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { explanation: VALID_EXPLANATION },
                  error: null,
                }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: true });
    expect(generateExplanationMock).not.toHaveBeenCalled();
  });

  // (e) HAPPY PATH — calls generateExplanation, upserts result, sets status ready
  it("calls generateExplanation, upserts explanation object, sets status to ready", async () => {
    generateExplanationMock.mockResolvedValue({
      result: VALID_EXPLANATION,
      fileResourceName: "files/abc123",
    });

    const docUpdates: unknown[] = [];
    const analysisUpserts: unknown[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: DOC_ID,
                    status: "analyzing",
                    storage_path: "pdfs/doc.pdf",
                    total_pages: 50,
                    extraction_source: "unpdf",
                    gemini_file_resource_name: null,
                    filename: "report.pdf",
                  },
                  error: null,
                }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: () => {
              docUpdates.push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "document_analysis") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { explanation: null }, error: null }),
            }),
          }),
          upsert: (payload: unknown) => {
            analysisUpserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "chunks") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: { content: "laporan keuangan tahunan" }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    storageMock.mockReturnValue({
      download: () =>
        Promise.resolve({
          data: new Blob([new Uint8Array([1, 2, 3])]),
          error: null,
        }),
    });

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: true });
    expect(generateExplanationMock).toHaveBeenCalledTimes(1);

    // Upsert should pass the plain JS object (not stringified)
    expect(analysisUpserts).toHaveLength(1);
    const upserted = analysisUpserts[0] as { doc_id: string; explanation: unknown; explanation_at: string };
    expect(upserted.doc_id).toBe(DOC_ID);
    expect(upserted.explanation).toEqual(VALID_EXPLANATION);
    expect(typeof upserted.explanation_at).toBe("string");

    // Status must transition to "ready"
    expect(docUpdates.some((u) => (u as { status: string }).status === "ready")).toBe(true);
  });

  // (f) 429 RETRY — status stays "analyzing", error_message set, done: false
  it("sets error_message but leaves status analyzing on 429 error (retry-friendly)", async () => {
    generateExplanationMock.mockRejectedValue(new Error("429 Too Many Requests — rate limit exceeded"));

    const docUpdates: unknown[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: DOC_ID,
                    status: "analyzing",
                    storage_path: "pdfs/doc.pdf",
                    total_pages: 50,
                    extraction_source: "unpdf",
                    gemini_file_resource_name: null,
                    filename: "report.pdf",
                  },
                  error: null,
                }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: () => {
              docUpdates.push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "document_analysis") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { explanation: null }, error: null }),
            }),
          }),
        };
      }
      if (table === "chunks") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    storageMock.mockReturnValue({
      download: () =>
        Promise.resolve({
          data: new Blob([new Uint8Array([1, 2, 3])]),
          error: null,
        }),
    });

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: false });

    // Must NOT have set status: "failed"
    expect(docUpdates.every((u) => (u as { status?: string }).status !== "failed")).toBe(true);
    // Must have set error_message
    expect(docUpdates.some((u) => typeof (u as { error_message?: string }).error_message === "string")).toBe(true);
  });

  // (g) PERMANENT FAIL — status becomes "failed", failed_at is set
  it("sets status to failed with failed_at on permanent Gemini error", async () => {
    generateExplanationMock.mockRejectedValue(new Error("Invalid API key"));

    const docUpdates: unknown[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: DOC_ID,
                    status: "analyzing",
                    storage_path: "pdfs/doc.pdf",
                    total_pages: 50,
                    extraction_source: "unpdf",
                    gemini_file_resource_name: null,
                    filename: "report.pdf",
                  },
                  error: null,
                }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: () => {
              docUpdates.push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "document_analysis") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { explanation: null }, error: null }),
            }),
          }),
        };
      }
      if (table === "chunks") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    storageMock.mockReturnValue({
      download: () =>
        Promise.resolve({
          data: new Blob([new Uint8Array([1, 2, 3])]),
          error: null,
        }),
    });

    const result = await runAnalyzeBatch({ docId: DOC_ID });
    expect(result).toEqual({ done: false });

    // Must have set status: "failed"
    expect(docUpdates.some((u) => (u as { status?: string }).status === "failed")).toBe(true);
    // Must have set failed_at
    expect(docUpdates.some((u) => typeof (u as { failed_at?: string }).failed_at === "string")).toBe(true);
  });

  // Exports check
  it("exports MAX_ANALYZE_BATCH_WALL_MS as a number > 60s", () => {
    expect(typeof MAX_ANALYZE_BATCH_WALL_MS).toBe("number");
    expect(MAX_ANALYZE_BATCH_WALL_MS).toBeGreaterThan(60_000);
  });
});
