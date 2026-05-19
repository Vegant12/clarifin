---
phase: 08-ai-score-drill-down
plan: 04
subsystem: ui
tags: [react, nextjs, shadcn, accordion, score-card, typescript]

requires:
  - phase: 08-02
    provides: ScoreResult type and scoreSchema for prop typing
  - phase: 08-03
    provides: score_breakdown column in document_analysis DB table
  - phase: 07-citation-ui-pdf-viewer
    provides: CitationInline component reused in ScoreCard snippets

provides:
  - ScoreCard client component with Accordion drill-down and CitationInline reuse
  - ScoreLoadingSkeleton animate-pulse placeholder
  - score: ScoreResult | null threaded through full component chain
  - page.tsx RSC fetches score_breakdown, safeParse via scoreSchema
  - "AI Assessment unavailable" muted fallback when score is null

affects: phase-09, phase-10, phase-11

tech-stack:
  added: []
  patterns: [shadcn Accordion for drill-down disclosure, score-null fallback pattern, RSC single-query pattern for co-located fields]

key-files:
  created:
    - src/components/doc/score-card.tsx
    - src/components/doc/score-loading-skeleton.tsx
  modified:
    - src/components/doc/explanation-panel.tsx
    - src/components/doc/document-reader-layout.tsx
    - src/components/doc/mobile-tab-view.tsx
    - src/components/doc/document-progress-view.tsx
    - src/app/doc/[documentId]/page.tsx
    - src/components/doc/__tests__/score-card.test.tsx
    - tests/components/explanation-panel.test.tsx
    - tests/components/__snapshots__/explanation-panel.test.tsx.snap

key-decisions:
  - "ScoreCard uses Accordion type='single' so only one dimension is open at a time"
  - "page.tsx extends existing SELECT to include score_breakdown in same query (no extra RTT)"
  - "score: ScoreResult | null threaded as explicit prop — no context/store — keeps data flow traceable"
  - "Snapshot updated to include unavailable state section (score={null} renders muted fallback)"

patterns-established:
  - "Null-safe score pattern: score ? <ScoreCard> : <unavailable section> in ExplanationPanel"
  - "RSC co-location: fetch co-located fields in one supabase query, safeParse each independently"

requirements-completed: [SCORE-02, SCORE-04, SCORE-06]

duration: 45min
completed: 2026-05-19
---

# Plan 08-04: Score Card UI Summary

**Score card UI with Accordion drill-down, [p.N] citations, and null fallback — threaded through the full RSC → DocumentProgressView → ExplanationPanel chain**

## Performance

- **Duration:** ~45 min (split across two sessions, second resumed after rate limit)
- **Started:** 2026-05-19T08:00:00Z
- **Completed:** 2026-05-19T20:55:00Z
- **Tasks:** 4
- **Files modified:** 9

## Accomplishments
- `ScoreCard` client component: overall score in 48px emerald, disclaimer, 4 dimension rows via Accordion, 1–3 snippet pull-quotes with `CitationInline` reuse
- `ScoreLoadingSkeleton` animate-pulse placeholder for loading state
- Full component chain (`page.tsx → DocumentProgressView → DocumentReaderLayout → {DesktopSplitPane, MobileTabView} → ExplanationPanel`) now accepts `score: ScoreResult | null`
- "AI Assessment unavailable" muted state renders in place of ScoreCard when score is null
- 6 score-card tests activated (RED → GREEN cycle), snapshot updated

## Task Commits

1. **Task 1 (RED):** Activate 6 score-card test stubs — `a80a326`
2. **Task 2 (GREEN):** ScoreCard + ScoreLoadingSkeleton components — `99c0b8f`
3. **Task 3:** Thread score prop through component chain — `89eb295`
4. **Task 4:** RSC page.tsx fetches score_breakdown — `ce4e9bc`
5. **Snapshot update:** ExplanationPanel snapshot updated for unavailable state — `e99ded3`

## Files Created/Modified
- `src/components/doc/score-card.tsx` — ScoreCard with Accordion, CitationInline, disclaimer
- `src/components/doc/score-loading-skeleton.tsx` — animate-pulse placeholder
- `src/components/doc/explanation-panel.tsx` — score prop, ScoreCard/unavailable rendering before SECTION_ORDER
- `src/components/doc/document-reader-layout.tsx` — score prop threaded to DesktopSplitPane and MobileTabView
- `src/components/doc/mobile-tab-view.tsx` — score prop forwarded to ExplanationPanel
- `src/components/doc/document-progress-view.tsx` — score prop forwarded to DocumentReaderLayout
- `src/app/doc/[documentId]/page.tsx` — SELECT extended to `explanation, score_breakdown`; scoreSchema.safeParse
- `src/components/doc/__tests__/score-card.test.tsx` — 6 tests activated
- `tests/components/explanation-panel.test.tsx` + snapshot — updated with `score={null}`

## Decisions Made
- Used `Accordion type="single"` (Radix/shadcn) so expanding one dimension auto-collapses others — matches plan spec
- Kept `score` as an explicit prop (no React context) to preserve traceable data flow for future debugging
- Extended the existing `document_analysis` SELECT to co-locate `score_breakdown` — avoids a second DB round-trip
- Snapshot update is intentional: the unavailable section is part of the spec (SCORE-06 muted state)

## Deviations from Plan
None — plan executed as specified. Session split by rate limit; work resumed inline on second session.

## Issues Encountered
- Previous agent hit Gemini rate limit mid-execution; uncommitted working-tree changes (component chain threading) were recovered and committed cleanly on resume.
- Vitest snapshot test failed after ExplanationPanel gained the unavailable section — updated with `--update` flag, expected behavior.

## Next Phase Readiness
- Phase 8 backend + UI complete: score JSON written to DB by cron batch, rendered in `/doc/[id]` via ScoreCard
- Phase 9 (Stock Data & Trend Chart) and Phase 10 (Chat Interface) are independent and ready to execute

---
*Phase: 08-ai-score-drill-down*
*Completed: 2026-05-19*
