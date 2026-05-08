import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ingest/embed-document-batch", () => ({
  runEmbedBatch: vi.fn(),
}));

vi.mock("@/lib/ingest/trigger-parse-batch", () => ({
  scheduleEmbedBatchesForDoc: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { GET } from "./route";

describe("embed-batch route", () => {
  it("returns 401 without shared secret", async () => {
    const res = await GET(
      new Request("http://localhost/api/internal/embed-batch", { method: "GET" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized." });
  });
});
