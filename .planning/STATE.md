---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: TA Module
status: verifying
last_updated: "2026-06-06T16:09:15.199Z"
last_activity: 2026-06-06
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

**Project:** Clarifin
**Last updated:** 2026-06-06

## Current Position

Phase: 13 (t1-data-and-indicators) — EXECUTING
Plan: 7 of 7
Status: Phase complete — ready for verification
Last activity: 2026-06-06

## Phase Progress

v2.0 phases (13–16) — derived from `seeds/ta-module-standalone.md` T1–T4 design. Plan counts populate as each phase enters `/gsd-plan-phase`.

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 13 (T1) | Data & Indicators | 0/TBD | Not started — ready for plan-phase |
| 14 (T2) | Patterns & Explanation | 0/TBD | Not started — gated on Phase 13 VERIFICATION.md (TA-INFRA-06) |
| 15 (T3) | ML Probability Layer | 0/TBD | Not started — gated on Phase 13 VERIFICATION.md + Q1 + Q2; Waves 0–1 may parallelize with T2 |
| 16 (T4) | Polish | 0/TBD | Not started — gated on Phases 13–15 VERIFICATION.md + Q3 (TA-INFRA-08 Langfuse RPD measurement before planning) |

## Blocking Research Questions

| Question | Blocks | Resolution Method |
|----------|--------|-------------------|
| Q1: IDX training data sufficiency (5yr × 100 tickers × 12 patterns; N>1000 per cell; cycle diversity) | Phase 15 (T3) ship | Documented findings in `research/questions.md` before T3 verification |
| Q2: XGBoost calibration method (Platt / isotonic / multinomial; ECE target) | Phase 15 (T3) ship | Documented findings in `research/questions.md`; method recorded in `model-version.json` |
| Q3: Gemini quota under combined v1.0 + TA load (P95 RPD from Langfuse) | Phase 16 (T4) plan-phase entry | TA-INFRA-08 — read Phase 11 Langfuse traces for 7+ days; route TA chat to Groq if P95 >150, add SWR cache if P95 >200 |

## Key Decisions

| Decision | Phase | Summary |
|----------|-------|---------|
| Chat library module paths | 10-02 | Files placed at src/lib/ root (not src/lib/chat/) to match ../guardrail relative import from test files in src/lib/chat/ |
| PSAK_GLOSSARY reuse | 10-02 | Imported from explain-prompts.ts, not redefined — avoids drift between explanation and chat glossaries |
| session-restore.ts deferred | 10-02 | Not in Plan 02 scope; requires Supabase I/O (not pure function); will be implemented in Plan 03 |
| v2.0 phase structure (T1–T4 → Phases 13–16) | v2.0 roadmap | Derived from `seeds/ta-module-standalone.md`; 62/62 REQ-IDs mapped; numbering continues from v1.0 Phase 12 |
| T3 Waves 0–1 parallel with T2 Waves 0–2 | v2.0 roadmap | Per ARCHITECTURE.md §7.2 — shared state is `ohlcv_cache` + indicators; handoff is `ta_analysis_cache.probabilities` JSONB placeholder shape |
| TA-INFRA-02 implicitly closes v1.0 R1 | Phase 13 | Dispatcher cron consolidation replaces v1.0 parse-batch + embed-batch crons with single dispatcher using one agreed auth path — vercel.json↔handler mismatch goes away as a side-effect |
| internal-auth.ts extraction | 13-01 | Extracted triplicated timingSafeStringEq/extractBearer/resolveCandidate from 3 internal routes into src/lib/internal-auth.ts — single source of truth |
| MACD warmup = 25 not 33 | 13-01 | technicalindicators MACD(12,26,9) outputs first value at warmup=25 (not formula slow+signal-2=33); ground truth fixtures use measured library value |
| alignIndicator self-correcting padding | 13-03 | Pads by (totalBars - values.length) not theoretical warmup constant — self-corrects if library output deviates from formula |
| yahoo-finance2 import style | 13-03 | Use import yahooFinance not new YahooFinance() — test mock provides plain object not constructor |
| OBV warmup=1 not 0 | 13-03 | technicalindicators OBV outputs n-1 values (needs prevClose for direction); alignIndicator self-corrects to bars.length |
| Static IDX candidate list as seed input | 13-02 | Used committed LQ45+IDX80 JSON (111 tickers) instead of yahoo-finance2 bulk ranking — no bulk market-cap endpoint exists in the library |
| 'sector' removed from quote() fields | 13-02 | yahoo-finance2 field validation rejects 'sector' for .JK tickers; sector is nullable in ticker_metadata, backfillable separately |
| lightweight-charts v5 series API | 13-05 | chart.addSeries(CandlestickSeries, opts) — NOT v4 addCandlestickSeries(); LineWidth is integer-only (1\|2\|3\|4); confirmed via node introspection |
| Task 3 browser smoke deferred to Plan 07 | 13-05 | Requires full /ta/{ticker} page wiring + seeded data; Plan 07 mounts chart subtree and runs end-to-end browser verification |
| SnapshotCopy typed interface | 13-04 | Added typed interface for buildSnapshotCopy return — avoids Record<string,string> destructuring producing string\|undefined in TypeScript strict mode |
| Analysis route reads cache only | 13-04 | GET /api/ta/analysis/[ticker] reads ohlcv_cache only, never calls yahoo-finance2 — keeps route within budget and avoids per-request external calls |
| normalizeTickerParam shared helper | 13-04 | Pure helper in ticker-route.ts shared between Plan 07 RSC page and unit tests — no redirect logic drift possible |
| NEXT_PUBLIC_TA_ENABLED string comparison | 13-06 | Stored as z.string().optional() — NEXT_PUBLIC_ vars are always strings; compared === "true" not coerced to boolean |
| SiteHeader above SessionProvider | 13-06 | SiteHeader mounted above SessionProvider in layout.tsx to avoid hydration mismatches (UI-SPEC note) |
| TAErrorCard variant prop | 13-06 | Single component with variant prop for not-found vs fetch-error — avoids code duplication for two similar error states |
| TickerSearch shouldFilter=false | 13-06 | cmdk client-side filtering disabled — filtering is server-side via /api/ta/search; client filter would hide valid results |
| CSS mobile gate in RSC page | 13-07 | block sm:hidden / hidden sm:block avoids UA-sniffing; SSR-safe without server-side headers() call |
| Dispatcher adapter sweep pattern | 13-07 | v1.0 jobs (parse/embed/analyze) wrapped in sweep functions inside dispatch/route.ts; original runParseBatch/runEmbedBatch/runAnalyzeBatch signatures unchanged |
| outputFileTracingIncludes top-level | 13-07 | Placed at top-level NextConfig (not inside experimental) — ExperimentalConfig does not include this field in Next.js 15 |
| Vercel CRON_SECRET delivery | 13-07 | vercel.json cron paths have no ?secret=; Vercel injects Authorization: Bearer ${CRON_SECRET} on scheduled calls; resolveCandidate() handles Bearer; CRON_SECRET must equal INTERNAL_PARSE_SECRET in project env |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260525-dl3 | Fix four pre-phase-12 bugs (post-analysis navigation, PDF viewer, chat connection error, citation popover flicker) — Task 4 human-verify pending | 2026-05-25 | 624c8ab | [260525-dl3-fix-four-pre-phase-12-bugs-post-analysis](./quick/260525-dl3-fix-four-pre-phase-12-bugs-post-analysis/) |
| 260525-eq2 | Chat markdown rendering + chat citation popover verification + PDF/parse-pipeline diagnostics | 2026-05-25 | 466c6c0 | [260525-eq2-chat-markdown-rendering-verify-chat-cita](./quick/260525-eq2-chat-markdown-rendering-verify-chat-cita/) |
| 260526-c5k | ExplanationPanel markdown rendering + multi-page citation parsing (`[p.49, p.111]`) — shared `renderInlineWithCitations` helper | 2026-05-26 | 8373f58 | [260526-c5k-explanationpanel-markdown-rendering-mult](./quick/260526-c5k-explanationpanel-markdown-rendering-mult/) |

