import { describe, expect, it, vi, beforeEach } from "vitest";

const { generateObjectMock, supabaseFrom, selectMock, updateMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  supabaseFrom: vi.fn(),
  selectMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("ai", () => ({ generateObject: generateObjectMock }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn(() => "mock-model") }));
vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: supabaseFrom },
}));

import { POST } from "../route";

const VALID_UUID = "22222222-2222-2222-2222-222222222222";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/starter-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
          maybeSingle: () => Promise.resolve({
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
    supabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { starter_questions: null, explanation: { revenue: "x" } },
            error: null,
          }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });
    generateObjectMock.mockResolvedValue({
      object: { questions: ["a", "b", "c", "d", "e"] },
    });
    const res = await POST(makeReq({ documentId: VALID_UUID }));
    expect(generateObjectMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
