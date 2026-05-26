import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Regression guard for the removed INFRA-04 PDF cleanup.
//
// Originally embed-document-batch.ts deleted the raw PDF from Storage once
// all chunks were embedded (free-tier 1 GB optimization). That conflicted
// with the Phase 7 PDF viewer (doc-page RSC → createSignedUrl), so the
// cleanup was removed (debug session: pdf-upload-missing-storage).
//
// These tests lock in the new contract: storage.from("pdfs").remove() is
// NEVER called from runEmbedBatch, regardless of which completion path it
// takes. If a future contributor reintroduces cleanup here, the doc-page
// PDF viewer will silently break for every fresh upload — keep this guard.
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

import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";

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
            is: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
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

describe("runEmbedBatch — PDF cleanup removed (regression guard)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    removeMock.mockClear().mockResolvedValue({ error: null });
    scheduleAnalyzeMock.mockReset();
  });

  it("does NOT remove the PDF when all chunks are embedded (the path that used to delete)", async () => {
    fromMock.mockImplementation(
      buildFromMock({ id: "d1", status: "embedding", storage_path: "uploads/d1.pdf" }, 0),
    );

    await runEmbedBatch({ docId: "d1" });

    expect(removeMock).not.toHaveBeenCalled();
  });

  it("does NOT remove the PDF when null embeddings remain", async () => {
    fromMock.mockImplementation(
      buildFromMock({ id: "d2", status: "embedding", storage_path: "uploads/d2.pdf" }, 3),
    );

    await runEmbedBatch({ docId: "d2" });

    expect(removeMock).not.toHaveBeenCalled();
  });
});
