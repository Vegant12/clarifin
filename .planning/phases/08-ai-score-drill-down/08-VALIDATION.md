---
phase: 8
slug: ai-score-drill-down
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | inferred from `package.json` (`"test": "vitest run"`) |
| **Quick run command** | `npx vitest run src/lib/explain/__tests__/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/explain/__tests__/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | SCORE-01 | — | Wave 0 test stubs | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | SCORE-01 | T-V5 | `scoreSchema.parse()` validates all LLM output before DB write | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 1 | SCORE-02 | T-V5 | `dimensions.length` exactly 4 enforced by schema | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-03 | 02 | 1 | SCORE-03 | T-V5 | `buildScorePrompt` contains no-recommendation clause | unit | `npx vitest run src/lib/explain/__tests__/score-prompts.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-04 | 02 | 1 | SCORE-04 | T-V5 | `snippets` min 1 max 3 enforced; page positive | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-05 | 02 | 1 | SCORE-05 | T-Repudiation | Compliance regex blocks "buy","sell","recommend" before persist | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ W0 | ⬜ pending |
| 8-03-01 | 03 | 2 | SCORE-01 | — | `generateScore` calls Gemini with correct model ID | unit | `npx vitest run src/lib/explain/__tests__/generate-score.test.ts` | ❌ W0 | ⬜ pending |
| 8-04-01 | 04 | 3 | SCORE-06 | — | `ScoreCard` renders "AI Assessment · not financial advice" text | unit | `npx vitest run src/components/doc/__tests__/score-card.test.tsx` | ❌ W0 | ⬜ pending |
| 8-04-02 | 04 | 3 | SCORE-06 | — | Disclaimer is adjacent to score number in DOM | unit | `npx vitest run src/components/doc/__tests__/score-card.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/explain/__tests__/score-schema.test.ts` — stubs for SCORE-01, SCORE-02, SCORE-04, SCORE-05
- [ ] `src/lib/explain/__tests__/score-prompts.test.ts` — stubs for SCORE-03
- [ ] `src/lib/explain/__tests__/generate-score.test.ts` — stubs for SCORE-01 (generation path)
- [ ] `src/components/doc/__tests__/score-card.test.tsx` — stubs for SCORE-06

*All test files are net-new. Vitest infrastructure already exists via `package.json`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Score accordion opens/closes correctly in browser | SCORE-04 | DOM interaction (Radix Accordion) requires browser render | Load a completed analysis document; click each dimension trigger; verify one-at-a-time behavior |
| "AI Assessment unavailable" message shown when score is null | SCORE-06 | Requires DB row with null score and status=ready | Set `score=null` in a test row; load document page; verify muted unavailable copy appears |
| Score number and disclaimer visually adjacent at correct sizes | SCORE-06 | Visual layout requires browser render | Load a completed analysis; verify 48px score number with `text-muted-foreground text-sm` disclaimer below |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
