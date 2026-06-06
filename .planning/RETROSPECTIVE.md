# Clarifin Retrospective

Living document. Each milestone appends a section reflecting on what worked, what didn't, and what to carry forward.

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-06 (force-closed with documented gaps)
**Timeline:** 2026-05-02 → 2026-06-06 (35 calendar days)
**Phases:** 12 | **Plans:** 36 | **Tasks:** 45 | **Commits:** 272

### What Was Built

The full doc→understanding wedge end-to-end: PDF upload → page-preserving parse → pgvector embedding → Gemini explanation with `[p.N]` citations → 1–10 AI score with 4-dimension drill-down → stock context + multi-year trend chart → RAG chat with pre-LLM buy/sell guardrail. Five disclaimer surfaces, Langfuse tracing on four LLM call sites, INFRA-03 concurrency cap, INFRA-04 PDF cleanup, INFRA-05 keep-alive cron, INFRA-02 per-IP rate limit, first-time onboarding modal, 375px mobile fallback.

Eval harness ran 9 IDX documents and scored 97.8% numeric / 92.6% citation accuracy — the Phase 6 sign-off gate.

### What Worked

- **The wedge stayed sharp.** No scope creep into TA, portfolio features, auto-fetch, or multi-stock comparison. The seed in `seeds/ta-module-standalone.md` is documented as v2+ optionality with explicit scope-conflict notice — not promoted.
- **Eval-harness-first ordering.** Phase 5 (eval harness) gating Phase 6 (explanation generation) caught prompt-engineering issues before they became user-facing defects. 97.8/92.6 scores on 9 IDX documents gave a defensible launch signal.
- **Page-level citations from chunk metadata up.** Locking `{doc_id, page_number, source_page_start/end, chunk_type}` in the Phase 1 migration meant every downstream feature (Phase 6 citations, Phase 7 click-to-jump, Phase 10 RAG with citations) got page provenance for free.
- **Schema-validation at every trust boundary.** Zod on the stock fetcher, generateObject with strict JSON schema for the score, vitest tests on all of it. The shipped code has very few "any" escape hatches.
- **Pre-LLM guardrail for CHAT-06.** Running `isInvestmentAdviceQuery` BEFORE `streamText` means compliance deflections cost zero Gemini tokens. Smart resource use under free-tier constraints.
- **Pattern reuse across phases.** Phase 10's RAG glossary injection reused Phase 6's `PSAK_GLOSSARY` instead of redefining — no drift. Phase 12's disclaimer pattern reused across explanation/chat/score surfaces.
- **Integration checker as evidence.** Even where formal VERIFICATION.md was missing, `gsd-integration-checker` provided code-level proof that wiring was real — turned what looked like 33 unsatisfied REQs into 25 satisfied + 34 partial.

### What Was Inefficient

- **Verification debt accumulated silently.** Phases 6, 7, 9, 10, 12 shipped with no VERIFICATION.md. By the time the audit ran at milestone close, the paperwork debt looked overwhelming. Earlier `/gsd-verify-work` cadence (run after each phase, not at milestone) would have caught this in days, not weeks.
- **STATE.md and ROADMAP drift.** STATE.md's Phase Progress table reflected mid-May reality while disk had advanced through end-May. ROADMAP's Progress table said Phases 5–9 had "0 plans complete" when they were fully implemented. Future `/gsd-next` runs were routing incorrectly. Manual reconciliation took an entire `/gsd-next` cycle.
- **SUMMARY frontmatter inconsistent.** Of 36 plan summaries, only ~10 had usable `requirements_completed` frontmatter. Five summaries returned the literal string "One-liner:" from `summary-extract`. Made the 3-source audit cross-reference noisy.
- **Phases 1–3 directories archived without VERIFICATION.md.** When directories were removed (commit `972ca1b`), the verification artifacts went with them. Orphaned the early INFRA/INGEST REQ-IDs in the audit.
- **HUMAN-UAT 08 sat partial for 18 days.** Once an interactive UAT gets blocked on human action, nothing pulls it forward. Needs an explicit reminder loop or a `/gsd-next` step that surfaces stale partial UATs.
- **Rendering bugs surfaced as quick tasks late in milestone.** Three quick tasks (260525-dl3, 260525-eq2, 260526-c5k) all touched citation/markdown rendering paths in late May. STATE.md flagged this: "consider consolidation/regression pass before more polish." Sign that rendering needs a regression suite, not piecemeal fixes.
- **Model substitution undocumented in VERIFICATION frontmatter.** Phase 4 swapped `text-embedding-004` → `gemini-embedding-001` (404 on the v1beta endpoint). The substitution was documented in 04-02-SUMMARY.md but never promoted to a `VERIFICATION.md` `overrides:` block, leaving an open anti-pattern flag.

