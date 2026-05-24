import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { fromMock, removeMock, scheduleAnalyzeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  removeMock: vi.fn().mockResolvedValue({ error: null }),
  scheduleAnalyzeMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: fromMock,
    storage: { from: vi.fn(() => ({ remove: removeMock })) },
  },
}));
vi.mock("@/lib/ingest/trigger-parse-batch", () => ({
  scheduleAnalyzeBatchForDoc: scheduleAnalyzeMock,
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a from() mock that handles the three query shapes in runEmbedBatch:
 *  1. documents.select("id, status, storage_path") → returns the doc row
 *  2. chunks.select("id, content, chunk_index").is("embedding", null) → returns empty rows (no work to do)
 *  3. chunks.select("id", {count:"exact",head:true}).is("embedding", null) → returns count
 *
 * `nullEmbeddingCount` controls what countNullEmbeddings returns.
 */
function buildFromMock(
  doc: { id: string; status: string; storage_path: string | null },
  nullEmbeddingCount: number,
) {
  return (table: string) => {
    if (table === "documents") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: doc, error: null }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    if (table === "chunks") {
      return {
        select: () => ({
          eq: () => ({
            // chunk rows query: .is("embedding", null).order(...).limit(...)
            is: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
              // countNullEmbeddings: .is("embedding", null) resolves directly
              then: (res: (v: unknown) => unknown) =>
                Promise.resolve({ count: nullEmbeddingCount, error: null }).then(res),
            }),
          }),
        }),
      };
    }
    return {};
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runEmbedBatch — PDF cleanup (INFRA-04)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    removeMock.mockClear().mockResolvedValue({ error: null });
    scheduleAnalyzeMock.mockReset();
  });

  it("removes the PDF when all chunks have embeddings (remaining === 0, branch 1)", async () => {
    fromMock.mockImplementation(
      buildFromMock({ id: "d1", status: "embedding", storage_path: "uploads/d1.pdf" }, 0),
    );

    await runEmbedBatch({ docId: "d1" });

    expect(removeMock).toHaveBeenCalledWith(["uploads/d1.pdf"]);
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT remove the PDF when null embeddings remain (partial failure path)", async () => {
    fromMock.mockImplementation(
      buildFromMock({ id: "d2", status: "embedding", storage_path: "uploads/d2.pdf" }, 3),
    );

    await runEmbedBatch({ docId: "d2" });

    expect(removeMock).not.toHaveBeenCalled();
  });

  it("does NOT abort the pipeline when Storage remove fails", async () => {
    fromMock.mockImplementation(
      buildFromMock({ id: "d3", status: "embedding", storage_path: "uploads/d3.pdf" }, 0),
    );
    removeMock.mockRejectedValueOnce(new Error("storage 503"));

    const result = await runEmbedBatch({ docId: "d3" });
    expect(result).toEqual({ done: true });
  });
});
