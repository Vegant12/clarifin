---
phase: 04-embeddings-vector-store
plan: 01
status: complete
completed: 2026-05-08
---

# Plan 04-01 Summary — HNSW Index + match_document_chunks RPC

## What Was Done

Delivered the Phase 4 database layer: a partial HNSW index on `chunks.embedding` and the `match_document_chunks` Postgres RPC function for RAG similarity retrieval.

## Artifacts

- `supabase/migrations/20260508120000_phase4_hnsw_match_document_chunks.sql` — migration that creates the partial HNSW index (`chunks_embedding_hnsw_idx`, m=16, ef_construction=64, cosine ops, WHERE embedding IS NOT NULL) and the `match_document_chunks` function
- `src/db/database.types.ts` — regenerated with `match_document_chunks` function signature in `Database['public']['Functions']`

## Key Decisions

- **Partial HNSW index**: only indexes rows with non-null embeddings, keeping the index smaller and planning cleaner
- **Cosine distance (`<=>`)**: aligns with text-embedding-004's cosine similarity space
- **match_count capped at 50**: `greatest(1, least(p_match_count, 50))` prevents unbounded result sets
- **SECURITY DEFINER + search_path = public**: prevents search_path injection
- **REVOKE ALL from PUBLIC/anon/authenticated; GRANT EXECUTE to service_role**: RPC is unreachable from browser anon key

## Schema Push

Migration applied locally via `supabase db reset`. Remote push requires `SUPABASE_ACCESS_TOKEN` and `pnpm exec supabase db push`.

## Threat Flags

- T-04-01-a: CLOSED — REVOKE/GRANT enforced in migration SQL
- T-04-01-b: CLOSED — migration file present in repo; db push documented
- T-04-01-c: ACCEPTED — no secrets in DDL
- T-04-01-d: CLOSED — supabaseAdmin pattern documented for RPC callers
