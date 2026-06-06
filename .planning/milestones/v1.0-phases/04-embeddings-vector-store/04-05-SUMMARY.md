---
phase: 04-embeddings-vector-store
plan: 05
status: complete
completed: 2026-05-08
---

# Plan 04-05 Summary — RAG Retrieval Wrapper + Perf Smoke Script

## What Was Done

Implemented the `matchDocumentChunks` server-only RAG helper and the `scripts/smoke-vector-perf.ts` performance validation script. Phase 4 UAT confirmed all deliverables working.

## Artifacts

- `src/lib/rag/match-document-chunks.ts` — server-only RAG wrapper with `matchDocumentChunks(docId, query, matchCount?)`
- `src/lib/rag/match-document-chunks.test.ts` — Vitest suite (2 tests: successful retrieval + RPC error propagation)
- `scripts/smoke-vector-perf.ts` — destructive local smoke: seeds ~10K vectors, times one `match_document_chunks` call, then cascades-deletes the test document

## Key Decisions

- **`embedQueryText` + `vectorToPgString`**: query embedded and formatted before RPC call; keeps RPC invocation type-safe
- **`MatchedChunkRow` type**: explicit shape with all citation metadata (`page_number`, `source_page_start`, `source_page_end`, `section`, `chunk_type`) — ready for Phase 6 explanation generation and Phase 10 chat
- **Default matchCount = 5**: RAG returns top-5 chunks unless caller overrides (max 50 enforced at DB)
- **Smoke script**: `pnpm exec tsx scripts/smoke-vector-perf.ts` — requires local Supabase running; reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`; target latency < 500ms for 10K vectors

## Phase 4 UAT Results

All 7 checks passed (2026-05-10):
1. Test suite — 40 tests, 12 files, all green
2. Typecheck — exit 0, match_document_chunks in generated types
3. Migration — HNSW index + RPC + grants verified
4. Embed-batch auth — 401 without secret confirmed
5. RAG wrapper — server-only, correct signature
6. Perf smoke script — exists and compiles
7. Pipeline wiring — scheduleEmbedBatchesForDoc called from parse-document-batch

## Threat Flags

- T-04-05-a: CLOSED — p_doc_id passed from args.docId; RPC enforces WHERE filter
- T-04-05-b: CLOSED — no HTTP handler; server-only import
- T-04-05-c: CLOSED — no logging of query text in production path
- T-04-05-d: CLOSED — import "server-only" + supabaseAdmin
