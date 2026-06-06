# Phase 11: Observability & Reliability - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Instrument all LLM calls with Langfuse tracing and prompt versioning (OBS-01, OBS-02), protect free-tier limits with a concurrency cap on LLM processing jobs (INFRA-03), delete raw PDFs from Supabase Storage after successful embedding (INFRA-04), and run a weekly keep-alive cron to prevent Supabase inactivity pause (INFRA-05).

No new user-facing features. This phase hardens the backend before public launch.

</domain>

<decisions>
## Implementation Decisions

### Langfuse Client Initialization
- **D-01:** Create a shared singleton at `src/lib/langfuse.ts` that exports a pre-configured `Langfuse` client using env vars (`LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_HOST`). All call sites import from this file. Mirrors the existing Supabase admin client pattern in `src/db/client.ts`.

### Langfuse Wiring — GoogleGenAI calls (explanation + score)
- **D-02:** Use manual trace/generation spans. Call `langfuse.trace()` to open a trace and `trace.generation()` before/after each `@google/genai` call. Call sites: `src/lib/explain/generate-explanation.ts` and `src/lib/explain/generate-score.ts`.

### Langfuse Wiring — Vercel AI SDK calls (chat + starter questions)
- **D-03:** Use `onFinish` callback integration. Open a Langfuse generation before calling `streamText`, then close it inside the `onFinish` callback (which already fires with token usage in `src/app/api/chat/route.ts`). Call sites: `src/app/api/chat/route.ts` and `src/app/api/starter-questions/route.ts`.

### Trace Metadata
- **D-04:** Every Langfuse trace captures ALL of the following:
  - **Input prompt + output** — full prompt string and raw model response
  - **Latency + token counts** — wall-clock duration, input token count, output token count
  - **Document ID + phase tag** — `doc_id` and a string identifying the pipeline step (`"explanation"`, `"score"`, `"chat"`, `"starter-questions"`)
  - **Model ID + settings** — which Gemini/Groq model variant was called and relevant generation config

### Prompt Versioning
- **D-05:** Prompts stay in code (`src/lib/explain/explain-prompts.ts`, `score-prompts.ts`, `src/lib/prompts.ts`). No prompts move to Langfuse.
- **D-06:** Each Langfuse trace includes `process.env.VERCEL_GIT_COMMIT_SHA` as a metadata tag. Vercel sets this automatically on every deploy. Combined with the full prompt in the trace input, any regression can be attributed to a specific commit (and git diff shows the prompt change). For local dev where `VERCEL_GIT_COMMIT_SHA` is not set, tag as `"local"`.

### Claude's Discretion
- **Concurrency cap (INFRA-03):** Claude decides the mechanism. The pipeline runs in Vercel serverless (independent invocations), so p-limit won't span invocations. A DB-level counter/semaphore in Supabase (e.g., `active_processing_count` on a `pipeline_state` table, or checking count of `documents` with `status = 'processing'`) is the natural cross-process approach. Cap at ≤2 concurrent. The third job should queue (not fail) if feasible; otherwise fail gracefully with a retriable error.
- **PDF cleanup timing (INFRA-04):** Claude decides exactly where the `supabase.storage.from('pdfs').remove()` call goes. The natural anchor is `embed-document-batch.ts` after all chunks are confirmed written to pgvector. On partial failure, the raw PDF should be preserved (not deleted) so reprocessing is possible.
- **Vercel Cron keep-alive (INFRA-05):** Claude decides the endpoint path and ping strategy. A lightweight `GET /api/cron/keep-alive` route that runs a trivial Supabase query (`SELECT 1`) is the standard pattern. Weekly schedule is sufficient per ROADMAP.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Requirements
- `.planning/REQUIREMENTS.md` §OBS-01, OBS-02, INFRA-03, INFRA-04, INFRA-05 — Acceptance criteria for all five requirements this phase delivers

### Codebase Integration Points
- `src/lib/explain/generate-explanation.ts` — Primary LLM call site for explanation generation (GoogleGenAI, D-02)
- `src/lib/explain/generate-score.ts` — LLM call site for scoring (GoogleGenAI, D-02)
- `src/app/api/chat/route.ts` — Streaming LLM call site (Vercel AI SDK, D-03); already has `onFinish` callback at line 132+
- `src/app/api/starter-questions/route.ts` — Non-streaming LLM call (Vercel AI SDK, D-03); has `// Plan 11 will trace this via Langfuse` comment
- `src/db/client.ts` — Supabase admin client pattern to mirror for Langfuse singleton (D-01)
- `src/lib/ingest/embed-document-batch.ts` — Where PDF cleanup (INFRA-04) should anchor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/client.ts`: Singleton Supabase admin client — exact same pattern to follow for `src/lib/langfuse.ts`
- `src/app/api/chat/route.ts` line ~132+: Already has `onFinish` callback wiring for chat persistence — Langfuse close call slots in here naturally
- `src/app/api/upload-complete/route.ts` line ~70: Already calls `supabase.storage.from('pdfs').remove()` for invalid uploads — the post-embed cleanup (INFRA-04) uses the same call

### Established Patterns
- `"langfuse": "^3.38.20"` is already in `package.json` — no install needed
- Two distinct LLM SDK patterns in codebase: `@google/genai` (direct) for batch ingest; Vercel AI SDK for streaming/interactive routes
- Environment variables follow `src/lib/env.ts` t3-env pattern — `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_HOST` should be added there

### Integration Points
- Langfuse traces hook into the existing ingest pipeline at `analyze-document-batch.ts` → `generate-explanation.ts` / `generate-score.ts`
- Vercel Cron integrates via `vercel.json` cron config + a new API route
- Concurrency cap integrates before the LLM call is initiated in the processing pipeline

</code_context>

<specifics>
## Specific Ideas

- The `VERCEL_GIT_COMMIT_SHA` prompt versioning approach (D-06) is intentionally lightweight — the goal is regression attribution, not prompt management UI. If prompt management becomes important in v2, Langfuse native prompts can be adopted then.
- The `onFinish` callback integration (D-03) is preferred because `chat/route.ts` already uses `onFinish` for persisting chat messages — Langfuse close call co-locates with existing post-stream logic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-observability-reliability*
*Context gathered: 2026-05-23*
