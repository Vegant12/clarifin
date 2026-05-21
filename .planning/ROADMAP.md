# Roadmap: Clarifin

## Overview

Clarifin is built in 12 phases, flowing from infrastructure to intelligence to polish. The dependency order is non-negotiable: the citation-bearing chunk schema must be locked in Phase 1 before any AI feature is built; the Indonesian eval harness (Phase 5) gates the AI explanation (Phase 6) to prevent shipping on an unvalidated model; and all AI features (Phases 6–10) depend on the ingestion pipeline (Phases 1–4). Stock data and the trend chart (Phase 9) are independent of chat (Phase 10) and can be planned in parallel once Phase 6 completes. The final two phases (Observability + Polish/Launch) harden the product for public release.

---

## Phases

**Phase Numbering:**
- Integer phases (1–12): Planned milestone work
- Decimal phases (e.g., 6.1): Urgent insertions via `/gsd-insert-phase`

- [x] **Phase 1: Project Setup & Foundation** — Next.js 15 + Supabase skeleton, DB schema with citation metadata, landing page
- [x] **Phase 2: PDF Upload & Storage** — Browser-direct upload to Supabase Storage, async ingestion pattern, progress polling
- [x] **Phase 3: PDF Parsing & Chunking** — unpdf page-by-page extraction, scanned PDF detection, table-atomic chunking (completed 2026-05-08; UAT `03-UAT.md` complete)
- [x] **Phase 4: Embeddings & Vector Store** — text-embedding-004, pgvector with HNSW index, similarity retriever
- [x] **Phase 5: Indonesian Eval Harness** — 9-document eval set, numeric + citation accuracy harness, Phase 6 gate
- [x] **Phase 6: AI Explanation Generation** — Gemini Files API, 5-section plain-English output, inline citations, Bahasa handling, streaming + caching
- [x] **Phase 7: Citation UI & PDF Viewer** — Split-pane desktop viewer, click-to-jump, hover popover, jargon tooltips, mobile tab fallback
- [ ] **Phase 8: AI Score & Drill-Down** — Gemini generateObject, 1-10 assessment, 4-dimension breakdown, cited evidence drill-down
- [ ] **Phase 9: Stock Data & Trend Chart** — Ticker auto-detection, yahoo-finance2, IDR formatting, Recharts multi-year trend chart
- [ ] **Phase 10: Chat Interface** — RAG-grounded streaming chat, session persistence, seeded questions, buy/sell hard-block
- [ ] **Phase 11: Observability & Reliability** — Langfuse traces + prompt versioning, concurrency cap, storage cleanup, keep-alive cron
- [ ] **Phase 12: Polish & Public Launch** — Mobile responsive layout, first-time modal, inline disclaimers, per-IP rate limiting, final eval pass

---

## Phase Details

### Phase 1: Project Setup & Foundation
**Goal**: Establish a working Next.js 15 + Supabase foundation with all database tables (including the citation-bearing chunk schema), environment configuration, and a landing page explaining the product
**Depends on**: Nothing (first phase)
**Requirements**: UX-04, INFRA-01
**Success Criteria** (what must be TRUE):
  1. Running `pnpm dev` serves the Clarifin landing page at localhost:3000 with a clear value proposition ("Upload an IDX financial PDF and get a plain-English explanation")
  2. Supabase project is connected; all DB tables (`documents`, `chunks`, `document_analysis`, `chat_sessions`, `chat_messages`) are created via a single migration with `{doc_id, page_number, section, chunk_type}` fields present on the `chunks` table from day one
  3. A 50 MB file size limit and PDF MIME-type validation reject invalid uploads server-side before any Storage operation
  4. All required environment variables are documented in `.env.example`; the app fails fast with a clear error if any are missing at startup
**Plans**: 6 plans
- [x] 01-01-PLAN.md (01-01-scaffold-tooling) — Scaffold Next.js 15 + Biome + Vitest + strict TS (Wave 0)
- [x] 01-02-PLAN.md (01-02-env-validation) — t3-env validation + server-only Supabase admin client (Wave 1)
- [x] 01-03-PLAN.md (01-03-supabase-migration) — Supabase init + single citation-safe init migration (Wave 1)
- [x] 01-04-PLAN.md (01-04-upload-validation) — INFRA-01 validatePdfUpload helper + vitest suite (Wave 1)
- [x] 01-05-PLAN.md (01-05-shadcn-and-landing) — shadcn/ui + Tailwind v4 brand tokens + landing page (Wave 1, has visual checkpoint)
- [x] 01-06-PLAN.md (01-06-apply-and-smoke) — [BLOCKING] apply migration, regenerate DB types, end-to-end smoke (Wave 2, Docker checkpoint)
**UI hint**: yes
**AI hint**: no
**Research flag**: yes — Supabase pgvector HNSW migration patterns; Next.js 15 App Router project structure conventions

