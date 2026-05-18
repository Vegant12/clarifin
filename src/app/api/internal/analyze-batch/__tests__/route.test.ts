import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

const { runAnalyzeBatch, fromMock } = vi.hoisted(() => ({
  runAnalyzeBatch: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/ingest/analyze-document-batch", () => ({
  runAnalyzeBatch,
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: fromMock },
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks are in place
// ---------------------------------------------------------------------------

import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORRECT_SECRET = process.env.INTERNAL_PARSE_SECRET ?? "01234567890123456789012345678901";
const VALID_DOC_ID = "00000000-0000-4000-8000-000000000001";

function makePost(body: unknown, authHeader?: string): Request {
  return new Request("http://localhost/api/internal/analyze-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeGet(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/internal/analyze-batch");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyze-batch route", () => {
  // (a) No Authorization header and no secret query param → 401
  it("(a) returns 401 when no Authorization header and no secret query param", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized." });
  });

  // (b) POST with wrong Bearer secret → 401
  it("(b) returns 401 when Authorization header has wrong secret", async () => {
    const res = await POST(makePost({}, "Bearer wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized." });
  });

  // (c) POST authorized with valid doc_id → calls runAnalyzeBatch, returns 200 { ok, doc_id, done }
  it("(c) calls runAnalyzeBatch and returns 200 with correct shape on authorized POST", async () => {
    runAnalyzeBatch.mockResolvedValueOnce({ done: true });

    const res = await POST(makePost({ doc_id: VALID_DOC_ID }, `Bearer ${CORRECT_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, doc_id: VALID_DOC_ID, done: true });
    expect(runAnalyzeBatch).toHaveBeenCalledWith({ docId: VALID_DOC_ID });
  });

  // (d) POST authorized, empty body, no doc in analyzing → returns 200 { ok, done: false, doc_id: null }
  // and does NOT call runAnalyzeBatch
  it("(d) returns { ok: true, done: false, doc_id: null } when no doc found in analyzing status", async () => {
    runAnalyzeBatch.mockClear();

    // Supabase returns no row
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    const res = await POST(makePost({}, `Bearer ${CORRECT_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, done: false, doc_id: null });
    expect(runAnalyzeBatch).not.toHaveBeenCalled();
  });

  // (e) POST authorized, empty body, one doc found in analyzing → calls runAnalyzeBatch with picked id
  it("(e) picks oldest analyzing doc and calls runAnalyzeBatch when no doc_id in body", async () => {
    const pickedId = "00000000-0000-4000-8000-000000000099";
    runAnalyzeBatch.mockResolvedValueOnce({ done: true });

    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: pickedId }, error: null }),
            }),
          }),
        }),
      }),
    }));

    const res = await POST(makePost({}, `Bearer ${CORRECT_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, doc_id: pickedId, done: true });
    expect(runAnalyzeBatch).toHaveBeenCalledWith({ docId: pickedId });
  });

  // (f) GET with ?secret=<correct>&doc_id=<uuid> → auth via query param, same behavior as POST
  it("(f) GET with secret and doc_id query params authenticates and calls runAnalyzeBatch", async () => {
    runAnalyzeBatch.mockResolvedValueOnce({ done: false });

    const res = await GET(
      makeGet({ secret: CORRECT_SECRET, doc_id: VALID_DOC_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, doc_id: VALID_DOC_ID, done: false });
    expect(runAnalyzeBatch).toHaveBeenCalledWith({ docId: VALID_DOC_ID });
  });
});
