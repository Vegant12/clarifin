import { describe, expect, it, vi, beforeEach } from "vitest";

const { generateObjectMock, supabaseFrom, selectMock, updateMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  supabaseFrom: vi.fn(),
  selectMock: vi.fn(),
  updateMock: vi.fn(),
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

vi.mock("ai", () => ({ generateObject: generateObjectMock }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn(() => "mock-model") }));
vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: supabaseFrom },
}));
vi.mock("@/lib/langfuse", () => ({
  langfuse: { trace: traceMock, flushAsync: flushAsyncMock },
}));
vi.mock("server-only", () => ({}));

import { POST } from "../route";

const VALID_UUID = "22222222-2222-2222-2222-222222222222";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/starter-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildStarterQuestionsRequest(): Request {
  return makeReq({ documentId: VALID_UUID });
}

// Helper that sets up a cache-miss scenario (starter_questions = null, explanation populated)
function setupCacheMiss() {
  supabaseFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: { starter_questions: null, explanation: { revenue: "Revenue grew 10%" } },
            error: null,
          }),
      }),
    }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  });
  generateObjectMock.mockResolvedValue({
    object: { questions: ["a", "b", "c", "d", "e"] },
    usage: { promptTokens: 150, completionTokens: 50 },
  });
}

// Helper that sets up a cache-hit scenario (starter_questions already populated)
function setupCacheHit() {
  const cached = ["q1", "q2", "q3", "q4", "q5"];
  supabaseFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: { starter_questions: cached, explanation: {} },
            error: null,
          }),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/starter-questions (CHAT-05)", () => {
  it("returns 400 on missing documentId", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns cached questions if document_analysis.starter_questions already exists", async () => {
    const cached = ["q1", "q2", "q3", "q4", "q5"];
    supabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { starter_questions: cached, explanation: {} },
              error: null,
            }),
        }),
      }),
    });
    const res = await POST(makeReq({ documentId: VALID_UUID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toEqual(cached);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("calls generateObject when cache is empty", async () => {
    setupCacheMiss();
    const res = await POST(makeReq({ documentId: VALID_UUID }));
    expect(generateObjectMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe("Langfuse instrumentation (starter-questions)", () => {
  beforeEach(() => {
    traceMock.mockClear();
    generationMock.mockClear();
    generationEndMock.mockClear();
    flushAsyncMock.mockClear();
  });

  it("opens trace 'starter-questions' on cache miss + generateObject success", async () => {
    setupCacheMiss();
    await POST(buildStarterQuestionsRequest());
    expect(traceMock).toHaveBeenCalledWith(expect.objectContaining({ name: "starter-questions" }));
    expect(generationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gemini-starter-questions" }),
    );
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT open a trace on cache hit", async () => {
    setupCacheHit();
    await POST(buildStarterQuestionsRequest());
    expect(traceMock).not.toHaveBeenCalled();
    expect(flushAsyncMock).not.toHaveBeenCalled();
  });

  it("closes generation with level: 'ERROR' and flushes when generateObject throws", async () => {
    // Set up cache miss with explanation so we reach the generateObject call
    supabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { starter_questions: null, explanation: { revenue: "Revenue grew 10%" } },
              error: null,
            }),
        }),
      }),
    });
    generateObjectMock.mockRejectedValueOnce(new Error("schema validation fail"));
    await expect(POST(buildStarterQuestionsRequest())).rejects.toThrow();
    expect(generationEndMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "ERROR" }),
    );
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);
  });
});
