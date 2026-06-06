# Roadmap: Clarifin

## Milestones

- ✅ **v1.0 MVP** — Phases 1–12 (shipped 2026-06-06) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 📋 **v1.1** — Not yet defined (run `/gsd-new-milestone`)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–12) — SHIPPED 2026-06-06</summary>

- [x] Phase 1: Project Setup & Foundation (6/6 plans) — completed 2026-05-06
- [x] Phase 2: PDF Upload & Storage (6/6 plans) — completed 2026-05-06
- [x] Phase 3: PDF Parsing & Chunking (6/6 plans) — completed 2026-05-08
- [x] Phase 4: Embeddings & Vector Store (5/5 plans) — completed 2026-05-08
- [x] Phase 5: Indonesian Eval Harness (2/2 plans) — completed 2026-05-17
- [x] Phase 6: AI Explanation Generation (5/5 plans) — completed 2026-05-18
- [x] Phase 7: Citation UI & PDF Viewer (3/3 plans) — completed 2026-05-19
- [x] Phase 8: AI Score & Drill-Down (4/4 plans) — shipped with HUMAN-UAT outstanding
- [x] Phase 9: Stock Data & Trend Chart (4/4 plans) — shipped without VERIFICATION.md
- [x] Phase 10: Chat Interface (5/5 plans) — shipped without VERIFICATION.md
- [x] Phase 11: Observability & Reliability (4/4 plans) — completed 2026-05-24
- [x] Phase 12: Polish & Public Launch (4/4 plans) — shipped without VERIFICATION.md

**Closed with known gaps.** See [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) and Backlog 999.1–999.5 below.

</details>

### 📋 v1.1 (TBD)

No phases planned yet. Run `/gsd-new-milestone` to define v1.1 scope.

The most immediate v1.1 candidates are the four code-level launch blockers identified in the v1.0 audit (R1–R4) plus the verification-paperwork backlog (999.1–999.5).

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Setup & Foundation | v1.0 | 6/6 | Complete | 2026-05-06 |
| 2. PDF Upload & Storage | v1.0 | 6/6 | Complete | 2026-05-06 |
| 3. PDF Parsing & Chunking | v1.0 | 6/6 | Complete | 2026-05-08 |
| 4. Embeddings & Vector Store | v1.0 | 5/5 | Complete (human-verify deferred) | 2026-05-08 |
| 5. Indonesian Eval Harness | v1.0 | 2/2 | Complete | 2026-05-17 |
| 6. AI Explanation Generation | v1.0 | 5/5 | Complete (no VERIFICATION.md) | 2026-05-18 |
| 7. Citation UI & PDF Viewer | v1.0 | 3/3 | Complete (no VERIFICATION.md) | 2026-05-19 |
| 8. AI Score & Drill-Down | v1.0 | 4/4 | Complete (HUMAN-UAT deferred) | 2026-05-19 |
| 9. Stock Data & Trend Chart | v1.0 | 4/4 | Complete (no VERIFICATION.md) | 2026-05-22 |
| 10. Chat Interface | v1.0 | 5/5 | Complete (no VERIFICATION.md) | 2026-05-24 |
| 11. Observability & Reliability | v1.0 | 4/4 | Complete | 2026-05-24 |
| 12. Polish & Public Launch | v1.0 | 4/4 | Complete (no VERIFICATION.md) | 2026-05-24 |

---

## Backlog

Deferred work that should be resolved before the next public release.
Numbering follows the `999.x` convention for deferred-from-main-roadmap entries.

### Phase 999.1: Follow-up — Phase 8 HUMAN-UAT incomplete (BACKLOG)

**Goal:** Complete the pending human-UAT for Phase 8 (AI Score & Drill-Down).
**Source phase:** 8
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**Pending tests:**
- [ ] Score card renders correctly on a real document (`milestones/v1.0-phases/08-ai-score-drill-down/08-HUMAN-UAT.md` if archived; otherwise `.planning/phases/08-ai-score-drill-down/08-HUMAN-UAT.md`)
- [ ] Null score fallback visible
- [ ] All remaining tests in `08-HUMAN-UAT.md` (currently `status: partial`, `[awaiting human testing]` since 2026-05-19)
**Why deferred:** Verification report status is `human_needed` — auditor cannot exercise interactive accordion / PDF scroll callbacks in headless mode. Force-advanced without human confirmation.
**Risk:** Score card may have visual/interaction defects not caught by automated checks.