---

### Phase 2: PDF Upload & Storage
**Goal**: Users can upload PDFs directly from the browser to Supabase Storage and see real-time pipeline progress while async processing runs in the background
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, INGEST-07, INGEST-08, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or file-pick a PDF (up to 20 MB) and the upload begins immediately with a visible progress indicator
  2. The upload goes browser → Supabase Storage directly — the Next.js server is never in the request body path (bypasses the 4.5 MB serverless limit)
  3. After upload, the UI transitions to a pipeline progress view showing "Parsing → Embedding → Analyzing" status, polling `/api/status?doc_id=xyz` without blocking
  4. Any error (file too large, wrong type, network failure, storage error) shows a user-friendly message with a retry action — no raw stack traces reach the UI
  5. No operation waits silently for more than 3 seconds without visible feedback
**Plans**: 6 plans
- [x] 02-01-PLAN.md (02-01-twenty-mb-cap) — 20 MB alignment: validation, tests, Storage config (Wave 1)
- [x] 02-02-PLAN.md (02-02-session-api) — POST /api/session + browser session gate (Wave 1)
- [x] 02-03-PLAN.md (02-03-upload-init) — Signed upload URL + documents row (Wave 1)
- [x] 02-04-PLAN.md (02-04-upload-complete) — Magic-byte verify + status parsing (Wave 2)
- [x] 02-05-PLAN.md (02-05-dropzone-ui) — Landing PdfDropzone + direct Storage PUT (Wave 2)
- [x] 02-06-PLAN.md (02-06-status-doc-page) — GET /api/status + /doc/[id] stepper + polling (Wave 2)
**UI hint**: yes
**AI hint**: no
**Research flag**: no — standard Supabase Storage presigned upload + Next.js route handler pattern

---

### Phase 3: PDF Parsing & Chunking
**Goal**: The ingestion pipeline reliably parses IDX PDFs page-by-page, detects scanned vs text-layer documents, and produces citation-ready chunks with preserved page boundaries
**Depends on**: Phase 2
**Requirements**: INGEST-03, INGEST-04, INGEST-05
**Success Criteria** (what must be TRUE):
  1. Uploading a 200-page digital IDX annual report produces chunks where every chunk carries the correct `page_number` (verified by spot-checking 10 random chunks against the source PDF)
  2. Uploading a scanned (image-only) IDX PDF is detected as "no text layer" and routed to Gemini Files API OCR — not to unpdf, which would produce empty chunks
  3. Financial tables are extracted as atomic chunks — no table row is split across two chunks
  4. Prose chunks target ~500 tokens with overlap; no chunk silently crosses a page boundary without both `source_page_start` and `source_page_end` fields populated
**Plans**: 6 plans
- [x] 03-01-PLAN.md (03-01-parsing-cursor-migration) — documents parsing columns + types + [BLOCKING] db push (Wave 1)
- [x] 03-02-PLAN.md (03-02-unpdf-extract) — unpdf dependency + per-page extract helpers (Wave 1)
- [x] 03-03-PLAN.md (03-03-classify-gemini-ocr) — scanned classifier + Gemini Files batch text (Wave 2)
- [x] 03-04-PLAN.md (03-04-chunk-page) — ~500-token prose + table-atomic chunking (Wave 2)
- [x] 03-05-PLAN.md (03-05-parse-batch-orchestrator) — internal parse-batch route + cron + runParseBatch (Wave 3)
- [x] 03-06-PLAN.md (03-06-upload-complete-wire) — after() trigger + base URL (Wave 3)
**UI hint**: no
**AI hint**: no
**Research flag**: yes — unpdf page extraction behavior on IDX multi-column layouts; table detection heuristics for borderless IDX tables; Gemini Files API OCR routing pattern

---

