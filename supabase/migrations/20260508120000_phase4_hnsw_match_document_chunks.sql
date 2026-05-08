-- Phase 4: HNSW index on chunk embeddings (cosine) + RAG RPC match_document_chunks
-- D4-05 / D4-06: partial HNSW excludes rows without embeddings; RPC filters by doc_id only.

-- Partial HNSW: only index rows that already have vectors (smaller index, cleaner planner use).
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON public.chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- RAG similarity: single-document filter; cosine distance (<=>).
-- Consumers (Phase 10): call only from server via service_role + supabaseAdmin.rpc.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  p_doc_id uuid,
  p_query_embedding vector(768),
  p_match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  page_number integer,
  source_page_start integer,
  source_page_end integer,
  section text,
  chunk_type public.chunk_type_enum,
  distance double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.content,
    c.page_number,
    c.source_page_start,
    c.source_page_end,
    c.section,
    c.chunk_type,
    (c.embedding <=> p_query_embedding)::double precision AS distance
  FROM public.chunks c
  WHERE c.doc_id = p_doc_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT greatest(1, least(coalesce(p_match_count, 5), 50));
$$;

REVOKE ALL ON FUNCTION public.match_document_chunks(uuid, vector, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_document_chunks(uuid, vector, integer) FROM anon;
REVOKE ALL ON FUNCTION public.match_document_chunks(uuid, vector, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid, vector, integer) TO service_role;

-- After large embedding backfills, run: ANALYZE public.chunks;
ANALYZE public.chunks;
