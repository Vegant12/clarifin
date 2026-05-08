import "server-only";

import { supabaseAdmin } from "@/db/client";
import { embedQueryText, vectorToPgString } from "@/lib/embed/gemini-embed";

/** Row shape from `public.match_document_chunks` (Phase 4 RAG). */
export type MatchedChunkRow = {
  id: string;
  content: string;
  page_number: number;
  source_page_start: number;
  source_page_end: number;
  section: string | null;
  chunk_type: "prose" | "table" | "heading" | "list";
  distance: number;
};

/**
 * Embed a natural-language question and retrieve top‑K similar chunks for one document (D4‑06).
 * Server-only: uses service_role RPC grants.
 */
export async function matchDocumentChunks(args: {
  docId: string;
  query: string;
  matchCount?: number;
}): Promise<MatchedChunkRow[]> {
  const vec = await embedQueryText(args.query);
  const p_query_embedding = vectorToPgString(vec);

  const { data, error } = await supabaseAdmin.rpc("match_document_chunks", {
    p_doc_id: args.docId,
    p_query_embedding,
    p_match_count: args.matchCount ?? 5,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    page_number: row.page_number,
    source_page_start: row.source_page_start,
    source_page_end: row.source_page_end,
    section: row.section ?? null,
    chunk_type: row.chunk_type,
    distance: row.distance,
  }));
}
