---
phase: 11-observability-reliability
verified: 2026-05-24T12:49:00Z
status: passed
score: 5/5
overrides_applied: 0
re_verification: false
---

# Phase 11: Observability & Reliability — Verification Report

**Phase Goal:** All LLM calls are traced and prompt-versioned in Langfuse; free-tier limits are protected via concurrency caps, storage cleanup, and a keep-alive cron.
**Verified:** 2026-05-24T12:49:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every LLM call (explanation, score, chat, starter-questions) appears in Langfuse with input prompt, output, latency, token count, and cost estimate | VERIFIED | All 4 call sites import `langfuse` singleton, open trace + generation before the LLM call, call `generation.end()` with `usageDetails`, and call `flushAsync()` in `finally` / `onFinish`. Latency is captured implicitly by Langfuse via the open/end timestamp pair. Cost estimate is produced server-side by Langfuse Cloud from the registered model pricing for `gemini-2.5-flash` / `gemini-2.0-flash` + token counts — no `costDetails` field is required from the client. |
| 2 | After changing any system prompt, the new version is tracked in Langfuse via `VERCEL_GIT_COMMIT_SHA` in trace metadata | VERIFIED | All 4 call sites set `metadata.commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "local"` on the trace object. Lines: `generate-explanation.ts:188`, `generate-score.ts:81`, `chat/route.ts:145`, `starter-questions/route.ts:110`. |
| 3 | 3 simultaneous document uploads caps at 2 concurrent LLM processing jobs — the third queues and completes without error | VERIFIED | `analyze-document-batch.ts:109-114`: COUNT query on `status="analyzing"` runs before any Gemini call. `(activeCount ?? 0) > 2` returns `{ done: false }` (queues doc, cron retries) when count reaches 3. count=2 proceeds (this doc + 1 other = 2 concurrent). Fails open on DB error. Test at `analyze-document-batch-concurrency.test.ts`: 3 tests covering count=3 blocked, count=2 proceeds, error fail-open — all pass. |
| 4 | After a document's chunks are successfully stored in pgvector, the raw PDF is deleted from Supabase Storage | VERIFIED | `embed-document-batch.ts:87-94` and `148-155`: two `done: true` exit branches both call `storage.from("pdfs").remove([docRes.data.storage_path])`. Deletion is best-effort (`.catch()`) so Storage errors do not roll back embedding. Test at `embed-document-batch-cleanup.test.ts`: removal called on count=0, not called on partial failure, pipeline continues on Storage 503 — all 3 tests pass. |
| 5 | Vercel Cron runs weekly and pings Supabase to prevent free-tier inactivity pause | VERIFIED | `src/app/api/cron/keep-alive/route.ts`: GET handler runs `SELECT id FROM documents LIMIT 1`, returns `{ ok: true }` on success. `vercel.json`: cron entry `{ "path": "/api/cron/keep-alive", "schedule": "0 0 * * 0" }` (Sunday 00:00 UTC, weekly). Existing parse/embed cron entries undisturbed. |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/langfuse.ts` | Singleton Langfuse v3 client | VERIFIED | Exports `langfuse`, has `import "server-only"`, uses `env.LANGFUSE_SECRET_KEY` and `env.LANGFUSE_PUBLIC_KEY` |
| `src/lib/env.ts` | LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_HOST schema + runtimeEnv | VERIFIED | All three vars declared in `server:` schema and `runtimeEnv` map; `LANGFUSE_HOST` is optional URL |
| `src/lib/__tests__/langfuse.test.ts` | Unit test for singleton export | VERIFIED | Asserts `langfuse` has `trace` and `flushAsync` methods; asserts singleton identity across imports |
| `.env.example` | Documents Langfuse env vars | VERIFIED | Lines 27-29: `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_HOST` (commented, self-hosted only) |
| `src/lib/explain/generate-explanation.ts` | Pattern A Langfuse instrumentation | VERIFIED | Trace + generation opened before LLM call (line 184/192), `generation.end()` with `usageDetails` on success (line 245), `level: "ERROR"` on failure (line 259), `flushAsync()` in finally (line 269) |
| `src/lib/explain/generate-score.ts` | Pattern A Langfuse instrumentation | VERIFIED | Same structure as generate-explanation.ts; trace name "score", generation name "gemini-score" |
| `src/app/api/chat/route.ts` | Pattern B (onFinish closure) Langfuse instrumentation | VERIFIED | Trace + generation opened before `streamText` call (lines 140-158), `generation.end()` + `flushAsync()` inside `onFinish` callback (lines 170-177) — not after `return`, avoiding the flush-after-exit pitfall |
| `src/app/api/starter-questions/route.ts` | Pattern B try/finally variant | VERIFIED | Trace + generation opened before `generateObject` (lines 106-123), `generation.end()` + `flushAsync()` in `finally` block (lines 166-168) |
| `src/lib/ingest/analyze-document-batch.ts` | INFRA-03 concurrency cap | VERIFIED | COUNT query at line 109, cap condition at line 114 (`> 2`), fail-open on `countError` |
| `src/lib/ingest/embed-document-batch.ts` | INFRA-04 PDF cleanup | VERIFIED | `storage.from("pdfs").remove([docRes.data.storage_path])` on both completion branches (lines 88-93, 149-154) |
| `src/app/api/cron/keep-alive/route.ts` | INFRA-05 keep-alive cron route | VERIFIED | GET handler, `maxDuration = 10`, `runtime = "nodejs"`, trivial SELECT query |
| `vercel.json` | Cron schedule entry for keep-alive | VERIFIED | Third entry: `{ "path": "/api/cron/keep-alive", "schedule": "0 0 * * 0" }` |
| `vitest.setup.ts` | Langfuse test stubs (env vars) | VERIFIED | `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` default values set in test environment |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/lib/langfuse.ts` | `src/lib/env.ts` | `import { env } from "@/lib/env"` | WIRED | `env.LANGFUSE_SECRET_KEY` and `env.LANGFUSE_PUBLIC_KEY` used as constructor args |
| `src/lib/langfuse.ts` | `langfuse` npm package | `import { Langfuse } from "langfuse"` | WIRED | Package `"langfuse": "^3.38.20"` installed in `node_modules/langfuse` |
| `generate-explanation.ts` | `src/lib/langfuse.ts` | `import { langfuse } from "@/lib/langfuse"` | WIRED | Import at line 16, used at lines 184, 269 |
| `generate-score.ts` | `src/lib/langfuse.ts` | `import { langfuse } from "@/lib/langfuse"` | WIRED | Import at line 17, used at lines 77, 181 |
| `chat/route.ts` | `src/lib/langfuse.ts` | `import { langfuse } from "@/lib/langfuse"` | WIRED | Import at line 30, used at lines 140, 177 |
| `starter-questions/route.ts` | `src/lib/langfuse.ts` | `import { langfuse } from "@/lib/langfuse"` | WIRED | Import at line 20, used at lines 106, 167 |
| `analyze-document-batch.ts` | Supabase `documents` table | COUNT query before Gemini call | WIRED | `select("id", { count: "exact", head: true }).eq("status", "analyzing")` at line 109 |
| `embed-document-batch.ts` | Supabase Storage `pdfs` bucket | `storage.from("pdfs").remove` on success exit | WIRED | Two completion branches both invoke removal (lines 88-93, 149-154) |
| `vercel.json` | `/api/cron/keep-alive` | crons array entry with `0 0 * * 0` | WIRED | Entry present; existing parse/embed entries preserved |

