import { describe, expect, it, vi } from "vitest";

// Use vi.hoisted so these mocks are available before any imports
const { maybySingleMock, fromMock } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  // Build a fully chainable object for: .select().eq().eq().limit().maybeSingle()
  const chain: Record<string, unknown> = {};
  chain.maybeSingle = maybeSingle;
  chain.limit = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  const from = vi.fn(() => chain);
  return { maybySingleMock: maybeSingle, fromMock: from };
});

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { GET } from "@/app/api/page-text/route";

const UUID1 = "00000000-0000-4000-8000-000000000001";
const UUID2 = "00000000-0000-4000-8000-000000000002";

function makeUrl(params: Record<string, string>) {
  const u = new URL("http://localhost/api/page-text");
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

/**
 * Configure maybySingle to return responses in order:
 * 1st call → session lookup result
 * 2nd call → doc ownership lookup result
 * 3rd call → chunk lookup result
 */
function setupSupabase(
  sessionResult: { data: unknown; error: unknown },
  docResult?: { data: unknown; error: unknown },
  chunkResult?: { data: unknown; error: unknown },
) {
  maybySingleMock.mockReset();
  maybySingleMock
    .mockResolvedValueOnce(sessionResult)
    .mockResolvedValueOnce(docResult ?? { data: null, error: null })
    .mockResolvedValueOnce(chunkResult ?? { data: null, error: null });
}

describe("/api/page-text", () => {
  it("Test 1: returns 400 with missing object when doc_id is absent", async () => {
    const req = new Request(makeUrl({ session_token: UUID1, page: "1" }));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("doc_id");
    expect(body.missing).toBeDefined();
    expect(body.missing.doc_id).toBe(true);
  });

  it("Test 2: returns 400 when session_token is absent", async () => {
    const req = new Request(makeUrl({ doc_id: UUID1, page: "1" }));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("session_token");
  });

  it("Test 3: returns 400 when doc_id is not a UUID", async () => {
    const req = new Request(makeUrl({ doc_id: "not-a-uuid", session_token: UUID1, page: "1" }));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("doc_id must be a valid UUID");
  });

  it("Test 4: returns 400 when session_token is not a UUID", async () => {
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: "not-a-uuid", page: "1" }));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("session_token must be a valid UUID");
  });

  it("Test 5: returns 400 when page is 0 (not positive)", async () => {
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: UUID2, page: "0" }));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("page must be a positive integer");
  });

  it("Test 6: returns 400 when page is not a number", async () => {
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: UUID2, page: "abc" }));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("page must be a positive integer");
  });

  it("Test 7: returns 404 when session_token does not match any chat_sessions row", async () => {
    setupSupabase({ data: null, error: null });
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: UUID2, page: "1" }));
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Document not found.");
  });

  it("Test 8: returns 404 when session exists but doc session_id does not match", async () => {
    setupSupabase({ data: { id: "session-row-id" }, error: null }, { data: null, error: null });
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: UUID2, page: "1" }));
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Document not found.");
  });

  it("Test 9: returns 404 when no chunk exists for the requested page", async () => {
    setupSupabase(
      { data: { id: "session-row-id" }, error: null },
      { data: { id: UUID1 }, error: null },
      { data: null, error: null },
    );
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: UUID2, page: "5" }));
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Page text not found.");
  });

  it("Test 10: returns 200 with { text } when everything matches", async () => {
    setupSupabase(
      { data: { id: "session-row-id" }, error: null },
      { data: { id: UUID1 }, error: null },
      { data: { content: "This is the page content." }, error: null },
    );
    const req = new Request(makeUrl({ doc_id: UUID1, session_token: UUID2, page: "3" }));
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("This is the page content.");
  });
});
