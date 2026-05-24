import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — hoisted so they are available before imports are resolved
// ---------------------------------------------------------------------------

const { generateContentStream, filesGet, filesUpload, createPartFromUri } = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
  filesGet: vi.fn(),
  filesUpload: vi.fn(),
  createPartFromUri: vi.fn((uri: string, mime: string) => ({
    fileData: { fileUri: uri, mimeType: mime },
  })),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    files: {
      get: filesGet,
      upload: filesUpload,
    },
    models: {
      generateContentStream,
    },
  })),
  createPartFromUri,
}));

vi.mock("@/lib/env", () => ({
  env: { GEMINI_API_KEY: "test-key" },
}));

// server-only is a package that throws when not in server context — stub it
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

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { generateExplanation, isIndonesianDoc } from "../generate-explanation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_EXPLANATION = {
  revenue: "Revenue grew 12% [p.5]",
  profitability: "Net income margin 8% [p.7]",
  balance_sheet: "Debt-to-equity 0.4 [p.9]",
  cash_flow: "Operating cash flow positive [p.11]",
  key_risks: "Commodity price risk [p.14]",
};

/** Build a mock async generator that yields one chunk */
async function* makeStream(text: string): AsyncGenerator<{ text: string }> {
  yield { text };
}

// ---------------------------------------------------------------------------
// isIndonesianDoc tests
// ---------------------------------------------------------------------------

