/**
 * Server-side PDF upload validator (INFRA-01 / D-24, Phase 2 cap D-01).
 *
 * Phase 2 wires `validatePdfUpload` into `/api/upload-init` — the call MUST
 * happen before any Supabase Storage operation (signed URL issuance, etc.).
 *
 * The **20 MB** product limit applies to the raw PDF size as reported by the
 * browser's `File.size`. Magic-byte verification (`validatePdfMagicBytes`) runs
 * after upload (see `/api/upload-complete`).
 */

export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB = 20971520 bytes
export const PDF_MIME_TYPE = "application/pdf";

// "%PDF-" — the first 5 bytes of every valid PDF file (PDF spec sec 7.5.2).
export const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

export type UploadValidationResult = { ok: true } | { ok: false; reason: string };

export type UploadValidationInput = {
  size: number;
  type: string;
  name: string;
};

/**
 * Metadata-only validation. Suitable for the upload-init route — the file
 * bytes are not yet on the server. Phase 2 calls this BEFORE issuing a
 * Supabase Storage signed URL.
 *
 * Design note (D-24): when `type` is wrong but `name` ends in `.pdf`, accept
 * the upload. Some browsers under-report the MIME (e.g., Safari reporting
 * `application/octet-stream` for older PDFs). The magic-byte check after
 * upload (`validatePdfMagicBytes`) is the trustworthy second line of defense.
 */
export function validatePdfUpload(input: UploadValidationInput): UploadValidationResult {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, reason: "File is empty or has invalid size." };
  }
  if (input.size > MAX_PDF_BYTES) {
    const mb = (input.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: `File is ${mb} MB. Maximum allowed is 20 MB.`,
    };
  }

  const isCorrectMime = input.type === PDF_MIME_TYPE;
  const hasPdfExtension = input.name.toLowerCase().endsWith(".pdf");
  if (!isCorrectMime && !hasPdfExtension) {
    return {
      ok: false,
      reason: "Only PDF files are supported (.pdf, application/pdf).",
    };
  }

  return { ok: true };
}

/**
 * Magic-byte verification. Phase 2 calls this AFTER upload completes.
 * More trustworthy than `File.type` because it inspects actual file bytes.
 */
export function validatePdfMagicBytes(buffer: ArrayBuffer | Uint8Array): UploadValidationResult {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer.subarray(0, PDF_MAGIC_BYTES.length)
      : new Uint8Array(buffer, 0, Math.min(PDF_MAGIC_BYTES.length, buffer.byteLength));

  if (bytes.length < PDF_MAGIC_BYTES.length) {
    return { ok: false, reason: "File is too small to be a valid PDF." };
  }
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
      return {
        ok: false,
        reason: "File header does not match a valid PDF (%PDF-).",
      };
    }
  }
  return { ok: true };
}
