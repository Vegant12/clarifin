---
phase: 04-embeddings-vector-store
plan: 04
status: complete
completed: 2026-05-08
---

# Plan 04-04 Summary — Schedule Embed Batches + Parse→Embedding Hook

## What Was Done

Wired `scheduleEmbedBatchesForDoc` into `trigger-parse-batch.ts` and the embed-batch route's chaining logic, completing the automatic parse → embedding pipeline trigger.

## Artifacts

- `src/lib/ingest/trigger-parse-batch.ts` — added `scheduleEmbedBatchesForDoc` export (uses `after()` with `Authorization: Bearer` header)
- `src/app/api/internal/embed-batch/route.ts` — chains next batch via `scheduleEmbedBatchesForDoc` when `done: false`
- `src/lib/ingest/parse-document-batch.ts` — calls `scheduleEmbedBatchesForDoc(docId)` after parse completes

## Key Decisions

- **`after()` with Bearer header** (not `?secret=`): fire-and-forget server-to-server call avoids leaking the secret in access logs; `?secret=` reserved for Vercel Cron GET requests
- **Shared `INTERNAL_PARSE_SECRET`**: embed-batch reuses parse-batch secret — one fewer env var to manage
- **Test guard**: `if (process.env.NODE_ENV === "test") return;` prevents `after()` calls in Vitest
- **`getInternalAppBaseUrl()`**: resolves `CLARIFIN_APP_URL → VERCEL_URL → localhost:3000`; no user input reaches URL construction

## Pipeline Flow

```
upload-complete → parse-batch (after()) → parse-document-batch 
→ scheduleEmbedBatchesForDoc(after()) → embed-batch 
→ runEmbedBatch loop → done: false → scheduleEmbedBatchesForDoc → ...
→ done: true → status: analyzing
```

## Threat Flags

- T-04-04-a: CLOSED — Bearer header used for after(); ?secret= only for cron GET
- T-04-04-b: CLOSED — cron uses ?secret= matching INTERNAL_PARSE_SECRET
- T-04-04-c: ACCEPTED — getInternalAppBaseUrl() reaches only operator-controlled URLs
- T-04-04-d: CLOSED — doc_id from trusted runEmbedBatch result, UUID-validated
