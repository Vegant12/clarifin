---
phase: 13
slug: t1-data-and-indicators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | vitest.config.ts (or inferred from vite.config.ts) |
| **Quick run command** | `pnpm test -- tests/ta/` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds (TA-specific); ~60–90 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- tests/ta/` (TA-specific tests only, <30s)
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-W0-01 | W0 | 0 | TA-INGEST-01 | — | Reject bars where high<low, close<0, volume<0, single-bar return>50% | unit | `pnpm test -- tests/ta/ohlcv-validation.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-W0-02 | W0 | 0 | TA-INFRA-02 | — | ohlcv_cache rejects duplicate (ticker, date) rows | unit | `pnpm test -- tests/ta/ohlcv-uniqueness.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-W0-03 | W0 | 0 | TA-DATA-01 | — | seed-and-backfill.ts produces valid JSON + DB rows | manual smoke | Manual run + DB count check | ❌ Wave 0 | ⬜ pending |
| 13-W1-01 | W1 | 1 | TA-IND-01..04 | — | Indicator warmup: last RSI/MACD/BB/EMA matches ground truth within 0.001 | unit | `pnpm test -- tests/ta/indicators.fixture.test.ts` | ❌ Wave 1 | ⬜ pending |
| 13-W1-02 | W1 | 1 | TA-TICKER-02 | — | Lowercase ticker URL 301s to uppercase | unit | `pnpm test -- tests/ta/ticker-routing.test.ts` | ❌ Wave 1 | ⬜ pending |
| 13-W2-01 | W2 | 2 | TA-CHART-08 | — | <30 candles triggers sparse-data state; no NaN rendered | unit | `pnpm test -- tests/ta/sparse-data.test.ts` | ❌ Wave 2 | ⬜ pending |
| 13-W2-02 | W2 | 2 | TA-IND-05 | — | Indicator snapshot strip produces plain-English copy (no raw numbers) | unit | `pnpm test -- tests/ta/indicator-snapshot.test.ts` | ❌ Wave 2 | ⬜ pending |
| 13-W3-01 | W3 | 3 | TA-INFRA-02 | — | Dispatcher auth: 200 with correct secret, 401 without | unit | `pnpm test -- tests/ta/dispatcher-auth.test.ts` | ❌ Wave 3 | ⬜ pending |
| 13-W3-02 | W3 | 3 | TA-INFRA-04 | — | ONNX cold INIT_DURATION measured and recorded in VERIFICATION.md | manual | curl + Vercel logs (no automated proxy) | ❌ Wave 3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ta/ohlcv-validation.test.ts` — stubs for TA-INGEST-01 bar validation rules
- [ ] `tests/ta/ohlcv-uniqueness.test.ts` — stubs for UNIQUE(ticker, date) constraint smoke
- [ ] `tests/ta/indicators.fixture.test.ts` — stubs for TA-IND-01..04 warmup alignment (REQUIRED for VERIFICATION.md)
- [ ] `supabase/migrations/20260606XXXXXX_ta_t1_schema.sql` — ohlcv_cache + ticker_metadata tables + indices

*Existing vitest infrastructure assumed — Wave 0 installs no new test framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| seed-and-backfill.ts produces valid JSON + DB rows | TA-DATA-01 | Script is a one-shot data pipeline; no automated E2E proxy | Run `pnpm tsx scripts/ta/seed-and-backfill.ts`, verify ticker_metadata.json committed, check Supabase `select count(*) from ohlcv_cache` returns rows |
| ONNX hello-world cold INIT_DURATION measured | TA-INFRA-04 | Requires Vercel preview deploy + curl + log parsing | Deploy to preview, run 3 cold curls with 5+ min gap, record INIT_DURATION from Vercel logs, write to VERIFICATION.md |
| /ta/BBCA renders correctly in browser | TA-CHART-01..07 | lightweight-charts is a canvas-rendered client lib; no jsdom/Playwright in scope for T1 | Manual browser smoke: navigate to /ta/BBCA on preview, verify chart + subpanels + range selector visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
