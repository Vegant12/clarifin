import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { clonePdfBytes } from "@/lib/pdf/clone-pdf-bytes";
import {
  EXPLANATION_RESPONSE_SCHEMA,
  explanationSchema,
  type ExplanationResult,
} from "@/lib/explain/explanation-schema";
import {
  EXPLANATION_MODEL_ID,
  buildExplanationPrompt,
} from "@/lib/explain/explain-prompts";
import { langfuse } from "@/lib/langfuse";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export async function waitForFileReady(
  ai: GoogleGenAI,
  name: string,
): Promise<{ uri: string; mimeType: string }> {
  const MAX_POLLS = 40; // 40 × 1500ms = 60s max wait
  let polls = 0;
  let file = await ai.files.get({ name });
  while (file.state === "PROCESSING" && polls < MAX_POLLS) {
    await new Promise((r) => setTimeout(r, 1500));
    file = await ai.files.get({ name });
    polls++;
  }
  if (file.state === "PROCESSING") {
    throw new Error(
      `Gemini file ${name} still PROCESSING after ${MAX_POLLS} polls — aborting.`,
    );
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini file processing failed.");
  }
  if (!file.uri) {
    throw new Error("Gemini file has no URI.");
  }
  return { uri: file.uri, mimeType: file.mimeType ?? "application/pdf" };
}

export async function uploadFresh(
  ai: GoogleGenAI,
  pdfBytes: Uint8Array,
  filename: string,
): Promise<{ resourceName: string; uri: string; mimeType: string }> {
  const bytes = clonePdfBytes(pdfBytes);
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: "application/pdf" });
  const uploaded = await ai.files.upload({
    file: blob,
    config: {
      mimeType: "application/pdf",
      displayName: filename,
    },
  });
  if (!uploaded.name) {
    throw new Error("Gemini file upload returned no name.");
  }
  const resourceName = uploaded.name;
  const { uri, mimeType } = await waitForFileReady(ai, resourceName);
  return { resourceName, uri, mimeType };
}

// ---------------------------------------------------------------------------
// ID stopwords for language detection
// ---------------------------------------------------------------------------

const ID_STOPWORDS = [
  "dan",
  "yang",
  "dalam",
  "untuk",
  "dengan",
  "laporan",
  "tahun",
] as const;

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the document is likely in Bahasa Indonesia.
 * - If extractionSource is null or "gemini_files" (OCR / Gemini-parsed), we default to Indonesian
 *   because most IDX annual reports are in Bahasa Indonesia and OCR'd docs lose language hints.
 * - Otherwise: count ID stopword occurrences in the first 200 chars of firstPageText.
 *   ≥ 5 hits → Indonesian.
 */