### Debug Sessions

| Slug | Status | Resolved | Commit | Notes |
|------|--------|----------|--------|-------|
| pdf-upload-missing-storage | resolved | 2026-05-26 | b8a808b | INFRA-04 cleanup conflicted with Phase 7 viewer — cleanup removed, regression test added. See `.planning/debug/resolved/pdf-upload-missing-storage.md`. |

Last activity: 2026-06-06

## Deferred Items

Items acknowledged and deferred at v1.0 milestone close on 2026-06-06 (force-close via `/gsd-complete-milestone 1.0 --force` accepting `gaps_found` audit; see `milestones/v1.0-MILESTONE-AUDIT.md` and ROADMAP `## Backlog` entries 999.1–999.6):

| Category | Item | Status |
|----------|------|--------|
| quick_task | 260525-dl3-fix-four-pre-phase-12-bugs-post-analysis | missing close-out doc |
| quick_task | 260525-eq2-chat-markdown-rendering-verify-chat-cita | missing close-out doc |
| quick_task | 260526-c5k-explanationpanel-markdown-rendering-mult | missing close-out doc |
| uat_gap | Phase 08 HUMAN-UAT.md status=partial (4 open scenarios, 18 days stale since 2026-05-19) | partial |
| verification_gap | Phase 04 VERIFICATION.md status=human_needed (E2E embedding pipeline + HNSW <500ms smoke) | human_needed |
| verification_gap | Phase 08 VERIFICATION.md status=human_needed (interactive accordion + PDF scroll callback) | human_needed |
| code_blocker_R1 | vercel.json cron auth method mismatch — handlers accept ?secret=, crons hit bare path → 401 | critical; implicitly closed as v2.0 Phase 13 TA-INFRA-02 side-effect |
| code_blocker_R2 | No cron for /api/internal/analyze-batch — analyze soft-fails never auto-resume | critical, see audit |
| code_blocker_R3 | No cron for /api/cron/keep-alive — Supabase free-tier inactivity risk | high, see audit |
| code_blocker_R4 | Session-ownership TODO in src/app/doc/[documentId]/page.tsx:84 — privacy gap | critical, see audit |
| backlog_999.1..6 | Phase 8 HUMAN-UAT + Phases 9/10/12 missing VERIFICATION + STATE/ROADMAP drift sync + R1–R4 launch blockers | see ROADMAP.md Backlog |
