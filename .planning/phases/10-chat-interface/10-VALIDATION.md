---
phase: 10
slug: chat-interface
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
updated: 2026-05-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (already installed; jsdom environment for `src/components/**/*.test.tsx`, node default elsewhere) |
| **Config file** | `vitest.config.ts` (present in repo root) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~10 seconds (current full suite); +1-2s with Phase 10 additions |

Phase 10 net-new test files: 6 unit tests in Wave 0 (Plan 01), turned GREEN across Waves 1-4. No new framework — extends the existing Vitest infrastructure used in Phases 4, 5, 7, 8, 9.

---

## Sampling Rate

- **After every task commit:** Run `pnpm test src/lib/chat src/app/api/chat src/app/api/starter-questions src/components/chat --run` (~3-5 seconds — scoped to phase 10 paths)
- **After every plan wave:** Run `pnpm test --run` (full suite, ~10 seconds)
- **Before `/gsd-verify-work`:** Full suite must be green AND `pnpm typecheck` exits 0
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | INFRA | T-10-01 | Pinned exact ai@4.3.19 (lockfile-integrity baseline against supply-chain tampering) | Manifest+migration grep | `node -e "require('ai/package.json').version"`; `grep -q 'starter_questions jsonb' supabase/migrations/20260520120000_starter_questions.sql` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 0 | INFRA | T-10-03 | Nullable column add is O(1) catalog-only (no table rewrite, no DoS) | Human-gated DB push + grep | `grep -c starter_questions src/db/database.types.ts` (≥3) | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 0 | CHAT-01, CHAT-02, CHAT-04, CHAT-05, CHAT-06 | T-10-02 | 6 RED test stubs encode the contract surface before implementation | Unit (Vitest stubs, intentional RED) | `pnpm test src/lib/chat src/app/api/chat src/app/api/starter-questions --run 2>&1 \| grep -E 'Cannot find module\|Failed to resolve'` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | CHAT-06 | T-10-15 (advice-bypass) | Pure-function guardrail; 10 EN+ID variants blocked; word boundaries respected (no false positives) | Unit | `pnpm test src/lib/chat/guardrail.test.ts --run` | ✅ from W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | CHAT-02, DISCLAIM-01 | T-10-10 (prompt injection) | System prompt enforces "answer only from context", emits `[p.N]` citations, hard-codes no-advice clause and disclaimer | Unit | `pnpm test src/lib/chat/prompts.test.ts --run` | ✅ from W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | CHAT-05 | T-10-17 (cache injection) | Zod schema validates 5×≤120-char strings; rejects wrong cardinality / oversized strings | Unit | `pnpm test src/lib/chat/starter-questions-schema.test.ts --run` | ✅ from W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | CHAT-01, CHAT-02, CHAT-06 | T-10-12, T-10-13, T-10-16 | `server-only` import + Zod ChatRequestSchema + guardrail short-circuit before LLM + every chat_messages insert includes BOTH session_id AND doc_id | Unit (route handler with hoisted mocks) | `pnpm test src/app/api/chat/route.test.ts --run` | ✅ from W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | CHAT-05 | T-10-04, T-10-13 | `server-only` + cache-then-generate (1 generation per doc, not per session-open — DoS quota mitigation); re-validates cached jsonb through StarterQuestionsSchema before return | Unit (route handler) | `pnpm test src/app/api/starter-questions/route.test.ts --run` | ✅ from W0 | ⬜ pending |
| 10-03-03 | 03 | 2 | CHAT-01..06 regression | (cross) | All 5 Phase 10 test files green; typecheck clean | Aggregate (typecheck + scoped tests) | `pnpm typecheck 2>&1 \| tail -3 ; pnpm test src/lib/chat src/app/api/chat src/app/api/starter-questions --run 2>&1 \| tail -5` | n/a | ⬜ pending |
| 10-04-01 | 04 | 3 | CHAT-01, CHAT-02, CHAT-03, DISCLAIM-01 | T-10-10 (prompt injection persisted) | Leaf React components: CitationInline (reuse from Phase 7), ChatMessage (text via React interpolation, no innerHTML), ChatLoadingSkeleton, StarterQuestions, GuardrailDeflection, disclaimer footer | Unit (jsdom render tests) | `pnpm test src/components/chat --run` | ❌ W0 deferred (jsdom render tests created in Plan 04) | ⬜ pending |
| 10-04-02 | 04 | 3 | CHAT-01, CHAT-02, CHAT-03, CHAT-05, CHAT-06 | T-10-13 | ChatInterface uses `useChat` from `ai/react` (v4 import, NOT `@ai-sdk/react`); body = {documentId, sessionId} (Pitfall 4); initialMessages prop; ChatPanel composes the above | Unit (jsdom — Plan 04 owns) | `pnpm test src/components/chat --run` | ❌ W0 deferred | ⬜ pending |
| 10-05-01 | 05 | 4 | CHAT-04, CHAT-05 | T-10-24, T-10-25, T-10-26 | RSC validates `searchParams.sessionId` via Zod UUID safeParse (fallback to null on bad input); chat_messages query scopes by BOTH `.eq("session_id", sessionId)` AND `.eq("doc_id", documentId)`; 7-day TTL filter `.gte("created_at", sevenDaysAgo)`; `.limit(40)` payload cap; production base-URL uses `process.env.VERCEL_URL` first (loopback-safe on Vercel deployments) | Unit (session-restore helper — RED stub in W0, GREEN in Plan 05) + RSC typecheck | `pnpm test src/lib/chat/session-restore.test.ts --run` ; `pnpm typecheck 2>&1 \| tail -5` ; `grep -c starter_questions src/app/doc/[documentId]/page.tsx` | ✅ from W0 (session-restore.test.ts) | ⬜ pending |
| 10-05-02 | 05 | 4 | CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06 | T-10-27 | ChatPanel mounted UNCONDITIONALLY in DocumentReaderLayout + MobileTabView; ChatInterface disables submit (not the pills) while sessionId is empty and renders an aria-live="polite" "Setting up your chat session…" status | Unit (no new test — covered by Plan 04 ChatInterface jsdom test + literal-string grep in acceptance criteria) | `pnpm typecheck 2>&1 \| tail -5 ; pnpm test --run 2>&1 \| tail -5 ; grep -c 'sessionId ?? ""' src/components/doc/document-reader-layout.tsx src/components/doc/mobile-tab-view.tsx` | ✅ (covered by Plan 04 jsdom suite + frontmatter grep acceptance) | ⬜ pending |
| 10-05-03 | 05 | 4 | CHAT-01..06 + DISCLAIM-01 | (E2E behavioral) | Live human verify across 7 sections (A: desktop happy path, B: empty retrieval, C: guardrail EN+ID, D: session restore, E: mobile tabs, F: disclaimer visibility, G: console/network sanity — no @google/genai calls from browser) | Manual (blocking checkpoint) | `pnpm typecheck 2>&1 \| tail -2 ; pnpm test --run 2>&1 \| tail -2` — automated guard runs; behavioral verification is manual per AI-SPEC §5 | n/a | ⬜ pending (manual UAT) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** No 3 consecutive tasks lack `<automated>` verify. The only manual-only verification is 10-05-03 (the final human UAT checkpoint), preceded by 10-05-01 and 10-05-02 which both carry automated commands — continuity preserved.

