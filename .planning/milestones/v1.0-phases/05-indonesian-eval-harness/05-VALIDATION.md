---
phase: 5
slug: indonesian-eval-harness
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `pnpm vitest run src/lib/eval/score-run.test.ts` |
| **Full suite command** | `pnpm test` |
| **Live harness** | `GEMINI_API_KEY=... pnpm eval` |
| **Estimated runtime** | ~2s (offline unit); ~3-5 min (live harness) |

---

## Sampling Rate

- **After every fixture committed:** Run `pnpm vitest run src/lib/eval/score-run.test.ts` (offline, <2s)
- **After every plan wave:** Run `GEMINI_API_KEY=... pnpm eval` (live harness, all ready slots)
- **Before `/gsd-verify-work`:** All 9 documents `ready` + `pnpm eval` exits 0
- **Max feedback latency:** 2 seconds (offline); 5 minutes (live)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | EVAL-01 | — | N/A | integration | `pnpm eval` exits non-zero until all 9 ready | `eval/manifest.json` ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | EVAL-02 | — | N/A | unit | `pnpm vitest run src/lib/eval/score-run.test.ts` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | EVAL-03 | — | N/A | integration | `pnpm eval 2>&1` shows per-doc lines | ✅ | ⬜ pending |
| 05-01-04 | 01 | 1 | EVAL-04 | — | N/A | integration | `pnpm eval` single command | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | EVAL-01 | — | N/A | integration | `pnpm eval` exits 0 (all 9 ready) | `eval/fixtures/` ✅ | ⬜ pending |
| 05-02-02 | 02 | 2 | EVAL-02 | — | N/A | integration | `EVAL_PROMPT_VARIANT=broken pnpm eval` exits non-zero | ✅ | ⬜ pending |
| 05-02-03 | 02 | 2 | EVAL-02 | — | N/A | unit | `pnpm vitest run src/lib/eval/score-run.test.ts` (covers 0% path) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — test infrastructure is complete. No new test files need to be created before execution.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF ground-truth accuracy | EVAL-02 | Requires human review of actual IDX filings to verify financial figures match ground-truth JSON | Open each PDF + compare key figures in fixture JSON against official document values |
| Citation page accuracy | EVAL-02 | Requires visual confirmation that cited page numbers reference the correct data | Open PDF at `allowedPages` values and confirm claimed fact appears on that page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s (live harness)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
