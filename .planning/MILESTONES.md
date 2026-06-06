# Milestones

## v1.0 MVP (Shipped: 2026-06-06)

**Status:** ✅ Shipped with known gaps — see [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)
**Phases completed:** 12 phases, 36 plans, 45 tasks
**Timeline:** 2026-05-02 → 2026-06-06 (35 days, 272 commits)
**Closure:** Force-closed via `/gsd-complete-milestone 1.0 --force` accepting `gaps_found` audit

### What Shipped

The wedge: upload an IDX financial PDF → get a plain-English explanation with page citations, an AI score with drill-down, stock context with multi-year trend chart, and a follow-up chat that hard-blocks buy/sell language.

### Key Accomplishments

- **Phase 4 — Embeddings:** Server-only `embedTextBatch` using `gemini-embedding-001` (768 dims) with batchEmbedContents REST, bounded exponential retry on 429/5xx, HNSW pgvector index, `match_document_chunks` RPC restricted to service_role
- **Phase 5 — Eval Harness:** `pnpm eval` against 9 IDX documents (97.8% numeric / 92.6% citation accuracy passed gate); Phase 6 sign-off gate established
- **Phase 6 — Explanation:** Gemini Files API, 5-section plain-English output with `[p.N]` inline citations, Bahasa Indonesia handling, streaming to UI, cached per-document in `document_analysis`
- **Phase 7 — Citation UI:** Split-pane desktop reader, click-to-jump from citation to PDF page, hover popover with source-text quote, jargon tooltips, mobile tab fallback
- **Phase 8 — AI Score:** Schema-validated 1–10 score via `generateObject`, 4-dimension drill-down (Profitability, Balance Sheet, Growth, Valuation Context) with 1–3 cited snippets per dimension, Accordion UI threaded through full RSC chain
- **Phase 9 — Stock & Chart:** Pure-regex IDX ticker detector (16 passing tests), server-only yahoo-finance2 fetcher with 24h Supabase cache, exponential backoff, `formatIDR`/`formatIDRShort` ("Rp 85 triliun"), Recharts multi-year trend; `/api/stock/[ticker]` route with Zod validation at every boundary
- **Phase 10 — Chat:** Streaming RAG chat route with PSAK glossary injection, cache-then-generate starter questions, 6 client components (ChatPanel, ChatInterface, ChatMessage, GuardrailDeflection, StarterQuestions, ChatLoadingSkeleton), 7-day session restore from `chat_messages`, CHAT-06 buy/sell guardrail enforced BEFORE `streamText` (zero LLM cost on deflection)
- **Phase 11 — Observability:** Singleton Langfuse v3 client with `server-only` boundary, four LLM call sites instrumented (explanation/score Pattern A try/catch/finally, chat/starter-questions Pattern B with onFinish closure), `flushAsync` placement TDD-verified; INFRA-03 concurrency cap, INFRA-04 PDF cleanup post-embedding, INFRA-05 weekly keep-alive cron
- **Phase 12 — Polish:** Inline disclaimer labels on score/explanation/chat surfaces (DISCLAIM-01), per-IP daily upload rate limiting (INFRA-02), first-time onboarding modal (DISCLAIM-03), 375px mobile responsive layout (UX-03)

### Cross-cutting work (quick tasks during v1.0)

| # | Description | Date |
|---|---|---|
| 260525-dl3 | Fix four pre-phase-12 bugs (post-analysis navigation, PDF viewer, chat connection error, citation popover flicker) | 2026-05-25 |
| 260525-eq2 | Chat markdown rendering + chat citation popover verification + PDF/parse-pipeline diagnostics | 2026-05-25 |
| 260526-c5k | ExplanationPanel markdown rendering + multi-page citation parsing (`[p.49, p.111]`) — shared `renderInlineWithCitations` helper | 2026-05-26 |

### Known Gaps at Close (force-closed, see audit)

**Requirements coverage:** 25/60 satisfied (code-wired + verified), 34/60 partial (wired, no formal verification), 1/60 unsatisfied (UX-03 session-ownership TODO).

**Verification debt (paperwork):**
- Phase 4 VERIFICATION.md status `human_needed` (E2E embedding + HNSW <500ms smoke)
- Phase 8 VERIFICATION.md status `human_needed`; 08-HUMAN-UAT.md `partial` (18 days stale)
- Phases 6, 7, 9, 10, 12 have no VERIFICATION.md
- Phase 5 plans did not declare formal REQ-IDs (EVAL-01..04 implicit via fixture readiness)

**Code-level launch blockers (R1–R4 — not paperwork):**
- **R1:** `vercel.json` cron auth method mismatch (handlers want `?secret=`, crons hit bare path → 401)
- **R2:** No cron for `/api/internal/analyze-batch` (analyze soft-fails never auto-resume)
- **R3:** No cron for `/api/cron/keep-alive` (Supabase free-tier inactivity risk)
- **R4:** Session-ownership TODO in `src/app/doc/[documentId]/page.tsx:84` (anyone with documentId reads explanation + signed PDF URL)

Backlog entries 999.1–999.6 in [ROADMAP.md](ROADMAP.md) track all of the above. Estimated 2–4 hours of code work to clear R1–R4 plus 08-HUMAN-UAT.

### Integration-Verified E2E Flow (cross-phase wiring)

The `gsd-integration-checker` confirmed all six E2E flows are CONNECTED in shipped code:
1. Upload → ready (the wedge) — `trigger-parse-batch` → `parse-batch` → `embed-batch` → `analyze-batch`
2. /doc/[id] explanation + citations — `parseCitations` → `CitationPopover` → `onGoToPage` → `PdfViewerHandle.scrollToPage`
3. Score drill-down — `ScoreCard` threaded through `ExplanationPanel`
4. Chat + RAG + hard-block — `/api/chat/route.ts:116` `isInvestmentAdviceQuery` BEFORE `streamText`
5. Stock + trend chart — `fetchStockDataForDocument` in RSC
6. Disclaimers (5 surfaces) + observability (4 LLM call sites with Langfuse)

---
