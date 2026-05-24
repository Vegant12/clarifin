import { describe, expect, it, vi, beforeEach } from "vitest";

const { streamTextMock, matchChunksMock, googleMock, supabaseFrom, insertMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  matchChunksMock: vi.fn(),
  googleMock: vi.fn(() => "mock-model"),
  supabaseFrom: vi.fn(),
  insertMock: vi.fn(),
}));

const { traceMock, generationMock, generationEndMock, traceUpdateMock, flushAsyncMock } = vi.hoisted(() => {
  const generationEnd = vi.fn();
  const traceUpdate = vi.fn();
  const generation = vi.fn(() => ({ end: generationEnd }));
  const trace = vi.fn(() => ({ generation, update: traceUpdate }));
  return {
    traceMock: trace,
    generationMock: generation,
    generationEndMock: generationEnd,
    traceUpdateMock: traceUpdate,
    flushAsyncMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("ai", () => ({ streamText: streamTextMock }));
vi.mock("@ai-sdk/google", () => ({ google: googleMock }));
vi.mock("@/lib/rag/match-document-chunks", () => ({ matchDocumentChunks: matchChunksMock }));
vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: supabaseFrom },
}));
vi.mock("@/lib/langfuse", () => ({
  langfuse: { trace: traceMock, flushAsync: flushAsyncMock },
}));
vi.mock("server-only", () => ({}));

import { POST } from "../route";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildValidChatRequest(): Request {
  return makeReq({
    messages: [{ role: "user", content: "What was net income?" }],
    documentId: VALID_UUID,
    sessionId: VALID_UUID,
  });
}

function buildAdviceQueryRequest(): Request {
  return makeReq({
    messages: [{ role: "user", content: "Should I buy BBCA?" }],
    documentId: VALID_UUID,
    sessionId: VALID_UUID,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFrom.mockReturnValue({
    insert: insertMock.mockResolvedValue({ error: null }),
  });
  matchChunksMock.mockResolvedValue([
    { id: "c1", content: "Net profit was 5T", page_number: 12 },
  ]);
  streamTextMock.mockReturnValue({
    toDataStreamResponse: () => new Response("stream", { status: 200 }),
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

describe("Langfuse instrumentation (chat)", () => {
  beforeEach(() => {
    traceMock.mockClear();
    generationMock.mockClear();
    generationEndMock.mockClear();
    flushAsyncMock.mockClear();
  });

  it("opens trace 'chat' and generation 'gemini-chat' when streamText fires", async () => {
    await POST(buildValidChatRequest());
    expect(traceMock).toHaveBeenCalledWith(expect.objectContaining({ name: "chat" }));
    expect(generationMock).toHaveBeenCalledWith(expect.objectContaining({ name: "gemini-chat", model: expect.any(String) }));
  });

  it("does NOT open a trace when isInvestmentAdviceQuery short-circuits", async () => {
    await POST(buildAdviceQueryRequest());
    expect(traceMock).not.toHaveBeenCalled();
  });

  it("does NOT open a trace when retrieval returns no chunks", async () => {
    matchChunksMock.mockResolvedValueOnce([]);
    await POST(buildValidChatRequest());
    expect(traceMock).not.toHaveBeenCalled();
  });

  it("calls generation.end and flushAsync inside onFinish (not after return)", async () => {
    // Capture the onFinish callback passed to streamText
    let capturedOnFinish:
      | ((event: {
          text: string;
          usage?: { promptTokens?: number; completionTokens?: number };
        }) => Promise<void>)
      | undefined;
    streamTextMock.mockImplementationOnce(
      (args: { onFinish?: (event: { text: string; usage?: { promptTokens?: number; completionTokens?: number } }) => Promise<void> }) => {
        capturedOnFinish = args.onFinish;
        return { toDataStreamResponse: () => new Response("stream") };
      },
    );
    await POST(buildValidChatRequest());
    // At this point, onFinish has not fired yet — generation.end + flushAsync must NOT have run
    expect(generationEndMock).not.toHaveBeenCalled();
    expect(flushAsyncMock).not.toHaveBeenCalled();
    // Fire onFinish manually (simulates stream completion)
    await capturedOnFinish?.({ text: "answer", usage: { promptTokens: 100, completionTokens: 200 } });
    expect(generationEndMock).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "answer",
        usageDetails: { input: 100, output: 200 },
      }),
    );
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);
  });
});