---

## Wave 0 Requirements

- [ ] `src/lib/chat/guardrail.test.ts` — stubs for CHAT-06 (10 EN+ID phrase variants)
- [ ] `src/lib/chat/prompts.test.ts` — stubs for CHAT-02 (system prompt structure)
- [ ] `src/lib/chat/starter-questions-schema.test.ts` — stubs for CHAT-05 (Zod schema)
- [ ] `src/lib/chat/session-restore.test.ts` — stubs for CHAT-04 (7-day TTL + dual scoping)
- [ ] `src/app/api/chat/route.test.ts` — stubs for CHAT-01, CHAT-02, CHAT-06 (route handler with hoisted mocks)
- [ ] `src/app/api/starter-questions/route.test.ts` — stubs for CHAT-05 (cache-then-generate route)
- [ ] Package install: `pnpm add ai@4.3.19 @ai-sdk/google@1.2.22 @ai-sdk/groq@1.2.9 --save-exact`
- [ ] Supabase migration applied: `supabase/migrations/20260520120000_starter_questions.sql` (document_analysis.starter_questions jsonb)

No new framework install required — Vitest 2.1.9 + jsdom are already in `devDependencies`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TTFT < 2000ms at p50 | CHAT-03 | Streaming time-to-first-byte depends on real Gemini API latency; cannot be deterministically tested in CI without LLM mocking (which defeats the purpose). Production p50 will be tracked in Phase 11 via Langfuse `generation.latency`. | During Plan 05 human-verify section A.5: open DevTools Network tab → submit a chat question → record `/api/chat` "Time to first byte". Target p50 < 2000ms across 3 trials. |
| Context faithfulness (no hallucination) | CHAT-02 quality | Requires human review against a known IDX annual report. AI-SPEC §5 defers RAGAS-based eval (`python scripts/eval/faithfulness.py`) to Phase 11 observability. | Plan 05 human-verify section A.6: confirm at least one `[p.N]` citation pill appears in the assistant response and clicking it scrolls the PDF to the cited page. |
| Mobile virtual-keyboard layout | CHAT-01 mobile | Vitest+jsdom cannot exercise iOS/Android soft keyboard overlap behavior; needs a real device or browser emulation with touch events. | Plan 05 human-verify section E.3: resize to ≤768px (or emulate iPhone-12 in DevTools), open Chat tab, tap the textarea, confirm the input is not covered by the on-screen keyboard. |
| Indonesian-language guardrail behavioral correctness | CHAT-06 ID variants | The regex in `guardrail.ts` is tested with 4 ID phrases. Behavioral robustness across more natural Indonesian phrasings (vocative, interrogative, formal vs. casual) is best validated with a native speaker. | Plan 05 human-verify section C.2: tester submits at least 2 Bahasa Indonesia investment-advice phrasings and confirms each yields the GuardrailDeflection bubble within ~500ms (no LLM call). |
| Browser-side key disclosure check | T-10-13 (API key leak) | jsdom cannot inspect a real browser's network log for outbound `generativelanguage.googleapis.com` calls; this is observable only in a live browser. | Plan 05 human-verify section G.1: open DevTools Network, confirm only `/api/chat`, `/api/starter-questions`, `/api/session`, `/api/status`, `/api/page-text` appear — no calls to `@google/genai` endpoints from the browser. |

All other Phase 10 behaviors are covered by automated Vitest unit tests.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (6 RED stubs map to CHAT-01..06)
- [x] No watch-mode flags (`--run` used consistently)
- [x] Feedback latency < 10s (scoped path runs ~3-5s; full suite ~10s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-21 (revision 1 — addresses checker BLOCKER on VALIDATION.md template-placeholder state)
