---
phase: 13-t1-data-and-indicators
plan: 07
subsystem: ui, api, cron, ta
tags: [rsc-page, chart-shell, dispatcher, cron, onnx, sparse-gate, mobile-gate, refresh-job, auth-test]

requires:
  - phase: 13-t1-data-and-indicators (plan 01)
    provides: internal-auth.ts, fetchOHLCV, upsertOHLCV
  - phase: 13-t1-data-and-indicators (plan 04)
    provides: AnalysisPayload, normalizeTickerParam, /api/ta/analysis/[ticker]
  - phase: 13-t1-data-and-indicators (plan 05)
    provides: CandlestickChart, RangeSelector, OverlayToggles, IndicatorSnapshotStrip, chart-types
  - phase: 13-t1-data-and-indicators (plan 06)
    provides: SiteHeader, TickerSearch, TAErrorCard, SparseDataCard, MobileInfoCard, TAPageSkeleton

provides:
  - src/app/ta/[ticker]/page.tsx: RSC page with 4 gate states (redirect/error/sparse/mobile) + happy path
  - src/app/ta/ta-chart-shell.tsx: "use client" shell owning range+overlay state; composes Plan 05 chart
  - src/app/ta/page.tsx: /ta landing page with centered TickerSearch
  - src/lib/ta/jobs/refresh-ohlcv.ts: server-only nightly OHLCV refresh job within deadline budget
  - src/lib/ta/ticker-route.ts: shouldRenderSparse() helper (added alongside normalizeTickerParam)
  - src/app/api/internal/dispatch/route.ts: single cron dispatcher (daily/weekly) via direct imports
  - vercel.json: exactly 2 crons pointing at /api/internal/dispatch (daily + weekly)
  - src/app/api/ta/onnx-smoke/route.ts: ONNX cold-start measurement route (nodejs runtime)
  - public/ta/dummy-model.onnx: minimal valid ONNX Relu graph for smoke measurement
  - tests/ta/sparse-data.test.ts: 7 tests for shouldRenderSparse gate (TA-CHART-08)
  - tests/ta/dispatcher-auth.test.ts: 8 tests for dispatcher 401/200 auth (TA-INFRA-02)

affects: [14, 15]

