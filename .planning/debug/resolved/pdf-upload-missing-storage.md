---
status: resolved
trigger: |
  PDF upload silently fails — files don't reach the Supabase Storage "pdfs" bucket
  even though the client-side uploadToSignedUrl reports success and /api/upload-complete
  passes. The parse batch then fails to download the PDF, surfacing "Could not upload
  pdf for analysis" (paraphrase of the user-facing parse-failure error_message).
created: 2026-05-25
updated: 2026-05-26
resolved: 2026-05-26
root_cause: |
  INFRA-04 (embed-document-batch.ts) intentionally deleted the raw PDF from Storage
  once all chunks were embedded — a Phase-4 free-tier 1 GB optimization. Phase 7
  later added the PDF viewer in the doc-page, which calls createSignedUrl on the
  same storage_path. The cleanup ran ~1 minute after upload; opening the doc page
  immediately after that produced "Object not found". Every upload completed end
  to end; the file was destroyed by design.
fix: |
  Removed both .remove() blocks from runEmbedBatch in
  src/lib/ingest/embed-document-batch.ts. Added a regression-guard test that
  asserts storage.remove() is never called from runEmbedBatch.
verification: |
  Instrumented upload-complete with info() + createSignedUrl probes (commit
  6a3156b). User reproduced fresh upload; logs showed info().size = 3120654
  and createSignedUrl probe ok at upload-complete time, then "Object not
  found" at doc-page time AFTER the analyze batch completed — proving the
  delete happened in between. Fixed in commit b8a808b.
files_changed:
  - src/lib/ingest/embed-document-batch.ts
  - src/lib/ingest/__tests__/embed-document-batch-cleanup.test.ts
commit: b8a808b
---

# Debug Session: pdf-upload-missing-storage

## Symptoms

- **Expected:** Fresh PDF upload → file lands in `pdfs` bucket → parse batch downloads it → document reaches `status="ready"` with usable signed URL.
- **Actual:** Fresh PDF upload → documents row created with `storage_path` → upload-complete returns ok → parse batch fails with "Could not download the PDF" → document ends in `status="failed"` with user-facing error "Parsing failed. Try uploading again or use a different file." (paraphrased by user as "Could not upload pdf for analysis"). The doc-page later logs `[doc-page] createSignedUrl failed <doc_id> [Error [StorageApiError]: Object not found] status 400 statusCode 404`.
- **Errors:** Server log: `[doc-page] createSignedUrl failed ae775c82-1b2d-4e56-81a2-bc7eb4a18865 [Error [StorageApiError]: Object not found] status 400 statusCode 404`. UI message: "Could not upload pdf for analysis" (paraphrase of parse-failed error_message).
- **Timeline:** Reproduced on a fresh upload AFTER commit 69581f1 (which added a createSignedUrl pre-check to upload-complete). The fix did not prevent the failure.
- **Repro:** Open the app, upload any PDF from the homepage dropzone, wait for analysis. Hits parse-failed terminal state.

## Current Focus

- **hypothesis (revised):** The upload silently fails between the browser's `uploadToSignedUrl` and the Supabase Storage backend, AND the verification check in `/api/upload-complete` doesn't catch it. Two possibilities are now in play and need to be confirmed in this order:
  1. **Bucket misconfiguration on the hosted project** (`vedzschlklbsumvtasgv.supabase.co`) — the `pdfs` bucket may not exist, may not have `allowed_mime_types = ["application/pdf"]` set, or may have a smaller `file_size_limit` than 20 MiB. There is **NO migration** that creates the bucket; `supabase/config.toml`'s `[storage.buckets.pdfs]` block only configures local Supabase and is NOT applied to remote/hosted projects. If a bucket exists on the dashboard with a permissive config but a different MIME constraint, the storage server may accept the signed PUT but reject the actual byte payload, returning a success-shape response — which `uploadToSignedUrl`'s `data` object (currently discarded by the client at pdf-dropzone.tsx:79) might surface in a non-error field.
  2. **Race / missing existence check** — even after `upload-complete`'s `createSignedUrl` check passes, the object may not be the same one referenced later. `createSignedUrl` at `/object/sign/{path}` DOES return 404 server-side for missing objects (confirmed by the doc-page log showing `Object not found, status 400, statusCode 404` from the same method), so the check should work IF the object is genuinely missing at upload-complete time. The fact that the user still hits parse failure suggests either (a) at upload-complete time the object briefly exists then is deleted, OR (b) `createSignedUrl` somehow does NOT 404 when called with the service-role key against the same path that fails for the anon role later. The latter is unlikely — service-role bypasses RLS but cannot fabricate metadata for a missing object.

- **test:** Run BOTH in parallel:
  - **Diagnostic A (user-side, dashboard):** Open Supabase dashboard for project `vedzschlklbsumvtasgv` → Storage → confirm bucket `pdfs` exists and inspect its file_size_limit, allowed_mime_types, public flag. Also look at the bucket contents for the most recent failed `doc_id` (`ae775c82-1b2d-4e56-81a2-bc7eb4a18865`) and check whether the directory `<session_id>/ae775c82.../` exists at all.
  - **Diagnostic B (code-side):** Replace the current `createSignedUrl` check in `/api/upload-complete` with **`storage.from("pdfs").info(storage_path)`** (better) or **`exists(storage_path)`**. `info()` returns object metadata including `size` — confirms bytes were actually persisted. `exists()` does a HEAD. Both will 404 cleanly for missing objects. Also: stop discarding `uploadToSignedUrl`'s returned `data` in `pdf-dropzone.tsx:72-81` — log it so we can see what the storage server is reporting.

