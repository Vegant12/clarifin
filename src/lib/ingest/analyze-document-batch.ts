import "server-only";

import { supabaseAdmin } from "@/db/client";
import { generateExplanation } from "@/lib/explain/generate-explanation";
import { generateScore, type GenerateScoreResult } from "@/lib/explain/generate-score";

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
      totalPages: doc.total_pages ?? 200, // 200 is a conservative upper bound for IDX reports
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
    // 8b. Score generation (D-01: same cron tick, sequential after explanation)
    // -----------------------------------------------------------------------
    // D-03: cache gate — skip if already scored.
    // Select score_breakdown (not score) so the gate correctly detects a partial write
    // where score was persisted but score_breakdown was not (e.g. earlier schema migration).
    const scoreCacheRes = await supabaseAdmin
      .from("document_analysis")
      .select("score_breakdown")
      .eq("doc_id", docId)
      .maybeSingle();

    if (!scoreCacheRes.error && scoreCacheRes.data?.score_breakdown == null) {
      // D-05: 1 retry on ZodError (2 total attempts). Other errors break immediately.
      let scoreGenResult: GenerateScoreResult | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          scoreGenResult = await generateScore({
            docId,
            pdfBytes,
            filename: doc.filename ?? "document.pdf",
            totalPages: doc.total_pages ?? 200,
            extractionSource: doc.extraction_source,
            fileResourceName: fileResourceName, // reuse explanation step's resource name (D-13 Phase 6 carry-over)
            firstPageText,
          });
          break;
        } catch (err) {
          const isZodError = err instanceof Error && err.name === "ZodError";
          if (!isZodError || attempt === 2) {
            console.error(`[analyze-batch] score attempt ${attempt} failed:`, err);
            break;
          }
          console.warn(`[analyze-batch] score Zod parse failed attempt ${attempt}, retrying…`);
        }
      }

      // D-02: soft-fail — upsert only if we got a result; document still transitions to ready below.
      if (scoreGenResult) {
        // WR-02: persist the score step's fileResourceName if it differs from the explanation
        // step's resource name (happens when the FAILED/expired resource was re-uploaded).
        if (scoreGenResult.fileResourceName !== fileResourceName) {
          await supabaseAdmin
            .from("documents")
            .update({ gemini_file_resource_name: scoreGenResult.fileResourceName })
            .eq("id", docId);
        }

        const scoreUpsert = await supabaseAdmin
          .from("document_analysis")
          .upsert(
            {
              doc_id: docId,
              score: scoreGenResult.result.overall_score,
              score_breakdown: scoreGenResult.result,
              score_at: new Date().toISOString(),
            },
            { onConflict: "doc_id" },
          );
        if (scoreUpsert.error) {
          console.error(`[analyze-batch] score upsert failed:`, scoreUpsert.error);
          // D-02: do not hard-fail; score column simply stays null
        }
      }
    }
    // ---- End Step 8b ----

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
