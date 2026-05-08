import { describe, expect, it, vi } from "vitest";

const { embedTextBatch, fromMock } = vi.hoisted(() => ({
  embedTextBatch: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/embed/gemini-embed", () => ({
  EMBEDDING_DIMENSIONS: 768,
  EMBEDDING_MODEL_ID: "gemini-embedding-001",
  EMBED_TEXTS_BATCH_SIZE: 100,
  embedQueryText: vi.fn(),
  embedTextBatch,
  vectorToPgString: (v: number[]) => `[${v.join(",")}]`,
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { MAX_EMBED_BATCH_WALL_MS, runEmbedBatch } from "./embed-document-batch";

function vec(seed: number): number[] {
  return Array.from({ length: 768 }, (_, i) => (i + seed) * 1e-5);
}

describe("embed-document-batch", () => {
  it("no-ops when document is not in embedding status", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: "d1", status: "analyzing" },
              error: null,
            }),
        }),
      }),
    }));

    const r = await runEmbedBatch({ docId: "d1" });
    expect(r).toEqual({ done: true });
    expect(embedTextBatch).not.toHaveBeenCalled();
  });

  it("embeds null chunks then sets status to analyzing", async () => {
    const docId = "00000000-0000-4000-8000-000000000001";
    const chunks = [
      { id: "00000000-0000-4000-8000-000000000011", content: "a", chunk_index: 0 },
      { id: "00000000-0000-4000-8000-000000000012", content: "b", chunk_index: 1 },
    ];

    embedTextBatch.mockResolvedValue([vec(1), vec(2)]);

    const docUpdates: unknown[] = [];
    const chunkUpdates: Array<{ chunkId: string; emb: string }> = [];

    fromMock.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: docId, status: "embedding" },
                  error: null,
                }),
            }),
          }),
          update: (payload: { status?: string }) => ({
            eq: () => {
              docUpdates.push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "chunks") {
        return {
          select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head === true && opts.count === "exact") {
              return {
                eq: () => ({
                  is: () =>
                    Promise.resolve({
                      count: 0,
                      error: null,
                    }),
                }),
              };
            }
            return {
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: chunks,
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          },
          update: (payload: { embedding: string }) => ({
            eq: (_c1: string, chunkId: string) => ({
              eq: (_c2: string, _doc: string) => {
                chunkUpdates.push({ chunkId, emb: payload.embedding });
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const r = await runEmbedBatch({ docId });
    expect(r).toEqual({ done: true });
    expect(embedTextBatch).toHaveBeenCalledWith(["a", "b"]);
    expect(chunkUpdates).toHaveLength(2);
    expect(chunkUpdates.some((x) => x.chunkId.endsWith("11"))).toBe(true);
    expect(chunkUpdates.some((x) => x.chunkId.endsWith("12"))).toBe(true);
    expect(docUpdates.some((u) => (u as { status: string }).status === "analyzing")).toBe(true);
  });

  it("exports wall clock under 60s", () => {
    expect(MAX_EMBED_BATCH_WALL_MS).toBeLessThan(60_000);
  });
});