tech-stack:
  added:
    - onnxruntime-node 1.26.0 (regular dep; native bindings via pnpm onlyBuiltDependencies)
  patterns:
    - CSS-based mobile gate: block sm:hidden / hidden sm:block avoids UA sniffing (D-05)
    - Dispatcher uses direct function imports only — no fetch() self-call (508 guard, T-13-26)
    - Adapter sweep pattern: v1.0 jobs (runParseBatch/runEmbedBatch/runAnalyzeBatch) wrapped in
      per-status sweep functions inside the dispatcher — original job functions unchanged
    - ONNX model created as raw protobuf binary (114 bytes, Relu graph) via Node.js Buffer encoding
    - outputFileTracingIncludes at top-level NextConfig (not inside experimental) for Next.js 15
    - RefreshOhlcvResult spread ({...result}) at return boundary for Record<string,unknown> compat
    - lightweight-charts canvas requires hardcoded hex values — CSS custom properties not resolved
      at canvas render time; var(--color-*) replaced with zinc-500 (#71717a) / zinc-200 (#e4e4e7)

key-files:
  created:
    - src/app/ta/[ticker]/page.tsx
    - src/app/ta/ta-chart-shell.tsx
    - src/app/ta/page.tsx
    - src/lib/ta/jobs/refresh-ohlcv.ts
    - src/app/api/internal/dispatch/route.ts
    - src/app/api/ta/onnx-smoke/route.ts
    - public/ta/dummy-model.onnx
    - tests/ta/sparse-data.test.ts
    - tests/ta/dispatcher-auth.test.ts
  modified:
    - src/lib/ta/ticker-route.ts (added shouldRenderSparse)
    - vercel.json (replaced 2 v1.0 crons with dispatcher pair)
    - next.config.ts (added onnxruntime-node to serverExternalPackages + outputFileTracingIncludes + outputFileTracingExcludes)
    - package.json (added onnxruntime-node dep + onlyBuiltDependencies entry)
    - src/components/ta/candlestick-chart.tsx (CSS vars → hardcoded hex)
    - src/components/ta/indicator-subpanel.tsx (CSS vars → hardcoded hex)

key-decisions:
  - "CSS-based mobile gate (block sm:hidden / hidden sm:block) chosen over UA-sniffing — SSR-safe,
    no server-side headers() call needed, simpler for RSC"
  - "Dispatcher adapter sweep pattern: v1.0 jobs (parse/embed/analyze) wrapped in sweep functions
    inside dispatch/route.ts; original runParseBatch/runEmbedBatch/runAnalyzeBatch signatures
    unchanged (they take { docId }, not { deadline }) — no breaking changes to existing routes"
  - "ONNX dummy model created as raw 114-byte protobuf binary (Relu node) via Node.js Buffer;
    verified runnable with onnxruntime-node session.create + session.run before commit"
  - "outputFileTracingIncludes placed at top-level NextConfig (not inside experimental) for
    Next.js 15 — ExperimentalConfig does not include this field"
  - "Vercel cron secret delivery: crons in vercel.json have no ?secret= param (T-13-28).
    The dispatcher resolveCandidate() accepts both Bearer header and ?secret= query param.
    Vercel injects CRON_SECRET as Authorization: Bearer header on scheduled invocations.
    CONFIRMED in Task 4: CRON_SECRET wired to equal INTERNAL_PARSE_SECRET in project env."
  - "TickerSearch in RSC page: imported directly at module level — Next.js handles 'use client'
    boundary automatically; no wrapper function needed at module level but a thin TickerSearchWrapper
    component was used to keep RSC layout clean"
  - "TA-INFRA-04 finding: onnxruntime-node NOT viable on Vercel Hobby — native binaries ~200 MB
    exceed 250 MB function limit. outputFileTracingExcludes added to prevent deploy failure.
    T3 (Phase 15) must use pre-compute+cache pattern: run inference offline in nightly cron,
    store probabilities in ta_analysis_cache.probabilities; do NOT assume runtime ONNX on Vercel."
  - "CSS custom properties not resolved in lightweight-charts canvas: var(--color-*) replaced with
    hardcoded hex values (zinc-500 #71717a, zinc-200 #e4e4e7) in candlestick-chart.tsx and
    indicator-subpanel.tsx. Applied during Task 4 browser smoke (commit 0d845c5)."

requirements-completed: [TA-CHART-07, TA-CHART-08, TA-INFRA-02, TA-INFRA-04]

duration: ~25min
completed: 2026-06-07
---

# Phase 13 Plan 07: Integration Wave — Pages + Dispatcher + ONNX Smoke Summary

**Full T1 surface wired: RSC page at /ta/[ticker] gates four states (redirect/error/sparse/mobile) and mounts the chart shell; dispatcher cron consolidated to two Vercel crons with timing-safe auth; runTaRefreshOhlcv job appends latest bars within deadline; ONNX hello-world smoke route scaffolded for preview cold-start measurement.**

## Performance

- **Duration:** ~25 min (Tasks 1-3 autonomous ~10 min; Task 4 preview + fixes ~15 min)
- **Started:** 2026-06-06T15:56:30Z
- **Completed:** 2026-06-07T07:21:03Z
- **Tasks:** 4/4 complete (Task 4 human-verified 2026-06-07)
- **Files created:** 11 new files (+ VERIFICATION.md)
- **Files modified:** 6 existing files

## Accomplishments

### Task 1: RSC page + landing page + client chart shell (gates + sparse test)

**`src/app/ta/ta-chart-shell.tsx`** ("use client"):
- State: `range` (default "1Y"), `overlays` (default `{BB:false, EMA20:false, EMA50:true, EMA200:true}`)
- Slices `ohlcv` and all 14 indicator arrays to last `RANGE_TO_DAYS[range]` bars
- Renders `<RangeSelector>`, `<OverlayToggles>`, `<CandlestickChart>`, `<IndicatorSnapshotStrip>`
- Page heading: "{TICKER} — {name_en}" text-xl semibold + "IDX · Last updated: {date}" text-xs muted

**`src/app/ta/[ticker]/page.tsx`** (RSC, no "use client"):
- Gate 1+2: `normalizeTickerParam` → lowercase `redirect()` + invalid format → `<TAErrorCard>`
- Gate 3: `fetch({baseUrl}/api/ta/analysis/{ticker}, { next: { revalidate: 3600 } })` → 404/fetch-error → `<TAErrorCard variant="fetch-error">`
- Gate 4: `shouldRenderSparse(payload)` → `<SparseDataCard>` (no NaN path, TA-CHART-08)
- Gate 5: `<div className="block sm:hidden"><MobileInfoCard /></div>` + `<div className="hidden sm:block">` chart surface
- `generateMetadata` → title "{TICKER} — TA Analysis · Clarifin"

**`src/app/ta/page.tsx`** (RSC): landing page with centered `<TickerSearch />`.

**`src/lib/ta/ticker-route.ts`**: added `shouldRenderSparse({ candle_count, sparse })` pure helper.

**`tests/ta/sparse-data.test.ts`**: 7 tests — all green:
- candle_count 10 → true; candle_count 29 → true; candle_count 30 → false
- candle_count 250, sparse false → false; sparse true → true (regardless of count)

### Task 2: runTaRefreshOhlcv job + dispatcher cron + auth test

**`src/lib/ta/jobs/refresh-ohlcv.ts`** (`import "server-only"`):
- `runTaRefreshOhlcv({ deadline })` → reads ticker_metadata, fetches last 7 calendar days via `fetchOHLCV`, upserts via `upsertOHLCV` (idempotent onConflict="ticker,date")
- T-13-27: deadline check before each ticker; returns `{ tickersProcessed, tickersSkippedForDeadline, tickersWithError }`
- Log-and-continue: per-ticker errors do not abort the run

**`src/app/api/internal/dispatch/route.ts`**:
- `export const maxDuration = 60; export const runtime = "nodejs"`
- Auth: `resolveCandidate` + `timingSafeStringEq(env.INTERNAL_PARSE_SECRET)` → 401 (T-13-25)
- `jobSchema = z.enum(["daily","weekly"])` → 400 on unknown job
- `daily`: deadline = now + 55s; runs `runParseSweep`, `runEmbedSweep`, `runAnalyzeSweep`, `runTaRefreshOhlcv` in sequence; each `.catch` captures `{ error }`
- `weekly`: trivial `ticker_metadata.select("ticker").limit(1)` keep-alive ping
- ZERO `fetch()` calls — direct function imports only (T-13-26 verified by grep)

**v1.0 adapter sweep pattern (documented)**:
The v1.0 job functions `runParseBatch/runEmbedBatch/runAnalyzeBatch` take `{ docId }` and are NOT changed. The dispatcher wraps them in `runParseSweep/runEmbedSweep/runAnalyzeSweep` adapter functions that select pending documents from the DB and loop the jobs — mirroring the original per-route sweep logic. No breaking changes to the existing routes.

**`tests/ta/dispatcher-auth.test.ts`**: 8 tests — all green:
- 401 with no secret, wrong query secret, wrong Bearer
- 200 with correct Bearer, correct ?secret=
- 400 for unknown job
- daily returns `{ ok: true, kind: "daily", results: [...] }`
- weekly returns `{ ok: true, kind: "weekly" }`

### Task 3: vercel.json cutover + ONNX hello-world smoke scaffold

**`vercel.json`** (hard cutover):
```json
{
  "crons": [
    { "path": "/api/internal/dispatch?job=daily",  "schedule": "0 11 * * *" },
    { "path": "/api/internal/dispatch?job=weekly", "schedule": "0 12 * * 0" }
  ]
}
```
No secret in committed file (T-13-28). Vercel injects `Authorization: Bearer ${CRON_SECRET}` header; `resolveCandidate()` handles Bearer path.

**`onnxruntime-node` installation**:
- Added to `package.json` dependencies
- Added to `pnpm.onlyBuiltDependencies` so native bindings compile on install
- `pnpm install` confirmed build scripts ran (`onnxruntime-node postinstall: Done`)

**`public/ta/dummy-model.onnx`** (114 bytes):
- Minimal valid ONNX Relu graph encoded as raw protobuf using Node.js Buffer
- Validated locally: `InferenceSession.create()` + `session.run({ input: Tensor([1.0]) })` → output `[1.0]`

**`src/app/api/ta/onnx-smoke/route.ts`**:
- `export const runtime = "nodejs"; export const maxDuration = 60`
- Lazy-loads `onnxruntime-node`, creates session from `process.cwd()/public/ta/dummy-model.onnx`
- Returns `{ ok, initMs, sessionMs, inferenceMs, totalMs, outputValue }`

**`next.config.ts`** changes:
- `serverExternalPackages: ["unpdf", "onnxruntime-node"]` — prevents webpack bundling native modules
- `outputFileTracingIncludes: { "/api/ta/onnx-smoke": ["./public/ta/dummy-model.onnx"] }` — bundles model into function deployment
- Note: placed at top-level `NextConfig` (NOT inside `experimental`) — `ExperimentalConfig` does not include this field in Next.js 15

### Task 4: [BLOCKING] Preview deploy verification

**Status: VERIFIED 2026-06-07** — all 5 checks passed.

**Results:**

1. **Dispatcher auth**: 200 with correct secret, 401 without. v1.0 pipeline (parse/embed/analyze sweeps) confirmed running. CRON_SECRET wired to equal INTERNAL_PARSE_SECRET.
2. **Vercel crons**: Exactly 2 dispatcher crons confirmed in Vercel dashboard.
3. **ONNX finding (TA-INFRA-04)**: `Cannot find module 'onnxruntime-node'` — native binaries (~200 MB) exceed Vercel Hobby 250 MB function limit. Server-side ONNX inference is NOT viable on Vercel Hobby. Fix applied: `outputFileTracingExcludes: { "*": ["./node_modules/onnxruntime-node/**/*"] }` in next.config.ts (commit 59bd9e9). **T3 architectural constraint documented** — see 13-VERIFICATION.md.
4. **Browser smoke**: /ta/BBCA, /ta/TLKM, /ta/GOTO all render full chart + subpanels + range + overlays + snapshot strip. /ta/bbca → 301 to /ta/BBCA. /ta/ZZZZ → error card. 375px → MobileInfoCard.
5. **CSS variable fix**: `var(--color-muted-foreground)` / `var(--color-border)` in lightweight-charts `createChart()` options were not resolved at canvas render time. Replaced with hardcoded hex values `#71717a` (zinc-500) and `#e4e4e7` (zinc-200) in candlestick-chart.tsx and indicator-subpanel.tsx (commit 0d845c5).

Full verification record: `.planning/phases/13-t1-data-and-indicators/13-VERIFICATION.md`

## Task Commits

| Task | Commit | Key Files |
|------|--------|-----------|
| Task 1 | 4f568d7 | ta-chart-shell.tsx, ta/[ticker]/page.tsx, ta/page.tsx, ticker-route.ts, sparse-data.test.ts |
| Task 2 | da51d61 | dispatch/route.ts, jobs/refresh-ohlcv.ts, dispatcher-auth.test.ts |
| Task 3 | 8063ccf | vercel.json, package.json, next.config.ts, onnx-smoke/route.ts, dummy-model.onnx |
| Task 4 fix (onnxruntime) | 59bd9e9 | next.config.ts (outputFileTracingExcludes) |
| Task 4 fix (CSS vars) | 0d845c5 | candlestick-chart.tsx, indicator-subpanel.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stochasticSignal field in ta-chart-shell.tsx**
- **Found during:** Task 1 implementation
- **Issue:** Plan described slicing all indicator arrays; initial draft included `stochasticSignal` but `IndicatorSet` (from Plan 03) has no such field — only `stochastic` and no signal array.
- **Fix:** Removed `stochasticSignal` from the sliced indicator object; matched exact IndicatorSet shape.
- **Files modified:** src/app/ta/ta-chart-shell.tsx
- **Commit:** 4f568d7

**2. [Rule 1 - Bug] outputFileTracingIncludes in experimental instead of top-level**
- **Found during:** Task 3 typecheck
- **Issue:** `outputFileTracingIncludes` is not part of `ExperimentalConfig` in Next.js 15 — placing it inside `experimental` caused `TS2353: Object literal may only specify known properties`.
- **Fix:** Moved to top-level `NextConfig` where it is a valid property.
- **Files modified:** next.config.ts
- **Commit:** 8063ccf

**3. [Rule 1 - Bug] RefreshOhlcvResult not assignable to Record<string, unknown>**
- **Found during:** Task 3 typecheck
- **Issue:** TypeScript strict mode does not automatically widen a typed interface to `Record<string, unknown>`.
- **Fix:** Return `{ ...result }` (spread into plain object) at the function boundary.
- **Files modified:** src/lib/ta/jobs/refresh-ohlcv.ts
- **Commit:** 8063ccf

**4. [Rule 3 - Blocking] vi.hoisted constraint for CORRECT_SECRET in dispatcher test**
- **Found during:** Task 2 test run
- **Issue:** `CORRECT_SECRET` declared as top-level `const` but used inside `vi.mock("@/lib/env")` factory — hoisted before variable declarations, causing `ReferenceError`.
- **Fix:** Moved `CORRECT_SECRET` into `vi.hoisted()` alongside the mock functions.
- **Files modified:** tests/ta/dispatcher-auth.test.ts
- **Commit:** da51d61

**5. [Rule 1 - Bug] onnxruntime-node exceeds Vercel Hobby 250 MB function size limit**
- **Found during:** Task 4 preview deploy
- **Issue:** `Cannot find module 'onnxruntime-node'` on Vercel — native binaries (~200 MB) exceed the 250 MB uncompressed function size limit. The outputFileTracingIncludes from Task 3 caused the deployment to include the full binary tree.
- **Fix:** Added `outputFileTracingExcludes: { "*": ["./node_modules/onnxruntime-node/**/*"] }` to next.config.ts so onnxruntime-node is excluded from all function deployments. The onnx-smoke route now throws at runtime — that IS the TA-INFRA-04 measurement result.
- **Files modified:** next.config.ts
- **Commit:** 59bd9e9
- **Architectural impact:** T3 (Phase 15) must NOT assume runtime ONNX on Vercel. Must use pre-compute+cache: run inference offline in nightly cron script, store probabilities in `ta_analysis_cache.probabilities`. See 13-VERIFICATION.md for full decision record.

**6. [Rule 1 - Bug] CSS custom properties not resolved in lightweight-charts canvas**
- **Found during:** Task 4 browser smoke
- **Issue:** lightweight-charts creates a canvas element and reads chart config values (colors, border colors) during the WebGL render pass — before React's CSS variable scope is available on the canvas. `var(--color-muted-foreground)` and `var(--color-border)` rendered as transparent/black.
- **Fix:** Replace all CSS custom property references in `createChart()` options with hardcoded Tailwind hex values: `var(--color-muted-foreground)` → `#71717a` (zinc-500), `var(--color-border)` → `#e4e4e7` (zinc-200).
- **Files modified:** src/components/ta/candlestick-chart.tsx, src/components/ta/indicator-subpanel.tsx
- **Commit:** 0d845c5

## Vercel Secret Delivery (Confirmed)

`vercel.json` cron paths contain no `?secret=` (T-13-28). Vercel injects `Authorization: Bearer ${CRON_SECRET}` on scheduled invocations. `resolveCandidate()` handles the Bearer path. **Confirmed working in Task 4:** `CRON_SECRET` was set equal to `INTERNAL_PARSE_SECRET` in Vercel project env and the scheduled call authenticated successfully.

## Known Stubs

None — all four tasks are fully implemented and verified.

## Threat Surface Scan

New trust boundaries introduced:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth | src/app/api/internal/dispatch/route.ts | New cron endpoint — auth via INTERNAL_PARSE_SECRET (T-13-25 mitigated: resolveCandidate + timingSafeStringEq + 401 on mismatch; verified by dispatcher-auth.test.ts + preview curl) |
| threat_flag: native-module | src/app/api/ta/onnx-smoke/route.ts | onnxruntime-node native module cold-load (T-13-30 measured — NOT viable on Vercel Hobby; T3 must pre-compute offline) |
| threat_flag: param-injection | src/app/ta/[ticker]/page.tsx | ticker RSC path param flows to fetch URL (T-13-29 mitigated: normalizeTickerParam validates /^[A-Z]{1,5}$/ before any interpolation) |

## Self-Check: PASSED

```
FOUND: src/app/ta/[ticker]/page.tsx (redirect, SparseDataCard, MobileInfoCard, api/ta/analysis)
FOUND: src/app/ta/ta-chart-shell.tsx ("use client", range "1Y" default, EMA50/EMA200 true default)
FOUND: src/app/ta/page.tsx (TickerSearch, metadata)
FOUND: src/lib/ta/ticker-route.ts (shouldRenderSparse export)
FOUND: src/lib/ta/jobs/refresh-ohlcv.ts (server-only, runTaRefreshOhlcv, fetchOHLCV, upsertOHLCV)
FOUND: src/app/api/internal/dispatch/route.ts (runTaRefreshOhlcv, resolveCandidate, no functional fetch())
FOUND: src/app/api/ta/onnx-smoke/route.ts (runtime="nodejs", maxDuration=60, onnxruntime-node import)
FOUND: public/ta/dummy-model.onnx (114 bytes, valid ONNX Relu graph, verified runnable locally)
FOUND: vercel.json (2 crons, both /api/internal/dispatch, no secret)
FOUND: next.config.ts (outputFileTracingIncludes + outputFileTracingExcludes, onnxruntime-node excluded)
FOUND: tests/ta/sparse-data.test.ts (7 tests, all green)
FOUND: tests/ta/dispatcher-auth.test.ts (8 tests, all green)
FOUND: .planning/phases/13-t1-data-and-indicators/13-VERIFICATION.md (all 5 checks, T3 constraint)
FOUND: 4f568d7 (Task 1 commit)
FOUND: da51d61 (Task 2 commit)
FOUND: 8063ccf (Task 3 commit)
FOUND: 59bd9e9 (Task 4 fix: onnxruntime exclude)
FOUND: 0d845c5 (Task 4 fix: CSS vars → hardcoded hex)
BUILD: PASS (all routes present)
TYPECHECK: clean (only pre-existing session-restore.test.ts errors)
TESTS: 352/353 pass (1 pre-existing failure unrelated to Phase 13)
PREVIEW: all 5 verification checks passed 2026-06-07
```