export function isIndonesianDoc(
  extractionSource: string | null,
  firstPageText: string,
): boolean {
  if (!extractionSource || extractionSource === "gemini_files") return true;
  const sample = firstPageText.slice(0, 200).toLowerCase();
  const hits = ID_STOPWORDS.filter((w) => sample.includes(w)).length;
  return hits >= 5;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export interface GenerateExplanationParams {
  docId: string;
  pdfBytes: Uint8Array | null;
  filename: string;
  totalPages: number;
  extractionSource: string | null;
  fileResourceName: string | null;
  firstPageText: string;
}

export interface GenerateExplanationResult {
  result: ExplanationResult;
  fileResourceName: string;
}

/**
 * Calls Gemini Files API + generateContentStream to produce a structured 5-section
 * ExplanationResult. Reuses the cached Gemini file resource when available; re-uploads
 * when the resource is absent, expired, or FAILED (Pitfall 2).
 *
 * Uses streaming accumulation (Pitfall 1) — chunks are partial JSON, accumulated
 * server-side before JSON.parse + Zod validation.
 *
 * Does NOT write to Supabase — the caller (runAnalyzeBatch) owns persistence.
 *
 * Langfuse Pattern A (D-02, Plan 11-02): opens a trace + generation BEFORE the LLM call,
 * closes the generation with output + usageDetails on success or level:"ERROR" on failure,
 * and flushes in a finally block (AI-SPEC §3 pitfall 1 — mandatory before serverless exit).
 */
export async function generateExplanation(
  params: GenerateExplanationParams,
): Promise<GenerateExplanationResult> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let resourceName: string;
  let uri: string;
  let mimeType: string;

  try {
    if (params.fileResourceName) {
      const ready = await waitForFileReady(ai, params.fileResourceName);
      resourceName = params.fileResourceName;
      uri = ready.uri;
      mimeType = ready.mimeType;
    } else {
      if (!params.pdfBytes) {
        throw new Error(
          "generateExplanation: no fileResourceName and no pdfBytes — cannot upload.",
        );
      }
      const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
      resourceName = fresh.resourceName;
      uri = fresh.uri;
      mimeType = fresh.mimeType;
    }
  } catch (err) {
    // FAILED / expired path — fall through to re-upload if we have bytes
    if (!params.pdfBytes) throw err;
    const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
    resourceName = fresh.resourceName;
    uri = fresh.uri;
    mimeType = fresh.mimeType;
  }

  const isIndonesian = isIndonesianDoc(params.extractionSource, params.firstPageText);
  const prompt = buildExplanationPrompt(params.totalPages, isIndonesian);

  // ---------------------------------------------------------------------------
  // Langfuse Pattern A (D-02): open trace + generation BEFORE the LLM call.
  // - Trace name = "explanation" (pipeline step identifier).
  // - Generation captures input prompt, model ID, modelParameters.
  // - metadata.commit = VERCEL_GIT_COMMIT_SHA (set on Vercel) or "local" for dev (D-06).
  // - DO NOT pass pdfBytes as input (AI-SPEC §3 pitfall 5 — exceeds per-event byte limit).
  // ---------------------------------------------------------------------------
  const trace = langfuse.trace({
    name: "explanation",
    metadata: {
      doc_id: params.docId,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      step: "explanation",
    },
  });
  const generation = trace.generation({
    name: "gemini-explanation",
    model: EXPLANATION_MODEL_ID,
    input: {
      prompt,
      docId: params.docId,
      isIndonesian,
      totalPages: params.totalPages,
    },
    modelParameters: { responseMimeType: "application/json" },
    metadata: {
      doc_id: params.docId,
      step: "explanation",
      gemini_file_uri: uri,
    },
  });

  try {
    const stream = await ai.models.generateContentStream({
      model: EXPLANATION_MODEL_ID,
      contents: [createPartFromUri(uri, mimeType), { text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: EXPLANATION_RESPONSE_SCHEMA,
      },
    });

    // Accumulate chunks — each chunk is partial JSON; do NOT JSON.parse per chunk (Pitfall 1)
    // lastChunk carries the cumulative usageMetadata on the final chunk (Gemini behavior)
    let accumulated = "";
    let lastChunk:
      | { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
      | undefined;
    for await (const chunk of stream) {
      accumulated += (chunk as { text?: string }).text ?? "";
      lastChunk = chunk as typeof lastChunk;
    }

    if (!accumulated) {
      throw new Error("Empty Gemini response (no chunks accumulated).");
    }

    // Strip markdown fences defensively — responseMimeType should prevent them but match
    // the defensive strip from gemini-pdf-pages.ts
    const stripped = accumulated
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");

    const parsed = JSON.parse(stripped) as unknown;
    const result = explanationSchema.parse(parsed);

    // Close generation with output + token counts from the final chunk's usageMetadata
    generation.end({
      output: result,
      usageDetails: {
        input: lastChunk?.usageMetadata?.promptTokenCount ?? 0,
        output: lastChunk?.usageMetadata?.candidatesTokenCount ?? 0,
      },
    });
    trace.update({
      output: { status: "success", sections: Object.keys(result) },
    });

    return { result, fileResourceName: resourceName };
  } catch (err) {
    // AI-SPEC §3 pitfall 4: must close generation on error path or trace becomes orphaned.
    generation.end({
      output: { error: String(err) },
      level: "ERROR",
      statusMessage: String(err),
    });
    trace.update({ output: { error: String(err) } });
    throw err;
  } finally {
    // AI-SPEC §3 pitfall 1: MUST flush before the serverless function exits,
    // otherwise the in-memory event queue is silently discarded by Node teardown.
    await langfuse.flushAsync();
  }
}
