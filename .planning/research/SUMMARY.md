# Research Summary: Clarifin

**Project:** Clarifin — AI-powered IDX financial-document explainer  
**Domain:** RAG-based document intelligence · Indonesian retail investing · Multilingual LLM  
**Researched:** 2026-05-02  
**Confidence:** HIGH (stack, features, pitfalls) · MEDIUM (Indonesian LLM quality — must validate)

---

## Top Findings (Read This First)

The roadmapper should internalize these 7 findings before structuring any phases:

1. **🔴 #1 RISK — Indonesian financial vocabulary on free-tier LLMs is unproven.** This is the single largest technical risk and the highest-priority thing to validate before shipping. Gemini 2.5 Flash shows strong multilingual benchmarks, but its accuracy on PSAK-specific Indonesian accounting terms, miliar/triliun number scale, and parenthetical negative presentation in IDX filings has NOT been benchmarked on the specific document types Clarifin will process. **An eval harness with 20+ IDX document cases must be built and must pass before the AI Explanation phase is declared done.**

2. **PDF parsing is 4× harder and slower than expected.** IDX documents span: fully digital bilingual PDFs (LQ45), digital Bahasa-only PDFs (mid-cap), scanned image PDFs (small-cap), and mixed. Multi-column layouts, borderless tables, scanned pages with no text layer, and multi-page tables without repeated headers all break naive parsers. Budget significant time here.

3. **Citation architecture is unfixable if designed wrong.** Page metadata (`source_page_start`, `source_page_end`, `source_file`) must be in the chunk schema from the first line of code. Post-hoc citation assignment achieves only 58.9% F1. Retrofitting citation infrastructure after building the vector index requires a complete rebuild.

4. **Supabase wins the persistence/vector-DB decision.** STACK.md recommended Supabase; ARCHITECTURE.md recommended Neon + Upstash Vector. **Recommendation: Supabase.** Single-vendor footprint (DB + pgvector + Storage) reduces maintenance overhead for a solo developer, avoids three separate free-tier tracking requirements (Neon/Upstash Vector/Upstash Redis), and provides 1 GB file storage critical for bypassing Vercel's 4.5 MB body limit on PDF uploads. At Clarifin's scale (≤100K vectors), pgvector with HNSW indexing is indistinguishable in performance from a dedicated vector DB. *Alternative: Neon + Upstash Vector is viable but increases vendor count to 3+.*

5. **Gemini 2.5 Flash is the correct primary LLM — but needs a fallback.** The 1M token context window is the decisive feature: a 300-page IDX annual report is 150K–400K tokens. No other free-tier model can ingest the full document. Its Files API enables native PDF reasoning (tables, charts, layout) without manual extraction for the initial explanation pass. Groq/Llama 3.3 70B (128K context, 1K RPD) is the fallback for chat follow-ups when Gemini hits 250 RPD.

6. **OJK regulatory exposure is a launch-day concern, not a v2 consideration.** The OJK definition of "Investment Advisor" (Kep-26/PM/1996) is broad enough to capture implicit buy signals. A prominently displayed 8/10 score with a positive explanation can constitute an implicit recommendation. Inline disclaimers adjacent to scores and a hard-block filter on buy/sell language in chat are non-negotiable from day one.

7. **Vercel Hobby's 60-second function timeout makes synchronous ingestion fail.** A 200-page annual report takes 30–90 seconds to parse + chunk + embed. The ingestion pipeline must use an async/polling pattern: return `{doc_id, status: "processing"}` immediately, run processing in the background, and have the frontend poll `/api/status?doc_id=xyz` for completion.

---

## Executive Summary

Clarifin is a **single-ingestion, multi-output RAG application** targeting a well-understood product pattern (AI document Q&A) applied to an underserved niche (IDX financial documents for English-fluent Indonesian retail investors). The technical playbook is clear: Next.js + Vercel for hosting, Supabase for all persistence (relational DB + pgvector + file storage), Gemini 2.5 Flash for LLM (1M context, native PDF, free), and Vercel AI SDK for streaming. The architecture follows a two-pass generation model — one Gemini Files API call generates the explanation and score from the full PDF, then RAG handles follow-up chat using page-chunked embeddings stored in pgvector.

