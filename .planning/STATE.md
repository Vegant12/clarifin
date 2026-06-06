---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: TA Module
status: Defining requirements
stopped_at: null
last_updated: "2026-06-06T05:50:00.000Z"
last_activity: 2026-06-06 — Started v2.0 TA Module milestone
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

**Project:** Clarifin
**Last updated:** 2026-06-06

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v2.0 TA Module
Last activity: 2026-06-06 — Milestone v2.0 started

## Phase Progress

v2.0 phases (13–16) will be created by the roadmapper. Pre-defined target structure from seed `seeds/ta-module-standalone.md`:

| Phase | Status |
|-------|--------|
| 13 (T1): Data & Indicators | Not started |
| 14 (T2): Patterns & Explanation | Not started |
| 15 (T3): ML Probability Layer | Not started — Blocks on Q1, Q2 in research/questions.md |
| 16 (T4): Polish | Not started — Blocks on Q3 in research/questions.md |

## Key Decisions

| Decision | Phase | Summary |
|----------|-------|---------|
| Chat library module paths | 10-02 | Files placed at src/lib/ root (not src/lib/chat/) to match ../guardrail relative import from test files in src/lib/chat/ |
| PSAK_GLOSSARY reuse | 10-02 | Imported from explain-prompts.ts, not redefined — avoids drift between explanation and chat glossaries |
| session-restore.ts deferred | 10-02 | Not in Plan 02 scope; requires Supabase I/O (not pure function); will be implemented in Plan 03 |

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

Items acknowledged and deferred at milestone close on 2026-06-06 (force-close via `/gsd-complete-milestone 1.0 --force` accepting `gaps_found` audit; see `milestones/v1.0-MILESTONE-AUDIT.md` and ROADMAP `## Backlog` entries 999.1–999.5):

| Category | Item | Status |
|----------|------|--------|
| quick_task | 260525-dl3-fix-four-pre-phase-12-bugs-post-analysis | missing close-out doc |
| quick_task | 260525-eq2-chat-markdown-rendering-verify-chat-cita | missing close-out doc |
| quick_task | 260526-c5k-explanationpanel-markdown-rendering-mult | missing close-out doc |
| uat_gap | Phase 08 HUMAN-UAT.md status=partial (4 open scenarios, 18 days stale since 2026-05-19) | partial |
| verification_gap | Phase 04 VERIFICATION.md status=human_needed (E2E embedding pipeline + HNSW <500ms smoke) | human_needed |
| verification_gap | Phase 08 VERIFICATION.md status=human_needed (interactive accordion + PDF scroll callback) | human_needed |
| code_blocker_R1 | vercel.json cron auth method mismatch — handlers accept ?secret=, crons hit bare path → 401 | critical, see audit |
| code_blocker_R2 | No cron for /api/internal/analyze-batch — analyze soft-fails never auto-resume | critical, see audit |
| code_blocker_R3 | No cron for /api/cron/keep-alive — Supabase free-tier inactivity risk | high, see audit |
| code_blocker_R4 | Session-ownership TODO in src/app/doc/[documentId]/page.tsx:84 — privacy gap | critical, see audit |
| backlog_999.1..5 | Phase 8 HUMAN-UAT + Phases 9/10/12 missing VERIFICATION + STATE/ROADMAP drift sync | see ROADMAP.md Backlog |
