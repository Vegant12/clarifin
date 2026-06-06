---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: TA Module
status: executing
last_updated: "2026-06-06T15:14:31.580Z"
last_activity: 2026-06-06
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 7
  completed_plans: 3
  percent: 43
---

# Project State

**Project:** Clarifin
**Last updated:** 2026-06-06

## Current Position

Phase: 13 (t1-data-and-indicators) — EXECUTING
Plan: 4 of 7
Status: Ready to execute
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