### Patterns Established

- **Eval-harness gate before user-facing AI ships.** Phase 5 → Phase 6 sequencing is now the playbook for any AI-output-quality requirement.
- **Server-only + Zod + RPC permission scope** as the trust boundary for any third-party data fetcher (yahoo-finance2, Gemini, Langfuse). Public RPCs default-revoke, grant only to service_role.
- **Page citations through chunk metadata.** Lock the schema on day one; never let chunks travel without page provenance.
- **Pre-LLM guardrail (not post-processing).** Cheaper, more reliable, easier to test in isolation.
- **`server-only` boundary enforcement** on all secret-bearing client modules. Caught at least once during Phase 11 Langfuse setup.

### Key Lessons

1. **Verify per-phase, not per-milestone.** A `/gsd-verify-work` checkpoint immediately after `/gsd-execute-phase` would have caught coverage gaps in days. Batching verification at milestone close is too late.
2. **SUMMARY.md frontmatter discipline matters more than it looks.** When `summary-extract` returns "One-liner:" as a literal string, the milestone audit cross-reference is broken. Plan summaries need a required `one_liner:` and `requirements_completed:` field validated before commit.
3. **Cron auth review is a vercel.json gotcha.** A handler that accepts `?secret=` is meaningless if the cron config calls the bare path. This needs a `vercel.json` linter step before deploy.
4. **Audit BEFORE you assume done.** STATE.md and ROADMAP claimed Phase 11/12 complete; reality was Phase 12 had no VERIFICATION at all. Without `/gsd-audit-milestone` we would have tagged v1.0 with launch-blocking bugs invisible to STATE.md.
5. **Integration-level evidence can substitute for paperwork.** When the integration checker confirms code-level wiring of a REQ, that's stronger evidence than a checklist. The audit format should weight "wired in code" higher than "checked off in markdown."

### Cost Observations

- Total commits: 272 across 35 days (≈7.8/day)
- Most expensive session signal: the rendering-bug cluster in late May (3 quick tasks touching same files) — a sign of insufficient regression coverage at the explanation/chat layer
- The audit + integration check at milestone close cost roughly 145s subagent time + ~73K subagent tokens for very high signal — well worth running before any future close

### Carry-Forward for v1.1

- Fix R1–R4 first (cron auth, missing crons, session-ownership) — 2–4 hours estimated
- Backfill VERIFICATION.md for Phases 6/7/9/10/12 OR formally accept the integration-checker output as verification evidence in a v1.0 audit override
- Sync STATE.md `total_phases` (currently 17, should be 12) and reconcile Phase Progress table
- Establish per-phase verify cadence in `/gsd-execute-phase` (not just at milestone close)
- Add `vercel.json` cron-auth linter step

---

## Cross-Milestone Trends

(populated after v1.1 ships)

| Metric | v1.0 |
|---|---|
| Calendar days | 35 |
| Commits | 272 |
| Phases | 12 |
| Plans | 36 |
| Tasks | 45 |
| Eval harness score | 97.8% numeric / 92.6% citation |
| Requirements satisfied at close | 25/60 (42%) |
| Requirements partial at close | 34/60 (57%) |
| Code-level launch blockers at close | 4 |
| Closure mode | force-close (`--force` with gaps_found audit) |
