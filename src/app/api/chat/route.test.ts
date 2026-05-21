import { describe, expect, it, vi, beforeEach } from "vitest";

const { streamTextMock, matchChunksMock, googleMock, supabaseFrom, insertMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  matchChunksMock: vi.fn(),
  googleMock: vi.fn(() => "mock-model"),
  supabaseFrom: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("ai", () => ({ streamText: streamTextMock }));
vi.mock("@ai-sdk/google", () => ({ google: googleMock }));
vi.mock("@/lib/rag/match-document-chunks", () => ({ matchDocumentChunks: matchChunksMock }));
vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: supabaseFrom },
}));

import { POST } from "../route";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFrom.mockReturnValue({
    insert: insertMock.mockResolvedValue({ error: null }),
  });
});

describe("POST /api/chat (CHAT-01, CHAT-06)", () => {
  it("CHAT-01: returns 400 on invalid request body", async () => {
    const res = await POST(makeReq({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("CHAT-06: guardrail-fire path does NOT call streamText", async () => {
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "Should I buy BBCA?" }],
        documentId: VALID_UUID,
        sessionId: VALID_UUID,
      }),
    );
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(matchChunksMock).not.toHaveBeenCalled();
    // Deflection still persisted as assistant message
    expect(insertMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("CHAT-01: happy path calls matchDocumentChunks then streamText", async () => {
    matchChunksMock.mockResolvedValue([
      { id: "c1", content: "Net profit was 5T", page_number: 12 },
    ]);
    streamTextMock.mockReturnValue({
      toDataStreamResponse: () => new Response("stream", { status: 200 }),
    });
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "What was net income?" }],
        documentId: VALID_UUID,
        sessionId: VALID_UUID,
      }),
    );
    expect(matchChunksMock).toHaveBeenCalledWith(
      expect.objectContaining({ docId: VALID_UUID, query: "What was net income?" }),
    );
    expect(streamTextMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("CHAT-02: empty retrieval returns no-info response without calling streamText", async () => {
    matchChunksMock.mockResolvedValue([]);
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "What is the weather?" }],
        documentId: VALID_UUID,
        sessionId: VALID_UUID,
      }),
    );
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
