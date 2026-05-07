import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMock, getMock, generateContentMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getMock: vi.fn(),
  generateContentMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    files = {
      upload: uploadMock,
      get: getMock,
    };
    models = { generateContent: generateContentMock };
  },
  createPartFromUri: vi.fn((uri: string, mimeType: string) => ({
    fileData: { fileUri: uri, mimeType: mimeType },
  })),
}));

describe("extractPagesWithGemini", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    uploadMock.mockResolvedValue({ name: "files/uploaded-1" });
    getMock.mockResolvedValue({
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/x",
      mimeType: "application/pdf",
    });
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        pages: [
          { page: 1, text: "alpha" },
          { page: 2, text: "beta" },
        ],
      }),
    });
  });

  it("uploads once, polls file, returns parsed pages + resource name", async () => {
    const { extractPagesWithGemini } = await import("./gemini-pdf-pages");
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const result = await extractPagesWithGemini({
      pdfBytes,
      filename: "doc.pdf",
      pageStart: 1,
      pageEnd: 2,
      fileResourceName: null,
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalled();
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
      }),
    );
    expect(result.fileResourceName).toBe("files/uploaded-1");
    expect(result.pages).toEqual([
      { page: 1, text: "alpha" },
      { page: 2, text: "beta" },
    ]);
  });

  it("reuses fileResourceName without uploading", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ pages: [{ page: 1, text: "only" }] }),
    });
    const { extractPagesWithGemini } = await import("./gemini-pdf-pages");
    await extractPagesWithGemini({
      pdfBytes: new Uint8Array([1, 2, 3]),
      filename: "doc.pdf",
      pageStart: 1,
      pageEnd: 1,
      fileResourceName: "files/existing",
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(getMock).toHaveBeenCalledWith({ name: "files/existing" });
  });
});
