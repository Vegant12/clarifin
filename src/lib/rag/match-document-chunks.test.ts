import { describe, expect, it, vi } from "vitest";

const { embedQueryText, rpcMock } = vi.hoisted(() => ({
  embedQueryText: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/embed/gemini-embed", () => ({
  embedQueryText,
  vectorToPgString: (v: number[]) => `[${v.join(",")}]`,
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { rpc: rpcMock },
}));

import { matchDocumentChunks } from "./match-document-chunks";

describe("match-document-chunks", () => {
  it("calls match_document_chunks with doc id, pgvector string, and bounded match count", async () => {
    const docId = "00000000-0000-4000-8000-000000000099";
    embedQueryText.mockResolvedValue(Array.from({ length: 768 }, () => 0.01));
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "c1",
          content: "snippet",
          page_number: 42,
          source_page_start: 42,
          source_page_end: 42,
          section: "Notes",
          chunk_type: "prose" as const,
          distance: 0.12,
        },
      ],
      error: null,
    });

    const rows = await matchDocumentChunks({
      docId,
      query: "What was the net income in 2023?",
      matchCount: 5,
    });

    expect(embedQueryText).toHaveBeenCalledWith("What was the net income in 2023?");
    expect(rpcMock).toHaveBeenCalledWith(
      "match_document_chunks",
      expect.objectContaining({
        p_doc_id: docId,
        p_match_count: 5,
        p_query_embedding: expect.stringMatching(/^\[[0-9.,-]+\]$/),
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.page_number).toBe(42);
  });

  it("throws when RPC fails", async () => {
    embedQueryText.mockResolvedValue(Array.from({ length: 768 }, () => 0.02));
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc boom" } });

    await expect(matchDocumentChunks({ docId: "00000000-0000-4000-8000-000000000099", query: "x" })).rejects.toThrow(
      "rpc boom",
    );
  });
});