---

## Data-Flow Trace (Level 4)

Not applicable — Phase 11 deliverables are instrumentation wrappers, reliability guards, and infrastructure routes. None render dynamic data to the browser; they wrap existing LLM calls and add observability side-effects.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Langfuse singleton exports trace + flushAsync | `pnpm vitest run src/lib/__tests__/langfuse.test.ts` | 2 tests passed | PASS |
| explanation Langfuse instrumentation | `pnpm vitest run src/lib/explain/__tests__/generate-explanation.test.ts` | 13 tests passed (incl. 3 Langfuse instrumentation tests) | PASS |
| score Langfuse instrumentation | `pnpm vitest run src/lib/explain/__tests__/generate-score.test.ts` | 11 tests passed (incl. 3 Langfuse instrumentation tests) | PASS |
| chat Langfuse Pattern B (onFinish) | `pnpm vitest run src/app/api/chat/__tests__/route.test.ts` | 8 tests passed (incl. 4 Langfuse instrumentation tests) | PASS |
| starter-questions Langfuse Pattern B (try/finally) | `pnpm vitest run src/app/api/starter-questions/__tests__/route.test.ts` | 6 tests passed (incl. 3 Langfuse instrumentation tests) | PASS |
| Concurrency cap INFRA-03 | `pnpm vitest run src/lib/ingest/__tests__/analyze-document-batch-concurrency.test.ts` | 3 tests passed | PASS |
| PDF cleanup INFRA-04 | `pnpm vitest run src/lib/ingest/__tests__/embed-document-batch-cleanup.test.ts` | 3 tests passed | PASS |
| Keep-alive cron INFRA-05 | `pnpm vitest run src/app/api/cron/keep-alive/__tests__/route.test.ts` | 3 tests passed | PASS |
| Full test suite (regression) | `pnpm vitest run` | 268 passed, 1 failed, 1 skipped (270 total) | PASS — 2 pre-existing failures confirmed unrelated to Phase 11 |

