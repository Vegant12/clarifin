import { describe, expect, it } from "vitest";

import {
  MAX_PDF_BYTES,
  PDF_MAGIC_BYTES,
  PDF_MIME_TYPE,
  validatePdfMagicBytes,
  validatePdfUpload,
} from "@/lib/upload-validation";

describe("validatePdfUpload (metadata-level INFRA-01 check)", () => {
  it("rejects files larger than MAX_PDF_BYTES (20 MB)", () => {
    const result = validatePdfUpload({
      size: 25 * 1024 * 1024,
      type: PDF_MIME_TYPE,
      name: "big.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/20 MB|Maximum/i);
    }
  });

  it("rejects empty (zero-byte) files", () => {
    const result = validatePdfUpload({
      size: 0,
      type: PDF_MIME_TYPE,
      name: "empty.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/empty|invalid size/i);
    }
  });

  it("rejects non-PDF MIME with no .pdf extension", () => {
    const result = validatePdfUpload({
      size: 1024,
      type: "text/plain",
      name: "report.txt",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/PDF/);
    }
  });

  it("accepts a valid 15 MB application/pdf with .pdf extension", () => {
    const result = validatePdfUpload({
      size: 15 * 1024 * 1024,
      type: PDF_MIME_TYPE,
      name: "report.pdf",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts mismatched MIME when filename ends in .pdf (extension fallback per D-24)", () => {
    const result = validatePdfUpload({
      size: 15 * 1024 * 1024,
      type: "text/plain",
      name: "report.pdf",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a file at exactly MAX_PDF_BYTES; rejects one byte over", () => {
    const exact = validatePdfUpload({
      size: MAX_PDF_BYTES,
      type: PDF_MIME_TYPE,
      name: "boundary.pdf",
    });
    expect(exact.ok).toBe(true);

    const over = validatePdfUpload({
      size: MAX_PDF_BYTES + 1,
      type: PDF_MIME_TYPE,
      name: "boundary.pdf",
    });
    expect(over.ok).toBe(false);
  });

  it("rejects negative or NaN size", () => {
    expect(
      validatePdfUpload({ size: -1, type: PDF_MIME_TYPE, name: "x.pdf" }).ok,
    ).toBe(false);
    expect(
      validatePdfUpload({
        size: Number.NaN,
        type: PDF_MIME_TYPE,
        name: "x.pdf",
      }).ok,
    ).toBe(false);
  });
});

describe("validatePdfMagicBytes (defense-in-depth post-upload check)", () => {
  it("accepts a buffer that starts with %PDF-", () => {
    const buf = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);
    expect(validatePdfMagicBytes(buf).ok).toBe(true);
  });

  it("rejects a buffer with a wrong header", () => {
    const buf = new Uint8Array([0x42, 0x4d, 0x00, 0x00, 0x00]); // "BM\0\0\0" (BMP magic)
    const result = validatePdfMagicBytes(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/header/i);
    }
  });

  it("rejects a buffer that is too short to inspect", () => {
    const buf = new Uint8Array([0x25, 0x50]);
    const result = validatePdfMagicBytes(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/too small/i);
    }
  });
});

describe("module exports", () => {
  it("exports MAX_PDF_BYTES = 20971520 (20 MB)", () => {
    expect(MAX_PDF_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_PDF_BYTES).toBe(20971520);
  });

  it("PDF_MAGIC_BYTES is the 5-byte sequence %PDF-", () => {
    expect(Array.from(PDF_MAGIC_BYTES)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });
});
