# Phase 13 T1 — Verification Record

**Date:** 2026-06-07
**Preview deploy:** Vercel preview branch
**Verified by:** Human (Task 4 checkpoint)

---

## TA-INFRA-02: Dispatcher Auth

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `curl /api/internal/dispatch?job=daily&secret=$INTERNAL_PARSE_SECRET` | 200 | 200 | PASS |
| `curl /api/internal/dispatch?job=daily` (no secret) | 401 | 401 | PASS |
| `results` includes `runTaRefreshOhlcv` | present | present | PASS |
| v1.0 pipeline (parse/embed/analyze sweeps) | present | present | PASS |
| Vercel dashboard cron count | 2 | 2 | PASS |
| Vercel secret delivery | `Authorization: Bearer ${CRON_SECRET}` | CRON_SECRET=INTERNAL_PARSE_SECRET confirmed | PASS |

**Decision recorded:** v1.0 R1 (cron auth method mismatch) is implicitly closed. The single dispatcher endpoint uses timing-safe auth with dual-path (Bearer header + ?secret= query param), and `CRON_SECRET` is wired to equal `INTERNAL_PARSE_SECRET` in Vercel project env.

---

## TA-INFRA-04: ONNX Cold-Start Measurement

**Finding: onnxruntime-node is NOT viable on Vercel Hobby.**

| Measurement | Result |
|-------------|--------|
| INIT_DURATION | N/A — module load fails |
| Error | `Cannot find module 'onnxruntime-node'` |
| Root cause | onnxruntime-node native binaries (~200 MB) exceed Vercel Hobby 250 MB uncompressed function size limit |
| Fix applied | `outputFileTracingExcludes: { "*": ["./node_modules/onnxruntime-node/**/*"] }` in next.config.ts (commit 59bd9e9) |

**Architectural decision for T3 (Phase 15):**

Server-side ONNX inference via `onnxruntime-node` is not viable on Vercel Hobby due to the 250 MB function size limit. Phase 15 must choose one of:

| Option | Pros | Cons |
|--------|------|------|
| `onnxruntime-web` (WASM) | Runs in browser; no Vercel size constraint | Inference in user's browser; no server-side privacy for model weights; ~30–60 MB WASM download |
| External inference endpoint | No size constraint; GPU acceleration possible | New infrastructure; latency; cost |
| Pre-compute + cache | Zero inference cost at request time | Requires offline training pipeline; stale predictions |
| Reduce model size | Keep onnxruntime-node if model + binaries fit under 250 MB | onnxruntime-node itself is ~200 MB before model; infeasible |

**Recommended for T3:** Pre-compute probability scores offline during the nightly cron job (using onnxruntime-node in a script context, not in a Vercel function) and store in `ta_analysis_cache.probabilities`. Serve cached scores at request time. This avoids runtime inference entirely and fits within Hobby limits.

**BLOCKING flag:** T3 (Phase 15) architecture must NOT assume Vercel-runtime ONNX inference. Design must account for this constraint before Phase 15 planning.

---

## TA-CHART-01..07: E2E Browser Smoke

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `/ta/BBCA` full chart render | candlestick + subpanels + range + overlays + snapshot strip | rendered | PASS |
| `/ta/TLKM` full chart render | same | rendered | PASS |
| `/ta/GOTO` full chart render | same | rendered | PASS |
| `/ta/bbca` lowercase redirect | 301 → `/ta/BBCA` | redirected | PASS |
| `/ta/ZZZZ` invalid ticker | "Ticker not found" error card | error card shown | PASS |
| 375px viewport | MobileInfoCard visible; chart hidden | MobileInfoCard shown | PASS |

**Additional finding during browser smoke:**

CSS custom properties (`var(--color-muted-foreground)`, `var(--color-border)`) in lightweight-charts `createChart()` options were not resolved — the canvas renderer reads config values before React's CSS variable scope is available.

**Fix applied (commit 0d845c5):**
- `var(--color-muted-foreground)` → `#71717a` (Tailwind zinc-500)
- `var(--color-border)` → `#e4e4e7` (Tailwind zinc-200)
- Files: `src/components/ta/candlestick-chart.tsx`, `src/components/ta/indicator-subpanel.tsx`

---

## Full Test Suite

```
pnpm test — run after Task 4 fixes applied
```

| Result | Count |
|--------|-------|
| Passed | 352 |
| Skipped | 1 |
| Failed | 1 (pre-existing: fetch-stock-data.test.ts — yahoo-finance2 constructor, unrelated to Phase 13) |

---

## Phase 13 T1 Completion Status

| Requirement | Status |
|-------------|--------|
| TA-CHART-01: Candlestick chart renders | VERIFIED (preview) |
| TA-CHART-02: Volume subpanel | VERIFIED (preview) |
| TA-CHART-03: RSI subpanel | VERIFIED (preview) |
| TA-CHART-04: MACD subpanel | VERIFIED (preview) |
| TA-CHART-05: Range selector | VERIFIED (preview) |
| TA-CHART-06: Overlay toggles | VERIFIED (preview) |
| TA-CHART-07: Gate states (error/sparse/mobile/skeleton) | VERIFIED (preview) |
| TA-CHART-08: Sparse gate (<30 candles, no NaN) | VERIFIED (unit tests + preview) |
| TA-INFRA-02: Single dispatcher cron (R1 close) | VERIFIED (preview) |
| TA-INFRA-04: ONNX cold-start measured | VERIFIED — finding: NOT viable on Hobby; T3 must pre-compute offline |
| TA-TICKER-01: Ticker autocomplete | VERIFIED (preview) |
| TA-TICKER-02: Lowercase 301 redirect | VERIFIED (preview) |
| TA-IND-01..04: 10 indicators computed | VERIFIED (unit tests) |
| TA-IND-05: Plain-English snapshot copy | VERIFIED (unit tests + preview) |
| TA-IND-06: Indicator tooltips | VERIFIED (preview) |
| TA-UX-01: SiteHeader with TA link | VERIFIED (preview) |
| D-05: Mobile baseline (MobileInfoCard) | VERIFIED (preview, 375px) |

---

## T3 Pre-Condition Flags

The following items are BLOCKING Phase 15 (T3) planning:

1. **TA-INFRA-04 ONNX constraint:** Server-side onnxruntime-node is not viable on Vercel Hobby. T3 architecture must use pre-compute + cache pattern (offline training → nightly cron → DB) rather than runtime inference.

2. **Q1 (IDX training data sufficiency):** Must be documented in `research/questions.md` before T3 ship.

3. **Q2 (XGBoost calibration method):** Must be documented in `research/questions.md`; method recorded in `model-version.json` before T3 ship.
