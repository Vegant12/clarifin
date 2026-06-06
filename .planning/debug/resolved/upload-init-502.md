---
slug: upload-init-502
status: resolved
trigger: "POST /api/upload-init returns 502 in 1287ms when uploading documents"
created: "2026-05-19"
updated: "2026-05-19"
---

## Symptoms

- endpoint: POST /api/upload-init
- http_status: 502
- latency: 1287ms
- client_error: '{"error":"Could not prepare upload. Try again."}'
- environment: local dev (pnpm dev) connecting to hosted Supabase (vedzschlklbsumvtasgv.supabase.co)
- timeline: was working before, broke recently
- server_logs: only client-side catch message visible — no terminal stack trace pasted

## Current Focus

hypothesis: "The `pdfs` Storage bucket does not exist in the hosted Supabase project. supabase/config.toml defines the bucket for local dev only — it was never created in the remote project."
next_action: "Create the pdfs bucket in the hosted Supabase project via supabase CLI push or Supabase dashboard"

## Evidence

- timestamp: 2026-05-19T00:00:00Z
  finding: "route.ts line 77: `createSignedUploadUrl` returns error -> 502 response with 'Could not prepare upload. Try again.'"
  source: src/app/api/upload-init/route.ts

- timestamp: 2026-05-19T00:01:00Z
  finding: "Direct node test: `client.storage.listBuckets()` returns `[]` (empty) — no buckets exist in hosted project"
  source: manual node script

- timestamp: 2026-05-19T00:02:00Z
  finding: "`createSignedUploadUrl('test-session/test-doc/test.pdf')` returns error: 'The related resource does not exist' (status 404 from Storage API)"
  source: manual node script

- timestamp: 2026-05-19T00:03:00Z
  finding: "supabase/config.toml defines [storage.buckets.pdfs] for local dev only — bucket never pushed to hosted project"
  source: supabase/config.toml

## Eliminated

- env vars missing (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.) — all present in .env.local
- route logic / API signature mismatch — code is correct and matches storage-js@2.105.1 API
- upload-validation throwing — validation layer is fine
- session lookup failing — would return 404 not 502

## Resolution

root_cause: "The `pdfs` Supabase Storage bucket does not exist in the hosted project. The bucket is defined in supabase/config.toml for local dev but was never created in the remote hosted Supabase instance. `createSignedUploadUrl` returns a 404 from the Storage API ('The related resource does not exist'), which the route catches and returns as 502."
fix: "Created the `pdfs` bucket via Supabase JS client (supabaseAdmin.storage.createBucket) with: public=false, fileSizeLimit=20MB, allowedMimeTypes=['application/pdf']. Matches supabase/config.toml spec exactly."
verification: "node script confirmed: listBuckets() now returns ['pdfs']; createSignedUploadUrl returns a valid signed URL without error."
files_changed: "none (infrastructure fix only — bucket created in hosted Supabase project)"
