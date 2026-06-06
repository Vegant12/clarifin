---
phase: 04-embeddings-vector-store
plan: 03
status: complete
completed: 2026-05-08
---

# Plan 04-03 Summary — Embed Document Batch Orchestrator + Route

## What Was Done

Implemented the embedding batch orchestrator (`runEmbedBatch`) and the `/api/internal/embed-batch` route handler that processes chunks in deadline-aware loops within Vercel Hobby's 60s function limit.

## Artifacts

- `src/lib/ingest/embed-document-batch.ts` — server-only orchestrator with deadline loop
- `src/app/api/internal/embed-batch/route.ts` — internal POST/GET route with secret auth
- `src/app/api/internal/embed-batch/embed-batch.test.ts` — Vitest suite (1 test, 401 on missing secret)

## Key Decisions

- **Deadline-aware loop**: `MAX_EMBED_BATCH_WALL_MS = 52_000ms` leaves buffer for Gemini + DB within Vercel's 60s limit; processes `MAX_CHUNKS_PER_RUN = 96` chunks per iteration
- **Status transitions**: `embedding → analyzing` when all chunks have non-null embeddings; `embedding → failed` on any unrecoverable error
- **Partial progress**: returns `{ done: false }` when deadline reached; route chains next batch via `scheduleEmbedBatchesForDoc` using `after()`
- **Auth**: `timingSafeEqual` on `INTERNAL_PARSE_SECRET` (same secret as parse-batch); accepts both `Authorization: Bearer` header and `?secret=` query param (for Vercel Cron GET)
- **doc_id pick**: when no `doc_id` provided, picks oldest `status='embedding'` document (Vercel Cron mode)

## Threat Flags

- T-04-03-a: CLOSED — timingSafeEqual on secret in route
- T-04-03-b: CLOSED — server-only import; supabaseAdmin pattern
- T-04-03-c: CLOSED — all queries filter by doc_id; cron picks by status only
- T-04-03-d: CLOSED — GEMINI_API_KEY accessed only via embed helper indirection
