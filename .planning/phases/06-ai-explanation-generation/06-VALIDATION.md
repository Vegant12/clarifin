---
phase: 6
slug: ai-explanation-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test --run && pnpm eval` |
| **Estimated runtime** | ~30 seconds (unit) + ~3 min (eval harness) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test --run && pnpm eval`
- **Before `/gsd-verify-work`:** Full suite must be green; eval harness ≥90% numeric AND ≥90% citation
- **Max feedback latency:** 30 seconds (unit only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | EXPLAIN-01 | — | 5-section JSON schema only | unit | `pnpm test --run src/lib/ingest/explain` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | EXPLAIN-02 | — | `[p.N]` citation format enforced | unit | `pnpm test --run src/lib/ingest/explain` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | TRANSLATE-01 | — | No Indonesian jargon in output | manual | `pnpm eval` (eval harness) | ✅ | ⬜ pending |
| 6-01-04 | 01 | 1 | TRANSLATE-02 | — | PSAK glossary injected | unit | `pnpm test --run src/lib/ingest/explain` | ❌ W0 | ⬜ pending |
| 6-01-05 | 01 | 1 | DISCLAIM-02 | T-6-01 | No buy/sell recommendation in prompt | unit | `pnpm test --run src/lib/ingest/explain` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | EXPLAIN-04 | — | Cache hit skips Gemini call | unit | `pnpm test --run src/app/api/internal/analyze` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | EXPLAIN-04 | — | Supabase upsert on doc_id | integration | `pnpm test --run src/app/api/internal/analyze` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | EXPLAIN-05 | — | First section available within 5s | manual | Smoke test via browser upload | ✅ | ⬜ pending |
| 6-04-01 | 04 | 2 | EXPLAIN-01–05 | — | Eval gate ≥90%/≥90% | eval | `pnpm eval` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/ingest/__tests__/explain-document-batch.test.ts` — stubs for EXPLAIN-01, EXPLAIN-02, TRANSLATE-02, DISCLAIM-02
- [ ] `src/app/api/internal/analyze-batch/__tests__/route.test.ts` — stubs for EXPLAIN-04 cache logic

*Existing infrastructure (`vitest.config.ts`, `pnpm eval`) covers all other requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No Indonesian jargon in output | TRANSLATE-01 | Requires human review of explanation prose | Upload `eval/fixtures/id-only/*.pdf`, read explanation, check for untranslated terms |
| First section appears within 5s | EXPLAIN-05 | Requires browser timing | Upload a fresh doc, open DevTools Network tab, observe streaming |
| Eval harness ≥90% numeric + citation | EXPLAIN-01/02 | Automated but must review fixture results | `pnpm eval` — check console output for threshold pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
