/**
 * Copy PDF bytes into a standalone Uint8Array backed by a fresh ArrayBuffer.
 * Avoids DataCloneError when buffers are passed through Blob uploads (Gemini) or pdf.js worker paths.
 */
export function clonePdfBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