### Phase 4: Embeddings & Vector Store
**Goal**: All parsed chunks are embedded with text-embedding-004 and stored in pgvector with HNSW indexing, enabling accurate similarity retrieval with full metadata passthrough
**Depends on**: Phase 3
**Requirements**: INGEST-06
**Success Criteria** (what must be TRUE):
  1. After ingestion completes, every chunk in Supabase has `{doc_id, page_number, section, chunk_type, content, embedding}` — no null metadata fields on any chunk
  2. A similarity search query (e.g., "What was the net income in 2023?") returns the top-5 most relevant chunks with page numbers intact and readable
  3. HNSW index is active; similarity search on a 10,000-vector test set returns results in under 500ms
**Plans**: 5 plans
- [x] 04-01-PLAN.md (04-embeddings-vector-store) — HNSW + match_document_chunks RPC + [BLOCKING] db push + db:types (Wave 1)
- [x] 04-02-PLAN.md — gemini text-embedding-004 helper + Vitest mocks (Wave 1, parallel 01)
- [x] 04-03-PLAN.md — embed-document-batch + /api/internal/embed-batch (Wave 2)
- [x] 04-04-PLAN.md — scheduleEmbedBatchesForDoc, parse→embedding hook, Vercel Cron embed (Wave 3)
- [x] 04-05-PLAN.md — match-document-chunks RAG wrapper, perf smoke script, 04-UAT sign-off (Wave 4)
**UI hint**: no
**AI hint**: no
**Research flag**: no — text-embedding-004 API + Supabase pgvector HNSW index creation is well-documented

---

### Phase 5: Indonesian Eval Harness
**Goal**: A developer-runnable eval harness with 9 IDX documents measures numeric accuracy and citation page accuracy, providing a hard gate before the AI explanation feature is marked done
**Depends on**: Phase 4
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04
**Success Criteria** (what must be TRUE):
  1. Running `pnpm eval` executes against all 9 eval documents (covering large-cap bilingual, mid-cap ID-only digital, small-cap scanned, quarterly, and long-form annual) and produces a structured per-document pass/fail report
  2. The report shows numeric accuracy (key figures from ground truth match AI-extracted values) and citation accuracy (cited page number contains the claimed fact) as separate percentages
  3. Deliberately misconfiguring the Gemini prompt causes the harness to score below threshold and report specific failures — proving the gate is live, not decorative
  4. The harness can be re-run on demand with a single command and produces consistent, comparable results across runs
**Plans**: 2 plans
- [x] 05-01-PLAN.md — Wave 1 corpus curation: BBCA + TLKM + BISI (3-document minimum gate per D-08, unblocks Phase 6 start) (Wave 1, has visual checkpoint)
- [x] 05-02-PLAN.md — Wave 2 corpus curation: SMGR + ASII + BJBR + INDF + GOTO + PTBA (full 9-doc gate + broken-prompt regression proof per D-09) (Wave 2, depends on 05-01, has visual checkpoint)

> **Note:** The harness code (manifest + Gemini eval extract + `pnpm eval` + Vitest scorer) was completed in prior work and is already merged. The two plans above cover the remaining corpus curation only (PDFs + ground-truth fixtures). See `eval/README.md` and `.planning/phases/05-indonesian-eval-harness/05-VALIDATION.md` for historical harness implementation context.
**UI hint**: no
**AI hint**: yes
**Research flag**: yes — RAGAS evaluation framework integration; custom numeric verifier design for IDR-scale figures; bilingual ground-truth comparison methodology for BBCA/TLKM documents

---

### Phase 6: AI Explanation Generation
**Goal**: System generates a cached, progressively-streaming, plain-English 5-section explanation with inline page citations, full Bahasa Indonesia handling, and the eval harness gate as sign-off condition
**Depends on**: Phase 5
**Requirements**: EXPLAIN-01, EXPLAIN-02, EXPLAIN-03, EXPLAIN-04, EXPLAIN-05, TRANSLATE-01, TRANSLATE-02, DISCLAIM-02
**Success Criteria** (what must be TRUE):
  1. Uploading a Bahasa Indonesia IDX annual report produces a plain-English explanation organized into Revenue, Profitability, Balance Sheet, Cash Flow, and Key Risks — with no untranslated Indonesian financial jargon in the output
  2. Every factual claim in the explanation includes an inline `[p.N]` citation referencing a real page in the source document
  3. The explanation streams progressively — the first section appears in the UI within 5 seconds of triggering generation
  4. Refreshing the page after explanation loads does not call the Gemini API again — the cached explanation renders instantly from `document_analysis`
  5. **[EVAL GATE — blocking]** The eval harness scores ≥90% numeric accuracy AND ≥90% citation accuracy on the 9-document eval set before this phase is signed off