describe("isIndonesianDoc", () => {
  it("returns true when extractionSource is null", () => {
    expect(isIndonesianDoc(null, "")).toBe(true);
  });

  it("returns true when extractionSource is gemini_files", () => {
    expect(isIndonesianDoc("gemini_files", "")).toBe(true);
  });

  it("returns false for an English doc (extractionSource unpdf, low stopword count)", () => {
    expect(isIndonesianDoc("unpdf", "lorem ipsum English text")).toBe(false);
  });

  it("returns true when first 200 chars have >= 5 ID stopwords", () => {
    const text = "laporan tahun dalam untuk dengan dan yang keuangan";
    expect(isIndonesianDoc("unpdf", text)).toBe(true);
  });

  it("returns false when only 3 ID stopwords are present", () => {
    const text = "laporan tahun dalam something else entirely English";
    expect(isIndonesianDoc("unpdf", text)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateExplanation tests
// ---------------------------------------------------------------------------

describe("generateExplanation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    docId: "doc-1",
    pdfBytes: new Uint8Array([1, 2, 3]),
    filename: "report.pdf",
    totalPages: 50,
    extractionSource: "unpdf" as string | null,
    fileResourceName: null as string | null,
    firstPageText: "laporan tahun keuangan dalam untuk dengan dan yang",
  };

  it("accumulates streamed JSON and returns a valid ExplanationResult", async () => {
    // Existing resource path — fileResourceName provided
    filesGet.mockResolvedValue({ state: "ACTIVE", uri: "gs://bucket/file", mimeType: "application/pdf" });
    generateContentStream.mockResolvedValue(makeStream(JSON.stringify(VALID_EXPLANATION)));

    const result = await generateExplanation({
      ...baseParams,
      fileResourceName: "files/abc123",
    });

    expect(result.result).toEqual(VALID_EXPLANATION);
    expect(result.fileResourceName).toBe("files/abc123");
    expect(generateContentStream).toHaveBeenCalledTimes(1);
  });

  it("uploads a fresh file when fileResourceName is null", async () => {
    filesUpload.mockResolvedValue({ name: "files/new456" });
    filesGet.mockResolvedValue({ state: "ACTIVE", uri: "gs://bucket/new", mimeType: "application/pdf" });
    generateContentStream.mockResolvedValue(makeStream(JSON.stringify(VALID_EXPLANATION)));

    const result = await generateExplanation({
      ...baseParams,
      fileResourceName: null,
    });

    expect(filesUpload).toHaveBeenCalledTimes(1);
    expect(result.fileResourceName).toBe("files/new456");
    expect(result.result).toEqual(VALID_EXPLANATION);
  });

  it("throws a ZodError when the streamed JSON is missing a required key", async () => {
    filesGet.mockResolvedValue({ state: "ACTIVE", uri: "gs://bucket/file", mimeType: "application/pdf" });
    // Missing key_risks
    const incomplete = { revenue: "R", profitability: "P", balance_sheet: "B", cash_flow: "C" };
    generateContentStream.mockResolvedValue(makeStream(JSON.stringify(incomplete)));

    await expect(
      generateExplanation({ ...baseParams, fileResourceName: "files/abc123" }),
    ).rejects.toThrow();
  });

  it("re-uploads when the cached file resource has FAILED state and pdfBytes are available", async () => {
    // First call (for the provided resource name) returns FAILED
    filesGet
      .mockResolvedValueOnce({ state: "FAILED", uri: null, mimeType: "application/pdf" })
      // Second call after fresh upload returns ACTIVE
      .mockResolvedValueOnce({ state: "ACTIVE", uri: "gs://bucket/fresh", mimeType: "application/pdf" });
    filesUpload.mockResolvedValue({ name: "files/fresh789" });
    generateContentStream.mockResolvedValue(makeStream(JSON.stringify(VALID_EXPLANATION)));

    const result = await generateExplanation({
      ...baseParams,
      fileResourceName: "files/expired",
    });

    expect(filesUpload).toHaveBeenCalledTimes(1);
    expect(result.fileResourceName).toBe("files/fresh789");
    expect(result.result).toEqual(VALID_EXPLANATION);
  });

  it("propagates error when re-upload (filesUpload) rejects in the catch-path", async () => {
    // Cached resource exists but waitForFileReady throws (FAILED state)
    filesGet.mockResolvedValueOnce({ state: "FAILED", uri: null, mimeType: "application/pdf" });
    // Fresh upload itself also fails — error should propagate out of generateExplanation
    filesUpload.mockRejectedValue(new Error("Gemini storage quota exceeded"));

    await expect(
      generateExplanation({
        ...baseParams,
        fileResourceName: "files/expired",
      }),
    ).rejects.toThrow("Gemini storage quota exceeded");

    // generateContentStream must NOT have been called — we never reached the LLM call
    expect(generateContentStream).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Langfuse instrumentation tests (Plan 11-02)
// ---------------------------------------------------------------------------

describe("Langfuse instrumentation", () => {
  beforeEach(() => {
    traceMock.mockClear();
    generationMock.mockClear();
    generationEndMock.mockClear();
    traceUpdateMock.mockClear();
    flushAsyncMock.mockClear();
    filesGet.mockResolvedValue({
      state: "ACTIVE",
      uri: "gs://bucket/file",
      mimeType: "application/pdf",
    });
    generateContentStream.mockResolvedValue(
      (async function* () {
        yield { text: JSON.stringify({
          revenue: "R [p.1]",
          profitability: "P [p.2]",
          balance_sheet: "B [p.3]",
          cash_flow: "C [p.4]",
          key_risks: "K [p.5]",
        }) };
      })(),
    );
  });

  const baseParams = {
    docId: "doc-1",
    pdfBytes: new Uint8Array([1, 2, 3]),
    filename: "report.pdf",
    totalPages: 50,
    extractionSource: "unpdf" as string | null,
    fileResourceName: "files/abc123" as string | null,
    firstPageText: "laporan tahun keuangan dalam untuk dengan dan yang",
  };

  it("opens trace 'explanation' and generation 'gemini-explanation' on success", async () => {
    await generateExplanation(baseParams);
    expect(traceMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "explanation" }),
    );
    expect(generationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gemini-explanation" }),
    );
  });

  it("calls flushAsync exactly once on success and once on failure", async () => {
    // success
    await generateExplanation(baseParams);
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);

    // failure
    flushAsyncMock.mockClear();
    generateContentStream.mockRejectedValueOnce(new Error("gemini boom"));
    await expect(generateExplanation(baseParams)).rejects.toThrow();
    expect(flushAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("closes generation with level: 'ERROR' when Gemini throws", async () => {
    generationEndMock.mockClear();
    generateContentStream.mockRejectedValueOnce(new Error("gemini fail"));
    await expect(
      generateExplanation({ ...baseParams, docId: "doc-3" }),
    ).rejects.toThrow();
    expect(generationEndMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "ERROR",
        output: expect.objectContaining({
          error: expect.stringContaining("gemini fail"),
        }),
      }),
    );
  });
});