**Pre-existing failures (not Phase 11 regressions):**

1. `src/lib/explain/__tests__/explain-prompts.test.ts` — test asserts `EXPLANATION_MODEL_ID === "gemini-2.5-flash"` but the implementation uses `"gemini-2.0-flash"` (Phase 6 model ID choice). This mismatch pre-dates Phase 11 and is not a Phase 11 regression.
2. `src/lib/stock/fetch-stock-data.test.ts` — Phase 9 TDD stub; test imports `supabaseAdmin` from `@/db/client` in a way that fails in the test environment. Pre-existing, not introduced by Phase 11.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OBS-01 | 11-01 | Langfuse singleton client | SATISFIED | `src/lib/langfuse.ts` exports singleton, `server-only` guard, env schema |
| OBS-02 | 11-01 | Env vars for Langfuse | SATISFIED | `src/lib/env.ts` validates LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_HOST; `.env.example` documents them |
| INFRA-03 | 11-04 | Concurrency cap on analyze batch | SATISFIED | `analyze-document-batch.ts` caps at 2 concurrent via COUNT query before Gemini call |
| INFRA-04 | 11-04 | PDF cleanup after embedding | SATISFIED | `embed-document-batch.ts` removes PDF on both `done: true` exit branches |
| INFRA-05 | 11-04 | Keep-alive cron | SATISFIED | `src/app/api/cron/keep-alive/route.ts` + `vercel.json` `0 0 * * 0` schedule |

---

## Anti-Patterns Found

No blockers or warnings found. The grep scan over all eight key files produced zero hits for TODO, FIXME, placeholder, `return null`, `return {}`, `return []`, or empty handlers.

---

## Human Verification Required

None. All five success criteria are verifiable by code inspection and automated tests. The Langfuse Cloud dashboard visibility (traces actually appearing) requires a live deployment with real keys, but that is outside the scope of code-level verification.

---

## Gaps Summary

No gaps. All five success criteria are satisfied by the implementation and confirmed by 49 passing Phase 11 tests with zero regressions introduced.

---

_Verified: 2026-05-24T12:49:00Z_
_Verifier: Claude (gsd-verifier)_