**Plans**: 5 plans
- [x] 06-01-PLAN.md (06-01-schema-and-prompts) — Zod explanation schema + PSAK glossary + DISCLAIM-02 prompt builder + Wave 0 tests (Wave 1)
- [x] 06-02-PLAN.md (06-02-explain-jsonb-migration) — [BLOCKING] ALTER COLUMN explanation TYPE jsonb + db push + types regen (Wave 1, human-verify push)
- [x] 06-03-PLAN.md (06-03-generate-and-orchestrate) — generate-explanation.ts (Files API + stream) + analyze-document-batch.ts (cache gate + status machine) (Wave 2)
- [x] 06-04-PLAN.md (06-04-cron-trigger-and-route) — /api/internal/analyze-batch route + after() chain from embed (no new cron slot) + STUB_PIPELINE_TICK extension (Wave 3)
- [x] 06-05-PLAN.md (06-05-eval-gate-and-smoke) — pnpm eval ≥90/90 gate + end-to-end smoke (Wave 4, blocking human-verify)
**UI hint**: no
**AI hint**: yes
**Research flag**: yes — Gemini Files API citation-forcing prompt engineering; glossary injection patterns; streaming with Vercel AI SDK + Next.js App Router; `document_analysis` caching schema

---

### Phase 7: Citation UI & PDF Viewer
**Goal**: Users experience the core trust mechanic — reading the explanation alongside the source PDF, clicking citations to jump to pages, and hovering financial terms for definitions
**Depends on**: Phase 6
**Requirements**: VIEWER-01, VIEWER-02, VIEWER-03, VIEWER-04, JARGON-01, JARGON-02
**Success Criteria** (what must be TRUE):
  1. On desktop, the explanation and the source PDF are visible simultaneously in a side-by-side split-pane layout
  2. Clicking any `[p.N]` citation in the explanation scrolls the PDF viewer to that page number immediately
  3. Hovering over a `[p.N]` citation shows a popover with the verbatim quoted source text from that page
  4. On a 375px mobile screen, a tab switcher lets the user flip between the explanation view and the PDF viewer
  5. Hovering or tapping a recognized financial term (e.g., "Debt-to-Equity", "Free Cash Flow") surfaces a one-sentence plain-English definition
**Plans**: 3 plans
- [x] 07-01-PLAN.md (07-01-api-and-jargon-dict) — GET /api/page-text route + jargon-dictionary.json (≥60 terms, JARGON-02 coverage) (Wave 1)
- [x] 07-02-PLAN.md (07-02-citation-and-jargon-ui) — shadcn popover+tooltip, parseCitations parser, CitationInline + CitationPopover + JargonTooltip + PdfLoadingSkeleton + ExplanationPanel (Wave 2)
- [x] 07-03-PLAN.md (07-03-reader-layout-and-rsc) — react-pdf + react-resizable-panels + shadcn tabs, PdfViewerPanel, DocumentReaderLayout (desktop split), MobileTabView (≤768px), RSC fetch + DocumentProgressView ready-branch (Wave 3, blocking human-verify)
**UI hint**: yes
**AI hint**: no
**Research flag**: no — React PDF viewer component selection; popover positioning; jargon dictionary is static JSON

---

### Phase 8: AI Score & Drill-Down
**Goal**: System generates a schema-validated 1-10 AI assessment score with a 4-dimension breakdown and cited documentary evidence the user can inspect
**Depends on**: Phase 6
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06
**Success Criteria** (what must be TRUE):
  1. After the explanation loads, a 1-10 AI Assessment score appears with the visible label "AI Assessment · not financial advice" adjacent to the number
  2. The score UI shows four sub-dimension scores (Profitability, Balance Sheet, Growth Trend, Valuation Context), each with a one-sentence reasoning summary
  3. Clicking any dimension expands to show 2–3 quoted snippets from the document with page citations
  4. The score is generated via `generateObject` with a strict JSON schema — a schema validation failure triggers an automatic retry rather than displaying a broken UI state
