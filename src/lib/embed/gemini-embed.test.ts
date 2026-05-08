import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  embedQueryText,
  embedTextBatch,
} from "@/lib/embed/gemini-embed";

function mockVec(seed: number): number[] {
  const v: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    v.push((((seed + i) * 9301 + 49297) % 233280) / 233280);
  }
  return v;
}

describe("gemini-embed", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns [] for empty input without calling fetch", async () => {
    const r = await embedTextBatch([]);
    expect(r).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns two 768-d vectors for two texts", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [{ values: mockVec(1) }, { values: mockVec(2) }],
      }),
    });

    const r = await embedTextBatch(["a", "b"]);
    expect(r).toHaveLength(2);
    expect(r[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(r[1]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429 then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "rate" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [{ values: mockVec(3) }],
        }),
      });

    const r = await embedTextBatch(["x"]);
    expect(r).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("embedQueryText returns single vector", async () => {
    const vec = mockVec(9);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [{ values: vec }],
      }),
    });

    const r = await embedQueryText("question");
    expect(r).toEqual(vec);
  });
});
