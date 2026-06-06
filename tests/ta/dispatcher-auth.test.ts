/**
 * Phase 13 Plan 07 — dispatcher-auth.test.ts
 * TA-INFRA-02: Assert dispatcher auth returns 401 without secret and 200 with correct secret.
 *
 * Uses vi.mock to stub all dependencies so no real DB queries or job work runs.
 * All constants used inside vi.mock factories must come from vi.hoisted() to avoid
 * "Cannot access before initialization" errors (hoisting order constraint).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before module imports.
// CORRECT_SECRET is hoisted alongside the mock fns so it is available inside
// the vi.mock("@/lib/env") factory (which is also hoisted).
// ---------------------------------------------------------------------------

const {
  CORRECT_SECRET,
  runParseBatchMock,
  runEmbedBatchMock,
  runAnalyzeBatchMock,
  runTaRefreshOhlcvMock,
  fromMock,
  timingSafeStringEqMock,
  resolveCandidateMock,
} = vi.hoisted(() => ({
  CORRECT_SECRET: "test-internal-secret-for-dispatcher-auth",
  runParseBatchMock: vi.fn().mockResolvedValue({ done: true }),
  runEmbedBatchMock: vi.fn().mockResolvedValue({ done: true }),
  runAnalyzeBatchMock: vi.fn().mockResolvedValue({ done: true }),
  runTaRefreshOhlcvMock: vi.fn().mockResolvedValue({ tickersProcessed: 0 }),
  fromMock: vi.fn(),
  timingSafeStringEqMock: vi.fn(),
  resolveCandidateMock: vi.fn(),
}));

vi.mock("@/lib/ingest/parse-document-batch", () => ({
  runParseBatch: runParseBatchMock,
}));

vi.mock("@/lib/ingest/embed-document-batch", () => ({
  runEmbedBatch: runEmbedBatchMock,
}));

vi.mock("@/lib/ingest/analyze-document-batch", () => ({
  runAnalyzeBatch: runAnalyzeBatchMock,
}));

vi.mock("@/lib/ta/jobs/refresh-ohlcv", () => ({
  runTaRefreshOhlcv: runTaRefreshOhlcvMock,
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: fromMock },
}));

// Mock internal-auth to control resolveCandidate + timingSafeStringEq independently.
vi.mock("@/lib/internal-auth", () => ({
  resolveCandidate: resolveCandidateMock,
  timingSafeStringEq: timingSafeStringEqMock,
}));

// Mock env to provide a stable INTERNAL_PARSE_SECRET.
vi.mock("@/lib/env", () => ({
  env: {
    INTERNAL_PARSE_SECRET: CORRECT_SECRET,
  },
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/internal/dispatch/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string>, authHeader?: string): Request {
  const url = new URL("http://localhost/api/internal/dispatch");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    method: "GET",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dispatch route — auth (TA-INFRA-02)", () => {
  beforeEach(() => {
    timingSafeStringEqMock.mockReset();
    resolveCandidateMock.mockReset();

    // Default fromMock: simulate no pending docs + successful keep-alive
    fromMock.mockImplementation(() => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [{ ticker: "BBCA" }], error: null }),
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        order: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }));
  });

  it("returns 401 when no secret is provided (resolveCandidate returns empty string)", async () => {
    resolveCandidateMock.mockReturnValue("");
    timingSafeStringEqMock.mockReturnValue(false);

    const res = await GET(makeRequest({ job: "daily" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized." });
  });

  it("returns 401 when wrong secret is provided via query param", async () => {
    resolveCandidateMock.mockReturnValue("wrong-secret");
    timingSafeStringEqMock.mockReturnValue(false);

    const res = await GET(makeRequest({ job: "daily", secret: "wrong-secret" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized." });
  });

  it("returns 401 when wrong Bearer header is provided", async () => {
    resolveCandidateMock.mockReturnValue("also-wrong");
    timingSafeStringEqMock.mockReturnValue(false);

    const res = await GET(makeRequest({ job: "daily" }, "Bearer also-wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 (non-401) when correct secret is provided via Bearer header", async () => {
    resolveCandidateMock.mockReturnValue(CORRECT_SECRET);
    timingSafeStringEqMock.mockReturnValue(true);

    const res = await GET(makeRequest({ job: "weekly" }, `Bearer ${CORRECT_SECRET}`));
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
  });

  it("returns 200 (non-401) when correct secret is provided via ?secret= query param", async () => {
    resolveCandidateMock.mockReturnValue(CORRECT_SECRET);
    timingSafeStringEqMock.mockReturnValue(true);

    const res = await GET(makeRequest({ job: "weekly", secret: CORRECT_SECRET }));
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
  });

  it("returns 400 for an unknown job even when authenticated", async () => {
    resolveCandidateMock.mockReturnValue(CORRECT_SECRET);
    timingSafeStringEqMock.mockReturnValue(true);

    const res = await GET(makeRequest({ job: "unknown" }));
    expect(res.status).toBe(400);
  });

  it("daily job returns { ok: true, kind: 'daily', results: [...] } on authenticated call", async () => {
    resolveCandidateMock.mockReturnValue(CORRECT_SECRET);
    timingSafeStringEqMock.mockReturnValue(true);

    const res = await GET(makeRequest({ job: "daily", secret: CORRECT_SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, kind: "daily" });
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("weekly job returns { ok: true, kind: 'weekly' } on authenticated call", async () => {
    resolveCandidateMock.mockReturnValue(CORRECT_SECRET);
    timingSafeStringEqMock.mockReturnValue(true);

    const res = await GET(makeRequest({ job: "weekly", secret: CORRECT_SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, kind: "weekly" });
  });
});