**Plans**: 4 plans
- [x] 08-01-PLAN.md (08-01-setup-and-test-stubs) — Install langfuse, add accordion shadcn, export helpers from generate-explanation, create 4 test stubs (Wave 0)
- [x] 08-02-PLAN.md (08-02-score-schema-prompts) — score-schema.ts (Zod + raw JSON Schema), score-prompts.ts (SCORE_MODEL_ID + buildScorePrompt + scanForInvestmentAdvice) with tests (Wave 1)
- [x] 08-03-PLAN.md (08-03-generate-and-orchestrate) — generate-score.ts (Gemini Files API + compliance guard) + analyze-document-batch.ts Step 8b wiring (Wave 2)
- [ ] 08-04-PLAN.md (08-04-ui-and-prop-threading) — ScoreCard + ScoreLoadingSkeleton + ExplanationPanel/DocumentReaderLayout/MobileTabView/DocumentProgressView prop threading + page.tsx RSC fetch (Wave 3, blocking human-verify)
**UI hint**: yes
**AI hint**: yes
**Research flag**: no — Vercel AI SDK `generateObject` superseded by @google/genai per D-04; scoring prompt patterns are standard

---

### Phase 9: Stock Data & Trend Chart
**Goal**: System auto-detects the IDX ticker from the document, fetches delayed market data with graceful fallback, and renders a multi-year financial trend chart
**Depends on**: Phase 6
**Requirements**: TICKER-01, TICKER-02, STOCK-01, STOCK-02, STOCK-03, STOCK-04, STOCK-05, CHART-01, CHART-02
**Success Criteria** (what must be TRUE):
  1. Uploading a BBCA annual report auto-detects "BBCA" as the IDX ticker from document text without requiring manual entry
  2. A panel shows the delayed stock price, P/E ratio, P/B ratio, and dividend yield for the detected ticker
  3. When yahoo-finance2 fails or the ticker has no data, "Market data temporarily unavailable" is displayed — never a raw API error or unhandled exception
  4. All Indonesian Rupiah figures are formatted as "Rp X triliun" or "Rp X miliar" — never as a raw 12+ digit integer
  5. A multi-year Recharts line/bar chart renders revenue, net income, and margin trends sourced from the document's historical comparative figures
**Plans**: TBD
**UI hint**: yes
**AI hint**: no
**Research flag**: no — yahoo-finance2 `.JK` ticker + Recharts patterns are straightforward; ticker detection uses regex against extracted text

---

### Phase 10: Chat Interface
**Goal**: Users can ask follow-up questions about the document, receive grounded and cited streaming answers, and have their session persist across browser refreshes
**Depends on**: Phase 6
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):
  1. User can type any question about the uploaded document and receive an answer grounded in retrieved document chunks with page citations
  2. Chat answers stream progressively — partial text appears within 2 seconds of submitting a question
  3. After a page refresh, all previous messages in the chat session are restored (7-day TTL via anonymous UUID in localStorage)
  4. The session opens with 3–5 suggested questions the user can click to send immediately
  5. Submitting "Should I buy this stock?" or similar produces a friendly "I can't make buy/sell recommendations" deflection — never an investment recommendation
**Plans**: 5 plans
- [x] 10-01-PLAN.md (10-01-wave0-setup) — Pin ai@4.3.19 + @ai-sdk/google + @ai-sdk/groq, add document_analysis.starter_questions migration, regen DB types, write 5 RED Vitest stubs (Wave 0, blocking remote db push)
- [x] 10-02-PLAN.md (10-02-pure-libs) — Implement guardrail.ts (CHAT-06), prompts.ts (CHAT-02 + DISCLAIM-01), starter-questions-schema.ts (CHAT-05) — pure functions, turn Wave 0 RED tests GREEN (Wave 1)
- [ ] 10-03-PLAN.md (10-03-api-routes) — /api/chat streamText route + /api/starter-questions cache-then-generate route (Wave 2)
- [ ] 10-04-PLAN.md (10-04-ui-components) — 6 chat React components (ChatPanel, ChatInterface, ChatMessage, StarterQuestions, ChatLoadingSkeleton, GuardrailDeflection) + 2 render tests (Wave 3)
- [ ] 10-05-PLAN.md (10-05-rsc-wiring) — Wire ChatPanel into doc/[documentId]/page.tsx RSC + DocumentReaderLayout (desktop) + MobileTabView ('Chat' tab); sessionId URL sync (Wave 4, blocking human-verify)
**UI hint**: yes
**AI hint**: yes
**Research flag**: no — Vercel AI SDK `useChat` + pgvector RAG + Supabase session storage is a well-documented pattern