### Phase 999.2: Follow-up — Phase 9 verification never run (BACKLOG)

**Goal:** Run `/gsd-verify-work 9` to produce `09-VERIFICATION.md` for Stock Data & Trend Chart.
**Source phase:** 9
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**State on disk:** 4/4 plans implemented, 4 SUMMARY.md files present, no VERIFICATION.md, no UAT.
**Why deferred:** Force-advanced without verification gate.
**Risk:** Goal-backward verification has not confirmed delivery of TICKER-01/02, STOCK-01..05, CHART-01/02 requirements.

### Phase 999.3: Follow-up — Phase 10 verification never run (BACKLOG)

**Goal:** Run `/gsd-verify-work 10` to produce `10-VERIFICATION.md` for Chat Interface.
**Source phase:** 10
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**State on disk:** 5/5 plans implemented, 5 SUMMARY.md files present, no VERIFICATION.md.
**Why deferred:** Force-advanced without verification gate.
**Risk:** Goal-backward verification has not confirmed delivery of CHAT-01..06 requirements. CHAT-06 (buy/sell hard-block) is compliance-critical. The integration checker confirmed code-level wiring of CHAT-06 (`/api/chat/route.ts:116` pre-LLM guardrail) — adversarial UAT still pending.

### Phase 999.4: Follow-up — Phase 12 verification never run (BACKLOG)

**Goal:** Run `/gsd-verify-work 12` to produce `12-VERIFICATION.md` for Polish & Public Launch.
**Source phase:** 12
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**State on disk:** 4/4 plans implemented, 4 SUMMARY.md files present, no VERIFICATION.md.
**Why deferred:** Force-advanced without verification gate.
**Risk:** Goal-backward verification has not confirmed DISCLAIM-01/03, UX-03, INFRA-02 delivery. Public-launch readiness is unverified.

### Phase 999.5: Sync STATE.md and ROADMAP table with disk reality (BACKLOG)

**Goal:** Reconcile `.planning/STATE.md` and `.planning/ROADMAP.md` against actual phase-directory contents and the audited reality.
**Source phase:** N/A (cross-cutting bookkeeping)
**Deferred at:** 2026-06-06
**Drift observed pre-archive:**
- STATE.md `total_phases` auto-set to 17 by `gsd-tools milestone complete` (counted backlog entries as phases — actual milestone is 12)
- STATE.md `current_phase` and `Phase Progress` table reflect mid-May reality
- ROADMAP Progress table (now archived) misrepresented Phases 5–9 as "Not started / Planned · 0 plans" while shipped
**Why deferred:** Surfaced during /gsd-next completeness scan and milestone close. Not blocking but causes future /gsd-next routing errors.
**Risk:** Future GSD sessions read stale phase state.

### Phase 999.6: Fix v1.0 code-level launch blockers (R1–R4) (BACKLOG)

**Goal:** Address the four critical code-level issues surfaced by `gsd-integration-checker` during the v1.0 audit.
**Source phase:** v1.0 audit (`milestones/v1.0-MILESTONE-AUDIT.md`)
**Deferred at:** 2026-06-06 milestone close
**Items:**
- **R1:** `vercel.json` cron auth method mismatch — handlers accept `?secret=`, crons hit bare path → 401
- **R2:** No cron registered for `/api/internal/analyze-batch` — soft-fail in `analyze-document-batch.ts:273` never auto-resumes
- **R3:** No cron registered for `/api/cron/keep-alive` — Supabase free-tier inactivity pause risk
- **R4:** Session-ownership TODO in `src/app/doc/[documentId]/page.tsx:84` — anyone with documentId reads explanation + signed PDF URL
**Why deferred:** Force-closed v1.0 with these unresolved.
**Risk:** R1+R2 cause silent pipeline stalls under retry. R4 is a privacy gap that contradicts the implicit security contract of anonymous browser-keyed v1.
**Estimated effort:** 2–4 hours total.

---

*Roadmap last reorganized: 2026-06-06 at v1.0 milestone close*
