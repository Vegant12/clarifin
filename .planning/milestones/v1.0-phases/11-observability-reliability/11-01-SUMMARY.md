---
phase: 11-observability-reliability
plan: 01
subsystem: infra
tags: [langfuse, observability, env, singleton, server-only, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: t3-env schema pattern (createEnv with server/runtimeEnv blocks)
provides:
  - Singleton Langfuse v3 client at src/lib/langfuse.ts importable from all server modules
  - Three Langfuse env vars validated by t3-env at startup (LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_HOST)
  - .env.example documents all three keys with sk-lf-/pk-lf- placeholder format
affects: [11-02, 11-03, 11-04]

# Tech tracking
tech-stack:
  added: []  # langfuse ^3.38.20 was already in package.json
  patterns:
    - "server-only singleton client (mirrors src/db/client.ts pattern exactly)"
    - "conditional baseUrl spread for optional self-hosted Langfuse"

key-files:
  created:
    - src/lib/langfuse.ts
    - src/lib/__tests__/langfuse.test.ts
  modified:
    - src/lib/env.ts
    - .env.example

key-decisions:
  - "Import from 'langfuse' (classic SDK v3), not @langfuse/otel — OTel packages require NodeTracerProvider setup incompatible with Next.js serverless"
  - "Module-load construction (not lazy init) — t3-env already validates keys at startup so construction cannot fail silently"
  - "LANGFUSE_HOST is optional (z.string().url().optional()) — omit for cloud, set only for self-hosted"
  - "langfuse package was already at ^3.38.20 in package.json — no install needed"

patterns-established:
  - "Langfuse singleton: `import { langfuse } from '@/lib/langfuse'` — never `new Langfuse()` per request"
  - "Trace metadata convention: { doc_id, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local', step }"

requirements-completed: [OBS-01, OBS-02]

# Metrics
duration: 15min
completed: 2026-05-24
---

# Phase 11 Plan 01: Langfuse Foundation Summary

**Singleton Langfuse v3 client at `src/lib/langfuse.ts` with t3-env schema validation for three keys, `server-only` boundary enforcement, and 2 passing vitest identity tests**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-24T12:20:00Z
- **Completed:** 2026-05-24T12:35:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended `src/lib/env.ts` with `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` (required, `z.string().min(20)`) and `LANGFUSE_HOST` (optional URL) — missing required keys now fail-fast at startup via t3-env
- Created `src/lib/langfuse.ts` mirroring the `src/db/client.ts` singleton pattern exactly: `import "server-only"` first line, named export `langfuse`, imports from `"langfuse"` (not `@langfuse/otel`)
- Updated `.env.example` with `sk-lf-xxxxx`/`pk-lf-xxxxx` placeholder format and comment pointing to Langfuse Cloud dashboard
- Created `src/lib/__tests__/langfuse.test.ts` with 2 vitest tests confirming `trace`/`flushAsync` presence and singleton identity across multiple imports

## Langfuse Constructor Shape (for Plans 02-04 to mirror)

```typescript
export const langfuse = new Langfuse({
  secretKey: env.LANGFUSE_SECRET_KEY,
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  ...(env.LANGFUSE_HOST ? { baseUrl: env.LANGFUSE_HOST } : {}),
});
```

- `baseUrl` is only passed when `env.LANGFUSE_HOST` is defined — otherwise the SDK defaults to `https://cloud.langfuse.com`.
- **This deployment uses cloud default** (LANGFUSE_HOST not set in .env.example by default).

## Package Status

`"langfuse": "^3.38.20"` was already present in `package.json` — no install needed. Confirmed from package.json line 33.

## Trace Metadata Convention

All call sites in Plans 02/03/04 should use:

```typescript
const trace = langfuse.trace({
  name: "<step-name>",  // "explanation" | "score" | "chat" | "starter-questions"
  metadata: {
    doc_id: params.docId,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    step: "<step-name>",
  },
});
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend env schema with three Langfuse keys** - `2dd97df` (feat)
2. **Task 2: Create singleton Langfuse client + unit test** - `ded609e` (feat)

**Plan metadata:** `(pending final commit)`

## Files Created/Modified
- `src/lib/langfuse.ts` — Singleton Langfuse v3 client, server-only, exports `langfuse`
- `src/lib/__tests__/langfuse.test.ts` — 2 vitest tests: method presence + singleton identity
- `src/lib/env.ts` — Added LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY (required), LANGFUSE_HOST (optional) to server schema and runtimeEnv
- `.env.example` — Updated Langfuse section with sk-lf-/pk-lf- placeholders and self-host comment

## Decisions Made
- Import from `"langfuse"` (classic SDK v3), not `@langfuse/otel` — the OTel packages require `NodeTracerProvider` and `instrumentation.ts` setup that conflicts with Next.js serverless execution model (would produce no traces silently under Vercel)
- Module-load construction rather than lazy init — t3-env already enforces key presence at startup, so `new Langfuse()` at module load cannot fail silently in production
- `LANGFUSE_HOST` made optional so developers without a self-hosted instance can run locally without setting the var

## Deviations from Plan

None — plan executed exactly as written. The `.env.example` already had bare `LANGFUSE_PUBLIC_KEY=` and `LANGFUSE_SECRET_KEY=` entries (without comments or placeholders); these were replaced with the properly formatted entries per plan spec.

## Issues Encountered
- Pre-existing TypeScript errors in `src/lib/chat/session-restore.test.ts` (2 errors, unrelated to this plan) — out of scope, not fixed, logged here for tracking.

## User Setup Required
Environment variables to add before running the app with Langfuse enabled:

```
LANGFUSE_SECRET_KEY=sk-lf-<your-secret-key>
LANGFUSE_PUBLIC_KEY=pk-lf-<your-public-key>
# LANGFUSE_HOST=https://cloud.langfuse.com  # only if self-hosting
```

Get keys from: https://cloud.langfuse.com → Project Settings → API Keys

## Next Phase Readiness
- Plans 02, 03, and 04 are now unblocked — they can `import { langfuse } from "@/lib/langfuse"` and immediately call `langfuse.trace()` and `langfuse.flushAsync()`
- No additional setup required for Wave 2 instrumentation plans

---
*Phase: 11-observability-reliability*
*Completed: 2026-05-24*
