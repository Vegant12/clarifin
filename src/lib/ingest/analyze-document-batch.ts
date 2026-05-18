import "server-only";

import { supabaseAdmin } from "@/db/client";
import { generateExplanation } from "@/lib/explain/generate-explanation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Vercel Fluid Compute 300s ceiling — leave 10s headroom for DB writes and cleanup.
 * Mirrors MAX_EMBED_BATCH_WALL_MS pattern from embed-document-batch.ts.
 */
export const MAX_ANALYZE_BATCH_WALL_MS = 290_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function analyzeFailureUserMessage(err: unknown): string {
  const dev = process.env.NODE_ENV === "development";
  if (dev && err instanceof Error && err.message) {
    const m = err.message.trim();
    return m.length > 400 ? `Analysis failed: ${m.slice(0, 400)}…` : `Analysis failed: ${m}`;
  }
  return "Analysis failed. Try uploading again.";
}

/**
 * Returns true for transient Gemini errors (429, quota exhausted) that warrant a cron retry.
 * Leaves document in "analyzing" status so the next cron tick picks it up.
 */
function isTransientGeminiError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /(429|rate.?limit|quota|RESOURCE_EXHAUSTED)/i.test(err.message)
  );
}

async function failDocumentAnalyze(docId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("documents")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
    })
    .eq("id", docId);
}

/**
 * Soft-fail: records error_message but leaves status = "analyzing"
 * so the cron job retries on the next tick (used for 429 / quota errors).
 */
async function softFailDocumentAnalyze(docId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("documents")
    .update({ error_message: message, updated_at: new Date().toISOString() })
    .eq("id", docId);
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Orchestration layer for the AI explanation generation step.
 *
 * Status machine: analyzing → (cache-hit) ready | (new) ready | (transient) analyzing | (permanent) failed
 *
 * Called by the cron route (Plan 04) and optionally via `after()` from the embed-batch handler.
 * Does NOT add the cron route or `after()` wiring — those land in Plan 04.
 */
export async function runAnalyzeBatch({ docId }: { docId: string }): Promise<{ done: boolean }> {
  // -------------------------------------------------------------------------
  // 1. Read document row
  // -------------------------------------------------------------------------
  const docRes = await supabaseAdmin
    .from("documents")
    .select(
      "id, status, storage_path, total_pages, extraction_source, gemini_file_resource_name, filename",
    )
    .eq("id", docId)
    .maybeSingle();

  if (docRes.error || !docRes.data) return { done: false };
  const doc = docRes.data;

  // -------------------------------------------------------------------------
  // 2. Status gate
  // -------------------------------------------------------------------------
  if (doc.status === "ready") return { done: true };
  if (doc.status !== "analyzing") return { done: true };

  // -------------------------------------------------------------------------
  // 3. Cache check (EXPLAIN-04) — skip Gemini if explanation already exists
  // -------------------------------------------------------------------------
  const cacheRes = await supabaseAdmin
    .from("document_analysis")
    .select("explanation")
    .eq("doc_id", docId)
    .maybeSingle();

  if (!cacheRes.error && cacheRes.data?.explanation != null) {
    await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);
    return { done: true };
  }

  // -------------------------------------------------------------------------
  // 4. Load first-page text for language detection (isIndonesianDoc heuristic)
  // -------------------------------------------------------------------------
  const chunkRes = await supabaseAdmin
    .from("chunks")
    .select("content")
    .eq("doc_id", docId)
    .eq("page_number", 1)
    .order("chunk_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstPageText = chunkRes.data?.content ?? "";

  // -------------------------------------------------------------------------
  // 5. Download PDF bytes (always — needed if Files resource expired/FAILED)
  // -------------------------------------------------------------------------
  const dl = await supabaseAdmin.storage.from("pdfs").download(doc.storage_path);
  if (dl.error || !dl.data) {
    await failDocumentAnalyze(docId, "Could not load PDF for analysis.");
    return { done: false };
  }
  const pdfBytes = new Uint8Array(await dl.data.arrayBuffer());

  // -------------------------------------------------------------------------
  // 6. Generate explanation
  // -------------------------------------------------------------------------
  try {
    const { result, fileResourceName } = await generateExplanation({
      docId,
      pdfBytes,
      filename: doc.filename ?? "document.pdf",
      totalPages: doc.total_pages ?? 0,
      extractionSource: doc.extraction_source,
      fileResourceName: doc.gemini_file_resource_name,
      firstPageText,
    });

    // -----------------------------------------------------------------------
    // 7. Persist file resource name if new (Files API re-uploaded the PDF)
    // -----------------------------------------------------------------------
    if (fileResourceName !== doc.gemini_file_resource_name) {
      await supabaseAdmin
        .from("documents")
        .update({ gemini_file_resource_name: fileResourceName })
        .eq("id", docId);
    }

    // -----------------------------------------------------------------------
    // 8. Upsert explanation — column is jsonb (Plan 02), pass object directly
    // -----------------------------------------------------------------------
    const upsert = await supabaseAdmin
      .from("document_analysis")
      .upsert(
        {
          doc_id: docId,
          explanation: result,
          explanation_at: new Date().toISOString(),
        },
        { onConflict: "doc_id" },
      );

    if (upsert.error) {
      await failDocumentAnalyze(docId, "Could not save explanation. Try again later.");
      return { done: false };
    }

    // -----------------------------------------------------------------------
    // 9. Transition to ready
    // -----------------------------------------------------------------------
    await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);
    return { done: true };
  } catch (err) {
    if (isTransientGeminiError(err)) {
      await softFailDocumentAnalyze(docId, "AI service busy — will retry shortly.");
      return { done: false };
    }
    await failDocumentAnalyze(docId, analyzeFailureUserMessage(err));
    return { done: false };
  }
}
