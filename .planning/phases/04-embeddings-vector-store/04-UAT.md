---
status: complete
phase: 04-embeddings-vector-store
source: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md]
started: 2026-05-10T00:00:00Z
updated: 2026-05-10T11:38:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Test suite passes (Phase 4)
expected: Running `pnpm test` executes all Phase 4 Vitest suites — gemini-embed.test.ts, embed-document-batch.test.ts, embed-batch route test, and match-document-chunks.test.ts — all passing with no live network calls (all Gemini/Supabase calls are mocked).
result: pass

### 2. Type-check passes
expected: Running `pnpm typecheck` exits 0 with no errors. `src/db/database.types.ts` contains the `match_document_chunks` function signature (not `[_ in never]: never`).
result: pass

### 3. Migration file exists and is correct
expected: `supabase/migrations/20260508120000_phase4_hnsw_match_document_chunks.sql` exists and contains both the HNSW index creation (`chunks_embedding_hnsw_idx`) and the `match_document_chunks` function with proper REVOKE/GRANT statements for `service_role` only.
result: pass

### 4. Embed-batch route rejects without secret
expected: A request to `/api/internal/embed-batch` without the `INTERNAL_ROUTE_SECRET` header returns HTTP 401. The route never processes unauthenticated requests.
result: pass

### 5. RAG retrieval wrapper compiles and is server-only
expected: `src/lib/rag/match-document-chunks.ts` starts with `import "server-only"` and exports `matchDocumentChunks(docId, query, matchCount?)`. Running `pnpm typecheck` confirms the type signature matches the `match_document_chunks` RPC.
result: pass

### 6. Perf smoke script exists
expected: `scripts/smoke-vector-perf.ts` exists and contains instructions / code for seeding vectors and timing similarity search. The file is runnable (no compile errors via `pnpm typecheck`).
result: pass

### 7. Embed pipeline wires into parse completion
expected: After `parse-batch` completes for a document, `scheduleEmbedBatchesForDoc` is called and the document status transitions to `embedding`. This is verifiable by code inspection — `src/lib/ingest/embed-document-batch.ts` or the parse orchestrator references `scheduleEmbedBatchesForDoc`.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