The highest-confidence technical risk is **not the architecture — it's the LLM's quality on Bahasa Indonesia financial documents**. Indonesian accounting uses PSAK (not IFRS), presents numbers in miliar/triliun scale, uses false cognates that differ from English financial terms, and small/mid-cap companies use documents with no English parallel corpus. Gemini 2.5 Flash has demonstrated strong general Indonesian language performance but has not been benchmarked specifically against IDX financial filings. This must be validated with a structured eval set (20+ cases, 3-4 documents across format types) before the explanation feature is considered production-ready.

The secondary risk cluster is **PDF parsing and citation integrity**. IDX documents are not clean, uniform, text-layer PDFs. They include scanned pages, multi-column layouts, invisible table borders, footnote bleed, and company-specific templates. Combined with the non-negotiable requirement that every factual claim cite a specific source page, this makes the ingestion pipeline the highest-effort phase. The citation schema must be designed into every data model from day one — retrofitting it after the vector index is built is a complete pipeline rebuild.

---

## Key Findings

### Recommended Stack (Decision: Supabase over Neon + Upstash)

See full rationale in [STACK.md](./STACK.md).

| Layer | Choice | Free Tier | Key Reason |
|-------|--------|-----------|------------|
| Framework | Next.js 15 (App Router) | — | Vercel-native; AI SDK examples are all Next.js |
| LLM (primary) | Gemini 2.5 Flash | 250 RPD · 10 RPM | 1M context; native PDF input; free; multilingual |
| LLM (fallback) | Groq + Llama 3.3 70B | 1K RPD · 30 RPM | For chat follow-ups when Gemini quota exhausted |
| PDF parsing | unpdf | Free (local) | Pure JS, Vercel-safe, page-by-page with page number |
| PDF native LLM | Gemini Files API | 20 GB · 48h TTL | Full-doc pass for explanation and scoring |
| Embeddings | Google `text-embedding-004` | Free under Gemini quota | No extra API key; 768-dim; multilingual |
| Vector store | **Supabase pgvector** | ≤100K vectors in 500 MB | Single vendor; HNSW indexing; sufficient at scale |
| Relational DB | **Supabase Postgres** | 500 MB | Unified with vector store |
| File storage | **Supabase Storage** | 1 GB | Bypasses Vercel 4.5 MB body limit |
| Stock data | yahoo-finance2 | Free (unofficial) | `.JK` ticker suffix for IDX; no API key |
| Charts | Recharts v3 | Free (MIT) | Most popular React chart lib; TypeScript-native |
| AI streaming | Vercel AI SDK v4 | Free (MIT) | `useChat` + `streamText` + Gemini provider |
| Hosting | Vercel Hobby | 100 GB · 1M invocations | Next.js native; streaming; free |
| Observability | Langfuse Cloud | 50K events/month | LLM traces + eval harness; not Helicone (maintenance mode) |
| Auth | None (v1) | — | Anonymous sessions via localStorage UUID |

**Total monthly cost: $0 at low traffic.**

**⚠️ Supabase keep-alive required:** Free projects pause after 1 week of inactivity (changed Feb 2026). Add a weekly Vercel Cron job that pings the DB.

**Architecture.md deviation note:** ARCHITECTURE.md diagrams show `pdfplumber` (Python) for table extraction. This is incompatible with Vercel's Node.js/Edge runtime. Use `unpdf` (pure JS, page-by-page) for all text extraction, with the Gemini Files API as the primary table-understanding layer.

---

### Features: Must-Have vs Should-Have vs Defer

See full analysis in [FEATURES.md](./FEATURES.md).