- **expecting:**
  - If hypothesis 1: dashboard will show bucket `pdfs` either does not exist, or has restrictive mime/size config that doesn't match `config.toml`. After fix (provision bucket with correct config via dashboard or a SQL migration), `info()` returns 200 with size>0.
  - If hypothesis 2: dashboard shows the bucket exists and the directory is empty. `info()` after upload returns 404 immediately. Then root cause is in the storage server's handling of the signed PUT — needs network-level inspection (browser DevTools → Network tab → look at the PUT to `/storage/v1/object/upload/sign/...` for response status and body).

- **next_action:** Apply code-level Diagnostic B (replace `createSignedUrl` with `info`/`exists`, log `uploadToSignedUrl` response) and ask the user for Diagnostic A (dashboard inspection + browser DevTools Network tab capture during a fresh upload).

## Evidence

- timestamp: 2026-05-25 — diagnostic console.error in src/app/doc/[documentId]/page.tsx (added in commit 466c6c0) revealed the underlying error: `StorageApiError: Object not found, status 400, statusCode 404`. Confirms the `documents` row references a `storage_path` that has no corresponding object in the `pdfs` bucket.
- timestamp: 2026-05-25 — User reports fresh upload (after fix 69581f1 is deployed) still produces the same downstream parse failure.
- timestamp: 2026-05-25 — src/components/upload/pdf-dropzone.tsx:71-81 calls `supabase.storage.from("pdfs").uploadToSignedUrl(init.path, init.token, file, { contentType: "application/pdf", upsert: false })` and only checks `uploadError` — it does not verify the returned response data.
- timestamp: 2026-05-25 — **Code review of supabase-js v2.105.1 (`node_modules/.pnpm/@supabase+storage-js@2.105.1/.../StorageFileApi.ts:667-714`)**: `createSignedUrl(path, expiresIn)` posts to `/object/sign/{path}` server-side. The doc-page log line proves this endpoint DOES 404 for missing objects (the original `[doc-page] createSignedUrl failed` line came from this method). So the current upload-complete check at `route.ts:66-89` is NOT a no-op — it should be catching missing objects. The fact that the user still hits parse-failure after deploying 69581f1 means either (a) the object exists at upload-complete time but is gone by parse-batch time, or (b) the deployed code isn't the version with the check, or (c) the check passes against a different code path.
- timestamp: 2026-05-25 — **Bucket provisioning gap**: `grep -RIn "bucket\|storage\." supabase/migrations/*.sql` returns ZERO matches. The `[storage.buckets.pdfs]` block at `supabase/config.toml:96-99` is local-only — Supabase does not apply config.toml settings to remote/hosted projects via `db push` or migrations. The bucket on `vedzschlklbsumvtasgv.supabase.co` was either created manually via dashboard or doesn't exist. If it was created manually, its file_size_limit and allowed_mime_types may differ from `config.toml`. This is a strong candidate for the silent upload failure.
- timestamp: 2026-05-25 — **`uploadToSignedUrl` response**: `StorageFileApi.ts:257-324` returns `{ path, fullPath: data.Key }` on success. The `put` helper (`lib/common/fetch.ts:225-233`) goes through `_handleRequest` which throws on non-2xx — so genuine 4xx responses WOULD set `uploadError`. If the storage server is returning 2xx without persisting bytes (e.g., empty body accepted, or signed-URL token replay), `uploadError` stays null and the client moves on. The returned `data.Key` would still be populated.
- timestamp: 2026-05-25 — **Better verification primitives exist**: `StorageFileApi.ts:918-937` has `info(path)` which GETs `/object/info/{path}` and returns size/lastModified. `StorageFileApi.ts:954-985` has `exists(path)` which does a HEAD. Either is a stronger check than `createSignedUrl` because they read object metadata rather than asking the signing service.

## Eliminated

- **`createSignedUrl` is a no-op for existence checking** — ELIMINATED. Code review of supabase-js v2.105.1 plus the existing `[doc-page] createSignedUrl failed ... statusCode 404` log line prove this method DOES 404 for missing objects. The original hypothesis was wrong.

## Files of interest

- src/app/api/upload-init/route.ts — creates documents row, builds storage_path, generates signed upload URL via `storage.from("pdfs").createSignedUploadUrl(storage_path)`
- src/app/api/upload-complete/route.ts:66-89 — current verification (works but could be stronger; use `info()` instead)
- src/components/upload/pdf-dropzone.tsx:71-81 — browser uploadToSignedUrl call; discards return value
- src/lib/ingest/parse-document-batch.ts:71-75 — where the download failure is detected
- supabase/config.toml:96-99 — declares bucket config for local only; NOT applied to hosted project
- supabase/migrations/*.sql — no bucket creation migration; gap in provisioning of the hosted project