---

### Phase 11: Observability & Reliability
**Goal**: All LLM calls are traced and prompt-versioned in Langfuse; free-tier limits are protected via concurrency caps, storage cleanup, and a keep-alive cron
**Depends on**: Phase 6, Phase 4 (for storage)
**Requirements**: OBS-01, OBS-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Every LLM call (explanation generation, score, chat reply) appears in Langfuse with input prompt, output, latency, token count, and cost estimate
  2. After changing any system prompt, the new version is tracked in Langfuse; a quality regression can be attributed to the specific prompt version that introduced it
  3. Triggering 3 simultaneous document uploads caps at 2 concurrent LLM processing jobs — the third queues and completes without error
  4. After a document's chunks are successfully stored in pgvector, the raw PDF is deleted from Supabase Storage
  5. A Vercel Cron job runs weekly and pings the Supabase database to prevent free-tier inactivity pause
**Plans**: TBD
**UI hint**: no
**AI hint**: no
**Research flag**: no — Langfuse SDK + Next.js integration is standard; concurrency queue with `p-limit` is straightforward; Vercel Cron setup is well-documented

---

### Phase 12: Polish & Public Launch
**Goal**: Mobile layout, first-time onboarding modal, prominent inline disclaimers, and per-IP rate limiting complete the product for public launch
**Depends on**: Phase 11
**Requirements**: DISCLAIM-01, DISCLAIM-03, UX-03, INFRA-02
**Success Criteria** (what must be TRUE):
  1. "AI analysis · not financial advice" labels are visibly displayed adjacent to the score value, the explanation section header, and the chat input area — not only in the page footer
  2. First-time visitors (detected via localStorage flag) see a brief modal explaining what Clarifin is (document explainer, not advisor), what types of documents to upload, and the AI-opinion disclaimer before accessing the main interface
  3. The complete application layout — upload, explanation, score, chart, and chat — renders on a 375px mobile viewport without horizontal overflow or unusable UI elements
  4. Per-IP daily upload rate limiting is active; exceeding the limit shows a friendly "Come back tomorrow" message rather than a server error
**Plans**: TBD
**UI hint**: yes
**AI hint**: no
**Research flag**: no — responsive CSS, modal patterns, and rate limiting middleware are standard

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (parallel with 7–8) → 10 → 11 → 12

**Parallelization opportunities:**
- Phase 7, 8, and 9 all depend on Phase 6 and are independent of each other — can be planned/executed in parallel
- Phase 11 can begin once Phase 6 is complete (LLM calls exist to trace)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Setup & Foundation | 6/6 | UAT complete (2026-05-06) | 2026-05-06 |
| 2. PDF Upload & Storage | 6/6 | Implemented (UAT pending) | 2026-05-06 |
| 3. PDF Parsing & Chunking | 6/6 | Complete    | 2026-05-08 |
| 4. Embeddings & Vector Store | 5/5 | Implemented (remote `db push`: link required) — see `04-UAT.md` | 2026-05-08 |
| 5. Indonesian Eval Harness | 0/2 curation plans (harness code already merged) | Planned · curate 9 IDX PDFs + ready fixtures across Waves 1–2 | - |
| 6. AI Explanation Generation | 0/5 | Planned · schema+prompts (W1), jsonb migration (W1), generator+orchestrator (W2), cron route (W3), eval gate (W4) | - |
| 7. Citation UI & PDF Viewer | 0/3 | Planned · API+jargon dict (W1), citation+jargon UI (W2), reader layout+RSC (W3, human-verify) | - |
| 8. AI Score & Drill-Down | 0/4 | Planned · setup+stubs (W0), schema+prompts (W1), generator+orchestrator (W2), UI+threading (W3, human-verify) | - |
| 9. Stock Data & Trend Chart | 0/TBD | Not started | - |
| 10. Chat Interface | 2/5 | In Progress|  |
| 11. Observability & Reliability | 0/TBD | Not started | - |
| 12. Polish & Public Launch | 0/TBD | Not started | - |

---

*Roadmap created: 2026-05-02*
*Requirements mapped: 60/60*
*Next: Phase 6 — AI Explanation Generation (Gemini Files API, 5-section plain-English output, inline citations, streaming + caching).*
