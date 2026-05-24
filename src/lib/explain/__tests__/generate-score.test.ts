import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @google/genai BEFORE importing generate-score
const { generateContentStream, filesGet, filesUpload, createPartFromUri } = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
  filesGet: vi.fn(),
  filesUpload: vi.fn(),
  createPartFromUri: vi.fn((uri: string, mimeType: string) => ({ fileData: { fileUri: uri, mimeType } })),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    files: { get: filesGet, upload: filesUpload },
    models: { generateContentStream },
  })),
  createPartFromUri,
}));

vi.mock("@/lib/env", () => ({ env: { GEMINI_API_KEY: "test-key" } }));
vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Langfuse mock (Plan 11-02) — hoisted so spies are accessible inside tests
// ---------------------------------------------------------------------------

const { flushAsyncMock, generationEndMock, traceUpdateMock, traceMock, generationMock } =
  vi.hoisted(() => {
    const generationEnd = vi.fn();
    const traceUpdate = vi.fn();
    const generation = vi.fn(() => ({ end: generationEnd }));
    const trace = vi.fn(() => ({ generation, update: traceUpdate }));
    return {
      flushAsyncMock: vi.fn().mockResolvedValue(undefined),
      generationEndMock: generationEnd,
      traceUpdateMock: traceUpdate,
      traceMock: trace,
      generationMock: generation,
    };
  });

vi.mock("@/lib/langfuse", () => ({
  langfuse: { trace: traceMock, flushAsync: flushAsyncMock },
}));

async function* makeStream(text: string): AsyncGenerator<{ text: string }> {
  yield { text };
}

const { generateScore } = await import("../generate-score");

const validJson = JSON.stringify({
  overall_score: 7,
  dimensions: ["Profitability", "Balance Sheet", "Growth Trend", "Valuation Context"].map((n) => ({
    name: n, score: 7, reasoning: "Margins are stable year over year.",
    snippets: [{ text: "Net profit increased 12% to Rp 48 triliun.", page: 47 }],
  })),
});

const baseParams = {
  docId: "doc-1", pdfBytes: null, filename: "x.pdf",
  totalPages: 100, extractionSource: null, fileResourceName: "files/abc",
  firstPageText: "Annual Report 2023",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  filesGet.mockResolvedValue({ state: "ACTIVE", uri: "https://gen.example/files/abc", mimeType: "application/pdf" });
  filesUpload.mockResolvedValue({ name: "files/abc", uri: "https://gen.example/files/abc", mimeType: "application/pdf", state: "ACTIVE" });
});

describe("generateScore", () => {
  it("SCORE-01: calls @google/genai with SCORE_MODEL_ID and SCORE_RESPONSE_SCHEMA", async () => {
    generateContentStream.mockReturnValue(makeStream(validJson));
    await generateScore({ ...baseParams });
    expect(generateContentStream).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const call = generateContentStream.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(call.model).toBe("gemini-2.5-flash");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(call.config.responseMimeType).toBe("application/json");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(call.config.responseSchema).toBeDefined();
  });
  it("SCORE-01: sets thinkingConfig.thinkingBudget = 0 in config", async () => {
    generateContentStream.mockReturnValue(makeStream(validJson));
    await generateScore({ ...baseParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const call = generateContentStream.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("SCORE-01: returns parsed ScoreResult on happy path", async () => {
    generateContentStream.mockReturnValue(makeStream(validJson));
    const res = await generateScore({ ...baseParams });
    expect(res.result.overall_score).toBe(7);
    expect(res.result.dimensions).toHaveLength(4);
    expect(res.fileResourceName).toBe("files/abc");
  });
  it("SCORE-01: strips ```json fences before parse", async () => {
    generateContentStream.mockReturnValue(makeStream("```json\n" + validJson + "\n```"));
    const res = await generateScore({ ...baseParams });
    expect(res.result.overall_score).toBe(7);
  });
  it("SCORE-01: throws on empty stream", async () => {
    generateContentStream.mockReturnValue(makeStream(""));
    await expect(generateScore({ ...baseParams })).rejects.toThrow(/empty/i);
  });
  it("SCORE-05: throws on compliance violation in reasoning before returning", async () => {
    const bad = JSON.parse(validJson);
    bad.dimensions[0].reasoning = "Investors should buy this stock.";
    generateContentStream.mockReturnValue(makeStream(JSON.stringify(bad)));
    await expect(generateScore({ ...baseParams })).rejects.toThrow(/Compliance violation.*buy/);
  });
  it("SCORE-05: throws on compliance violation in snippet text", async () => {
    const bad = JSON.parse(validJson);
    bad.dimensions[1].snippets[0].text = "We recommend accumulating shares.";
    generateContentStream.mockReturnValue(makeStream(JSON.stringify(bad)));
    await expect(generateScore({ ...baseParams })).rejects.toThrow(/Compliance violation/);
  });
  it("SCORE-01: re-uploads PDF when fileResourceName resolution fails", async () => {
    filesGet.mockRejectedValueOnce(new Error("FAILED"));
    generateContentStream.mockReturnValue(makeStream(validJson));
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const res = await generateScore({ ...baseParams, pdfBytes });
    expect(filesUpload).toHaveBeenCalled();
    expect(res.result.overall_score).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Langfuse instrumentation tests (Plan 11-02)
// ---------------------------------------------------------------------------

describe("Langfuse instrumentation (score)", () => {
  beforeEach(() => {
    traceMock.mockClear();
    generationMock.mockClear();
    generationEndMock.mockClear();
    traceUpdateMock.mockClear();
    flushAsyncMock.mockClear();
    filesGet.mockResolvedValue({
      state: "ACTIVE",
      uri: "https://gen.example/files/abc",
      mimeType: "application/pdf",
    });
    generateContentStream.mockReturnValue(makeStream(validJson));
  });

  it("opens trace 'score' and generation 'gemini-score' on success", async () => {
    await generateScore({ ...baseParams });
    expect(traceMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "score" }),
    );
    expect(generationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gemini-score" }),
    );
  });

  it("calls flushAsync exactly once on success and once on failure", async () => {
    // success
    await generateScore({ ...baseParams });
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);

    // failure
    flushAsyncMock.mockClear();
    generateContentStream.mockRejectedValueOnce(new Error("gemini boom"));
    await expect(generateScore({ ...baseParams })).rejects.toThrow();
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("closes generation with level: 'ERROR' when Gemini throws", async () => {
    generationEndMock.mockClear();
    generateContentStream.mockRejectedValueOnce(new Error("gemini score fail"));
    await expect(generateScore({ ...baseParams })).rejects.toThrow();
    expect(generationEndMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "ERROR",
        output: expect.objectContaining({
          error: expect.stringContaining("gemini score fail"),
        }),
      }),
    );
  });
});
