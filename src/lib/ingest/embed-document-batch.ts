import "server-only";

import { supabaseAdmin } from "@/db/client";
import { embedTextBatch, vectorToPgString } from "@/lib/embed/gemini-embed";
import { scheduleAnalyzeBatchForDoc } from "@/lib/ingest/trigger-parse-batch";

/** Vercel Hobby wall clock — leave room for Gemini + DB (D4-03). */
export const MAX_EMBED_BATCH_WALL_MS = 52_000;

/** Chunks embedded per invocation before re-checking deadline. */
export const MAX_CHUNKS_PER_RUN = 96;

function embedFailureUserMessage(err: unknown): string {
  const dev = process.env.NODE_ENV === "development";
  if (dev && err instanceof Error && err.message) {
    const m = err.message.trim();
    return m.length > 400 ? `Embedding failed: ${m.slice(0, 400)}…` : `Embedding failed: ${m}`;
  }
  return "Embedding failed. Try uploading again.";
}

async function failDocumentEmbed(docId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("documents")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
    })
    .eq("id", docId);
}

async function countNullEmbeddings(docId: string): Promise<number> {
  const r = await supabaseAdmin
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("doc_id", docId)
    .is("embedding", null);
  if (r.error) {
    return -1;
  }
  return r.count ?? 0;
}

export async function runEmbedBatch({ docId }: { docId: string }): Promise<{ done: boolean }> {
  const deadline = Date.now() + MAX_EMBED_BATCH_WALL_MS;

  const docRes = await supabaseAdmin
    .from("documents")
    .select("id, status, storage_path")
    .eq("id", docId)
    .maybeSingle();

  if (docRes.error || !docRes.data) {
    return { done: false };
  }

  if (docRes.data.status !== "embedding") {
    return { done: true };
  }

  while (Date.now() <= deadline) {
    const rowsRes = await supabaseAdmin
      .from("chunks")
      .select("id, content, chunk_index")
      .eq("doc_id", docId)
      .is("embedding", null)
      .order("chunk_index", { ascending: true })
      .limit(MAX_CHUNKS_PER_RUN);

    if (rowsRes.error) {
      await failDocumentEmbed(docId, "Could not read chunks for embedding.");
      return { done: false };
    }

    const rows = rowsRes.data ?? [];
    if (rows.length === 0) {
      const remaining = await countNullEmbeddings(docId);
      if (remaining === 0) {
        await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", docId);
        scheduleAnalyzeBatchForDoc(docId);

        // INFRA-04: delete raw PDF from Storage after all chunks confirmed embedded.
        // Best-effort: a Storage error does NOT roll back embedding work — the doc
        // has already transitioned to "analyzing" and the analyze cron will run.
        // Logged via console.warn so orphan PDFs are detectable in Vercel logs.
        if (docRes.data?.storage_path) {
          await supabaseAdmin.storage
            .from("pdfs")
            .remove([docRes.data.storage_path])
            .catch((err) => {
              console.warn(`[embed-batch] PDF cleanup failed for doc ${docId}:`, err);
            });
        }

        return { done: true };
      }
      if (remaining < 0) {
        await failDocumentEmbed(docId, "Could not verify embedding progress.");
        return { done: false };
      }
      // remaining > 0 but no rows returned — likely a race; signal not done so caller retries.
      return { done: false };
    }

    // Check deadline BEFORE issuing the batch, not inside it.
    if (Date.now() > deadline) {
      return { done: false };
    }

    let vectors: number[][];
    try {
      vectors = await embedTextBatch(rows.map((r) => r.content));
    } catch (err) {
      await failDocumentEmbed(docId, embedFailureUserMessage(err));
      return { done: false };
    }

    if (vectors.length !== rows.length) {
      await failDocumentEmbed(docId, "Embedding service returned an unexpected response.");
      return { done: false };
    }

    // Update all vectors — deadline is already checked above so no mid-batch exit.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as NonNullable<(typeof rows)[number]>;
      const vec = vectors[i] as number[];
      const up = await supabaseAdmin
        .from("chunks")
        .update({ embedding: vectorToPgString(vec) })
        .eq("id", row.id)
        .eq("doc_id", docId);
      if (up.error) {
        await failDocumentEmbed(docId, "Could not save embeddings. Try again later.");
        return { done: false };
      }
    }

    const afterCount = await countNullEmbeddings(docId);
    if (afterCount === 0) {
      await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", docId);
      scheduleAnalyzeBatchForDoc(docId);

      // INFRA-04: delete raw PDF from Storage after all chunks confirmed embedded.
      // Best-effort: a Storage error does NOT roll back embedding work — the doc
      // has already transitioned to "analyzing" and the analyze cron will run.
      // Logged via console.warn so orphan PDFs are detectable in Vercel logs.
      if (docRes.data?.storage_path) {
        await supabaseAdmin.storage
          .from("pdfs")
          .remove([docRes.data.storage_path])
          .catch((err) => {
            console.warn(`[embed-batch] PDF cleanup failed for doc ${docId}:`, err);
          });
      }

      return { done: true };
    }
    if (afterCount < 0) {
      await failDocumentEmbed(docId, "Could not verify embedding progress.");
      return { done: false };
    }
  }

  return { done: false };
}