**P1 — Must have for launch (product doesn't work without these):**
- PDF upload (drag-and-drop, up to 20 MB, client-side direct to Supabase Storage)
- Document parsing with page-boundary preservation — prerequisite for ALL other features
- Auto-detect company/ticker (or manual entry fallback)
- Plain-English explanation (5 sections: Revenue, Profitability, Balance Sheet, Cash Flow, Key Risks)
- Page-level citations `[p. N]` on all factual claims — non-negotiable trust mechanism
- Click-to-jump PDF viewer (split-pane desktop; tab-switch mobile fallback)
- Hover citation preview (popover with quoted source text)
- Bahasa Indonesia → English translation for source documents — the #1 technical wedge
- Inline jargon tooltips (hover → 1-sentence plain-English definition)
- AI holistic score (1-10) with 4-dimension breakdown (Profitability, Balance Sheet, Growth, Valuation)
- Score dimension drill-down (click dimension → see 2-3 document quotes with citations)
- Chat / follow-up Q&A (grounded, cited answers via RAG)
- "AI analysis · not financial advice" inline labels everywhere
- Loading states, pipeline progress indicators, error states

**P2 — Should have (product feels incomplete without):**
- Delayed stock price + P/E, P/B, dividend yield via Yahoo Finance `.JK`
- Multi-year revenue/net income trend chart (Recharts)
- Ticker auto-detection from document text
- Seeded chat questions to reduce blank-prompt anxiety

**P3 — Nice to have (add when P1+P2 solid):**
- Saved session history (localStorage only)
- Share link for read-only analysis output
- Sector comparison table (5 peer companies)

**Defer to v2+:**
- Auto-fetch IDX filings by ticker (scraping infra, legal complexity)
- Bahasa Indonesia UI
- User accounts / saved analysis library
- Multi-document comparison
- Native mobile app

---

### Architecture Approach

See full diagrams and data flow in [ARCHITECTURE.md](./ARCHITECTURE.md).

Clarifin follows a **two-pass generation model** with a single ingestion pipeline:

1. **Ingestion (once per upload):** PDF → unpdf page-chunking → Google embeddings → Supabase pgvector. Each chunk carries `{doc_id, page_number, section, chunk_type, content, embedding}` from day one — page metadata is never inferred post-hoc.

2. **Pass 1A — Explanation (triggered post-ingest, cached):** Full PDF uploaded to Gemini Files API → single Gemini 2.5 Flash call → explanation with inline `[p.N]` citations → stored in `document_analysis` table. Never re-generated unless explicitly requested.

3. **Pass 1B — Scoring (parallel with 1A, cached):** Same chunk set → Gemini `generateObject` with strict JSON schema → `{overall: 1-10, profitability: {score, reasoning}, ...}` → stored in `document_analysis`.

4. **Pass 2 — Chat (on-demand, not cached):** User question → embed query → pgvector similarity search (top-5 chunks from doc namespace) → Gemini `streamText` with retrieved context → SSE stream via `useChat`.

**Component responsibilities:**

| Component | Responsibility |
|-----------|---------------|
| PDF Parser (unpdf) | Page-by-page text extraction; page number preserved per chunk |
| Chunker | Prose chunks (~500 tokens); tables as atomic chunks (never split) |
| Embedder | `text-embedding-004`; batch 768-dim vectors |
| Supabase pgvector | Per-`doc_id` namespace isolation; HNSW index for ANN |
| Explainer LLM | Gemini Files API → full-doc → explanation_md with `[p.N]` |
| Scorer LLM | Gemini `generateObject` → schema-validated score JSON |
| Chat LLM | Gemini `streamText` + retrieved context → SSE stream |
| Stock Fetcher | Server-side yahoo-finance2; 30-min cache; graceful fallback |
| Chart Renderer | Client-side Recharts; data from Explainer structured output |
| Eval Harness | Dev-time only; `scripts/eval/`; RAGAS metrics + custom ID accuracy |
| Langfuse | Traces every LLM call; prompt versioning; eval run tracking |

**Translation strategy:** LLM-native multilingual (feed Indonesian chunks directly; instruct Gemini to explain in English). Do NOT pre-translate before embedding — adds latency, breaks structure, creates a second failure point. Use multilingual embeddings (`text-embedding-004` handles ID well).

---

### Critical Pitfalls (Key Watch-Outs)

See full pitfall analysis with warning signs and recovery costs in [PITFALLS.md](./PITFALLS.md).

**🔴 CRITICAL — Must address before shipping:**

1. **LLM numerical hallucination on financial tables.** LLMs transpose periods/commas in IDR numbers, confuse miliar (10⁹) with million (10⁶), swap 2023/2024 figures, and fail on multivariate calculations. *Prevention:* Extract tables as structured JSON/CSV before LLM ingestion; instruct model to copy numbers verbatim; add post-generation numeric verification; normalize all figures to a single unit (e.g., "in billions of IDR") before LLM context injection.

2. **Indonesian financial vocabulary mistranslation.** "Beban" → "expense" (not "burden"); "Piutang" → "receivables" (not "debts"); "Miliar" → billion (not million); parenthetical negatives in cash flow statements. PSAK-specific items diverge from IFRS. *Prevention:* Build a 50–100 term Bahasa→English financial glossary and inject it into every system prompt for ID-language documents. Validate on BBCA/TLKM bilingual reports (ground truth available) before accepting results.

3. **PDF parsing failures on IDX documents.** Multi-column layouts, borderless tables, scanned pages (no text layer), footnote bleed into tables, multi-page tables without repeated headers, watermark corruption. *Prevention:* Detect document type first (text vs. scanned); route scanned pages to Gemini Files API (OCR-capable); validate extraction completeness by checking for key financial keywords before proceeding; test against 9-document diversity matrix from day one.

4. **Citation drift — page metadata lost at chunk boundaries.** Post-hoc citation attribution achieves only 58.9% F1. If page numbers aren't in the chunk schema from ingestion, they cannot be reliably added later. *Prevention:* `source_page_start`, `source_page_end`, `source_file` are non-negotiable schema fields from the first migration; instruct LLM to cite inline during generation (not post-hoc); include citation accuracy (not just factual accuracy) in eval.

**🟠 HIGH SEVERITY — Address in planning, not in v2:**

5. **AI score appearing arbitrary.** Users either over-trust (buy/sell risk) or distrust (no perceived connection to explanation). *Prevention:* Always display the 4-dimension breakdown alongside the number; use `generateObject` for schema-validated structured output; label as "AI Assessment" not "Score"; show cross-document score range context.

6. **OJK regulatory exposure.** A high score adjacent to a positive summary is an implicit buy signal under OJK Kep-26/PM/1996. *Prevention:* Hard-code no-recommendation instructions in every system prompt; add post-processing filter blocking buy/sell language in chat responses; inline disclaimers must be visible adjacent to score, not just in footer.

7. **Free-tier cost blowup from context mismanagement.** Passing full 200-page document to LLM (instead of using RAG) consumes 150K–400K tokens per call, exhausts 250 RPD quickly, and hits rate limits under concurrent load. *Prevention:* Never exceed 50K tokens per LLM call; use RAG for chat; implement request queuing (concurrency limit of 1-2); implement exponential backoff on 429 errors.

8. **yfinance IDX-specific failures.** `.JK` tickers break without warning; small-cap stocks have no data; IDR formatting issues; stale P/E data. *Prevention:* Wrap all calls in try/catch with graceful "market data temporarily unavailable" fallback; cache 24h; validate ticker existence before displaying.

9. **Latency / free-tier UX death spiral.** Without streaming, 15–30s blank loading screens cause ~40% abandonment. *Prevention:* Implement SSE streaming from day one (not v2); show pipeline progress copy ("Parsing... Analyzing..."); decouple ingestion from explanation start.

---

## Implications for Roadmap

The component dependency graph from ARCHITECTURE.md maps cleanly to 5 sequential phases. Each phase has a clear gate criterion before the next phase begins.

### Phase 1: Foundation — Project Setup + PDF Ingestion Pipeline

**Rationale:** Everything else depends on a working ingestion pipeline with correct citation metadata. This is the highest-risk phase (PDF parsing complexity, citation schema design) and the one where mistakes are most expensive to fix.

**Delivers:**
- Next.js 15 + Supabase configured (DB, pgvector, Storage)
- PDF upload flow (client → Supabase Storage → `/api/ingest`)
- `unpdf` page-by-page chunking with `{doc_id, page_number, section, chunk_type}` metadata schema locked in
- `text-embedding-004` embeddings stored in pgvector with HNSW index
- Basic retriever (similarity search with metadata passthrough)
- Document and chunk DB schema (all tables)
- Vercel async ingestion pattern (`{doc_id, status: "processing"}` + polling)

**Addresses:** PDF upload (P1), parsing with page boundaries (P1)  
**Avoids:** Citation drift (Pitfall 4), PDF parsing failures (Pitfall 3), synchronous ingestion timeout (Vercel 60s limit)  
**Gate criterion:** Upload a 200-page scanned IDX annual report; verify every chunk has correct page metadata; verify retrieval returns relevant chunks with page numbers

**Research flag:** **Needs `/gsd-research-phase`** — `unpdf` page extraction behavior on IDX multi-column and scanned PDFs needs verification; Supabase pgvector HNSW setup patterns need confirmation.

---

### Phase 2: AI Explanation + Citation UI

**Rationale:** The core product value. Cannot be built without Phase 1's ingestion pipeline and citation infrastructure.

**Delivers:**
- Gemini Files API integration for full-document explanation pass
- Plain-English explanation with inline `[p.N]` citations (5-section structure)
- Bahasa Indonesia → English handling (glossary injection, language detection)
- Langfuse integration (traces LLM calls from the start)
- `document_analysis` caching (explanation never re-generated on page refresh)
- Split-pane frontend: explanation left, PDF viewer right
- Click-to-jump citation navigation + hover preview popover
- Inline jargon tooltip system (static JSON dictionary)
- "AI analysis · not financial advice" inline labels
- Loading states, pipeline progress indicators

**Addresses:** Plain-English explanation (P1), page citations (P1), click-to-jump (P1), Bahasa translation (P1), jargon tooltips (P1), disclaimers (P1)  
**Avoids:** LLM numerical hallucination (Pitfall 1), Indonesian vocabulary mistranslation (Pitfall 2), latency UX spiral (Pitfall 11)  
**Gate criterion (blocking):** Run 20-case Indonesian eval set. Must achieve ≥90% numeric accuracy (key figures match source PDF) and ≥90% citation accuracy (cited page contains the claimed fact). **Do not advance to Phase 3 if eval fails.**

**Research flag:** **Needs `/gsd-research-phase`** — Indonesian eval harness design (RAGAS + custom numeric verifier + bilingual ground-truth comparison); Gemini Files API citation prompt engineering patterns.

---

### Phase 3: Scoring + Stock Context + Charts

**Rationale:** Value-add features that depend on Phase 2's retrieval infrastructure. Scoring reuses the same chunks as the Explainer. Stock data is an independent integration.

**Delivers:**
- AI holistic 1-10 score via Gemini `generateObject` (schema-validated JSON)
- 4-dimension score breakdown UI (Profitability, Balance Sheet, Growth, Valuation)
- Score dimension drill-down (click → cited evidence from document)
- Delayed stock price + P/E, P/B, dividend yield via yahoo-finance2 (`.JK`)
- IDR formatting utilities ("Rp 85 triliun" not raw 13-digit numbers)
- Multi-year revenue/net income/margin trend chart (Recharts)
- Ticker auto-detection from document text (or manual entry fallback)

**Addresses:** AI score (P1), score drill-down (P1), stock data (P2), trend chart (P2), ticker detection (P2)  
**Avoids:** Arbitrary score perception (Pitfall 5), OJK regulatory exposure (Pitfall 6), yfinance IDX failures (Pitfall 9), IDR scale confusion  
**Gate criterion:** Score produces all 4 sub-dimension scores with rationale; "AI opinion, not financial advice" visible adjacent to score; yfinance failure shows graceful "data unavailable" (test by disconnecting internet)

**Research flag:** Standard patterns for `generateObject` + structured scoring — **skip `/gsd-research-phase`**, use Vercel AI SDK docs directly.

---

### Phase 4: Chat Interface

**Rationale:** Chat depends on RAG retrieval infrastructure (Phase 1) + session persistence (introduced here). It's the highest-engagement feature but requires all prior phases to work correctly.

**Delivers:**
- Multi-turn chat with document via Gemini `streamText` + `useChat`
- RAG retrieval per question (pgvector similarity → top-5 chunks → cited answers)
- Chat session persistence in Supabase (`chat_sessions`, `chat_messages`)
- Anonymous session model (localStorage UUID, 7-day TTL)
- Seeded suggested questions at session start
- Hard-block filter for buy/sell language (post-processing)
- Chat history preserved per session

**Addresses:** Chat Q&A (P1), seeded questions (P2)  
**Avoids:** OJK buy/sell exposure in chat (Pitfall 6), beginner blank-prompt anxiety (Pitfall 8)  
**Gate criterion:** Send "Should I buy this stock?" to chat — verify friendly deflection without answering; verify citations in chat answers link to correct pages; verify session persists across page refresh

**Research flag:** **Standard patterns** — Vercel AI SDK `useChat` + SSE streaming + pgvector RAG is well-documented. **Skip `/gsd-research-phase`**.

---

### Phase 5: Observability, Eval Polish + Launch Prep

**Rationale:** Hardening and validation pass before public launch. Eval harness validates the end-to-end pipeline against the Indonesian document diversity matrix. Observability enables post-launch debugging.

**Delivers:**
- Langfuse full integration (traces, prompt versioning, eval run tracking)
- Indonesian eval harness: 9-document diversity matrix (2 large-cap bilingual, 3 mid-cap ID-only digital, 2 small-cap scanned, 1 quarterly, 1 150+ page annual)
- Eval dimensions: numeric accuracy, citation page accuracy, readability (Flesch-Kincaid ≤ 9)
- Prospectus document detection (absence of multi-year data → specific UI state)
- IPO prospectus handling
- Mobile responsive layout (375px breakpoint; no horizontal overflow)
- Supabase keep-alive cron (weekly ping via Vercel Cron)
- Request queuing (concurrency limit of 2 simultaneous LLM calls)
- Rate limiting (per-IP daily upload limit if abuse appears)
- Security: file size limit (50 MB), MIME type validation server-side, UUID storage paths

**Addresses:** Reliability, security, eval, mobile responsiveness  
**Avoids:** Free-tier cost blowup (Pitfall 7), eval set mistakes (Pitfall 10), Indonesian cultural mismatches (Pitfall 12)  
**Gate criterion:** Complete "Looks Done But Isn't" checklist from PITFALLS.md; eval set passes ≥90% numeric + citation accuracy; large document (200 pages) completes without 429 or timeout

---

### Phase Ordering Rationale

- **Foundation before everything:** Citation schema mistakes in Phase 1 require full pipeline rebuild. No other phase can compensate.
- **Explanation before scoring:** Scoring reuses the same infrastructure; building explanation first proves the retrieval → LLM → citation chain.
- **Eval gates Phase 3:** If the Indonesian eval harness fails in Phase 2, Phases 3-5 are building on a broken foundation. The eval gate is the most important checkpoint in the build.
- **Chat last of core features:** Chat depends on both RAG retrieval (Phase 1) and session persistence; moving it earlier creates partial dependency cycles.
- **Stock data in Phase 3:** Independent integration; can run in parallel with early Phase 3 tasks, but shouldn't block Phase 2.

### Research Flags Summary

| Phase | Research Needed? | Reason |
|-------|-----------------|--------|
| Phase 1: Ingestion Pipeline | **YES** | `unpdf` behavior on IDX multi-column/scanned PDFs; Supabase pgvector HNSW setup |
| Phase 2: AI Explanation | **YES** | Indonesian eval harness design; Gemini Files API citation prompt engineering |
| Phase 3: Scoring + Stock | No | Vercel AI SDK `generateObject` is well-documented; yahoo-finance2 is straightforward |
| Phase 4: Chat | No | `useChat` + SSE + pgvector RAG is a standard, well-documented pattern |
| Phase 5: Polish + Eval | No | Implementation and testing, not new technology |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major choices verified against official free-tier limits; Supabase vs Neon conflict resolved |
| Features | HIGH | Comprehensive landscape survey across 4 competitor categories; clear P1/P2/P3 priorities |
| Architecture | HIGH | Two-pass generation + RAG + citation chain is a proven pattern; Vercel timeout constraints confirmed |
| Pitfalls | HIGH | Critical pitfalls verified against multiple 2025-2026 research sources, OJK legal source |
| Indonesian LLM Quality | MEDIUM | Gemini multilingual benchmarks exist but no IDX-specific financial document eval published |
| yfinance IDX Reliability | MEDIUM | Known to have broken for `.JK` tickers in 2024-2025; current status uncertain |

**Overall confidence: HIGH** for architecture and feature decisions. **MEDIUM** for the most critical product risk (Indonesian LLM quality) — which is precisely why Phase 2 has a hard eval gate before Phase 3.

### Gaps to Address During Planning

1. **Indonesian LLM eval ground truth:** Need to collect 9+ IDX documents (covering all layout types) before Phase 2 begins. Bilingual BBCA/TLKM reports provide free ground truth for ID→EN accuracy testing. This document collection should happen during Phase 1 or earlier.

2. **yfinance `.JK` current reliability:** Confirm which IDX tickers currently return data before committing to yahoo-finance2 as the sole stock data source. If `BBCA.JK`, `TLKM.JK`, and `GOTO.JK` all return clean data, proceed. If not, evaluate IDX open API or Investing.com as primary source.

3. **Vercel Hobby max function duration:** STACK.md states 60 seconds; ARCHITECTURE.md diagram notes 10 seconds. The actual limit for Node.js runtime functions on Vercel Hobby is 60 seconds (`maxDuration: 60`). Edge runtime has no maximum (streaming-native). Verify during Phase 1 implementation.

4. **Supabase free-tier egress:** The binding bandwidth constraint is Supabase's 5 GB/month egress limit. PDF downloads from Storage count toward this. Implement delete-after-processing (delete raw PDF from Storage after embedding is complete) to stay within limits.

---

## Sources

Aggregated from STACK.md, FEATURES.md, ARCHITECTURE.md, and PITFALLS.md. See individual files for full source lists.

### HIGH Confidence
- Vercel Hobby Plan docs — function limits, 60s duration, bandwidth (2026-05)
- Supabase pricing docs — free tier limits, February 2026 inactivity pause change
- Gemini API free tier — rate limits, Files API TTL, context window
- Vercel AI SDK docs — `streamText`, `useChat`, `generateObject` patterns
- OJK Kep-26/PM/1996 — Investment Advisor licensing definition
- arxiv:2604.12047 — PDF parsing and chunking for financial RAG (2026)
- unpdf GitHub — v1.6.0 page extraction API, Vercel-safe pure JS
- Langfuse — free tier 50K events/month; Helicone maintenance mode confirmed
- RAGAS evaluation framework — faithfulness, answer relevancy, context recall

### MEDIUM Confidence
- CroFinBen benchmark — Gemini multilingual financial LLM performance
- Global-MMLU-Lite leaderboard — Gemini 2.5 Flash-Lite multilingual score
- yfinance GitHub issues #2411, #2422, #2442 — `.JK` ticker reliability
- FAITH benchmark — LLM numerical hallucination in financial tables
- INDOTABVQA 2026 — cross-lingual table understanding in Bahasa Indonesia

### Tertiary (Requires Validation)
- Gemini 2.5 Flash accuracy on PSAK-specific Indonesian accounting terms — **no published benchmark; must run own eval**
- yfinance current status for `.JK` tickers — **must validate before shipping stock data feature**

---

*Research completed: 2026-05-02*  
*Ready for roadmap: yes*
