/**
 * Gemini Files API extraction for Phase 5 benchmarking (server / scripts only — uses `@/lib/env`).
 */
import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { parseEvalExtractionResponse } from "@/lib/eval/load-manifest";
import { EVAL_MODEL_ID, PROMPT_EVAL_BASE, PROMPT_EVAL_BROKEN } from "@/lib/eval/prompts";
import type { EvalExtraction } from "@/lib/eval/schema";
import { clonePdfBytes } from "@/lib/pdf/clone-pdf-bytes";

async function waitForFileReady(
  ai: GoogleGenAI,
  name: string,
): Promise<{ uri: string; mimeType: string }> {
  let file = await ai.files.get({ name });
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 1500));
    file = await ai.files.get({ name });
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini file processing failed.");
  }
  if (!file.uri) {
    throw new Error("Gemini file has no URI.");
  }
  return { uri: file.uri, mimeType: file.mimeType ?? "application/pdf" };
}

async function cleanupIfFresh(
  ai: GoogleGenAI,
  resourceName: string | undefined,
  shouldDelete: boolean,
): Promise<void> {
  if (!shouldDelete || !resourceName) return;
  try {
    await ai.files.delete({ name: resourceName });
  } catch {
    /* best-effort */
  }
}

export type ExtractEvalClaimsParams = {
  pdfBytes: Uint8Array;
  filename: string;
  promptVariant?: "baseline" | "broken";
};

/**
 * Runs a single Gemini extraction pass for benchmarking (Phase 5). Uploads PDF, waits ACTIVE, parses JSON envelope.
 */
export async function extractEvalClaims(params: ExtractEvalClaimsParams): Promise<EvalExtraction> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let resourceName: string | undefined;
  let didUpload = false;
  try {
    const bytes = clonePdfBytes(params.pdfBytes);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const blob = new Blob([ab], { type: "application/pdf" });
    const uploaded = await ai.files.upload({
      file: blob,
      config: {
        mimeType: "application/pdf",
        displayName: params.filename,
      },
    });
    if (!uploaded.name) throw new Error("Gemini file upload returned no name.");
    resourceName = uploaded.name;
    didUpload = true;

    const { uri, mimeType } = await waitForFileReady(ai, resourceName);
    const instruction = params.promptVariant === "broken" ? PROMPT_EVAL_BROKEN : PROMPT_EVAL_BASE;

    const response = await ai.models.generateContent({
      model: EVAL_MODEL_ID,
      contents: [createPartFromUri(uri, mimeType), { text: instruction }],
      config: { responseMimeType: "application/json" },
    });

    const body = response.text;
    if (!body) throw new Error("Empty Gemini response.");
    return parseEvalExtractionResponse(body);
  } finally {
    await cleanupIfFresh(ai, resourceName, didUpload);
  }
}
