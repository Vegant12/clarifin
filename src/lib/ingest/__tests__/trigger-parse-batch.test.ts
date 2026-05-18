import { describe, expect, it, vi } from "vitest";

/**
 * Tests for trigger-parse-batch.ts module exports.
 * scheduleAnalyzeBatchForDoc (Phase 6 Plan 04).
 */

// after() is no-op in test — functions should return early when NODE_ENV === "test"
vi.mock("next/server", () => ({
  after: vi.fn(),
}));

describe("trigger-parse-batch — scheduleAnalyzeBatchForDoc", () => {
  it("exports scheduleAnalyzeBatchForDoc as a function", async () => {
    const mod = await import("@/lib/ingest/trigger-parse-batch");
    expect(typeof mod.scheduleAnalyzeBatchForDoc).toBe("function");
  });

  it("returns void immediately in test environment (NODE_ENV guard)", async () => {
    const mod = await import("@/lib/ingest/trigger-parse-batch");
    // In test env (NODE_ENV === "test"), after() is never invoked — function returns void.
    const result = mod.scheduleAnalyzeBatchForDoc("00000000-0000-4000-8000-000000000001");
    expect(result).toBeUndefined();
  });

  it("does not call after() in test environment", async () => {
    const { after } = await import("next/server");
    const afterMock = after as ReturnType<typeof vi.fn>;
    afterMock.mockClear();

    const mod = await import("@/lib/ingest/trigger-parse-batch");
    mod.scheduleAnalyzeBatchForDoc("00000000-0000-4000-8000-000000000002");

    expect(afterMock).not.toHaveBeenCalled();
  });

  it("existing scheduleEmbedBatchesForDoc is still exported", async () => {
    const mod = await import("@/lib/ingest/trigger-parse-batch");
    expect(typeof mod.scheduleEmbedBatchesForDoc).toBe("function");
  });

  it("existing scheduleParseBatchesForDoc is still exported", async () => {
    const mod = await import("@/lib/ingest/trigger-parse-batch");
    expect(typeof mod.scheduleParseBatchesForDoc).toBe("function");
  });
});
