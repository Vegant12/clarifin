# Requirements: Clarifin

**Defined:** 2026-05-02
**Core Value:** Make IDX financial documents understandable in plain English to investors who don't speak finance.

## v1 Requirements

Requirements for the initial public release. Each maps to roadmap phases. All requirements derive from PROJECT.md "Active" requirements and research/SUMMARY.md P1/P2 features.

### Ingestion (INGEST)

- [ ] **INGEST-01**: User can upload a financial PDF (up to 20 MB) via drag-and-drop or file picker
- [ ] **INGEST-02**: PDF uploads go directly from browser to object storage (bypassing serverless body-size limits)
- [ ] **INGEST-03**: System parses PDF page-by-page, preserving page boundaries for every extracted chunk
- [ ] **INGEST-04**: System detects whether a PDF is text-extractable or scanned (image-only) and routes accordingly
- [ ] **INGEST-05**: System chunks prose semantically (~500 tokens, with overlap) and treats financial tables as atomic chunks
- [ ] **INGEST-06**: System embeds chunks and stores them with `{doc_id, page_number, section, chunk_type}` metadata from the first migration
- [ ] **INGEST-07**: Ingestion runs asynchronously; the UI polls for status without blocking the upload page
- [ ] **INGEST-08**: User sees real-time pipeline progress (Parsing → Embedding → Analyzing) during ingestion

### Ticker Identification (TICKER)

- [ ] **TICKER-01**: System auto-detects company name and IDX ticker from document text when present
- [ ] **TICKER-02**: User can manually enter or override the ticker when auto-detection fails

### AI Explanation (EXPLAIN)

- [ ] **EXPLAIN-01**: System generates a plain-English explanation organized into 5 sections (Revenue, Profitability, Balance Sheet, Cash Flow, Key Risks)
- [ ] **EXPLAIN-02**: Every factual claim in the explanation includes an inline page citation in `[p.N]` format
- [ ] **EXPLAIN-03**: Explanation is written for a financially-illiterate audience (target Flesch-Kincaid reading level grade 9 or lower)
- [ ] **EXPLAIN-04**: Explanation is cached per-document and not regenerated on page refresh
- [ ] **EXPLAIN-05**: Explanation streams progressively to the UI as it is generated

### Bahasa Indonesia Translation (TRANSLATE)

- [ ] **TRANSLATE-01**: System accurately handles Bahasa Indonesia source documents and produces English output without separate pre-translation pass
- [ ] **TRANSLATE-02**: A curated Bahasa→English financial-vocabulary glossary (50–100 PSAK terms) is injected into every system prompt for ID source documents

### PDF Viewer & Citation UX (VIEWER)

- [ ] **VIEWER-01**: User sees the source PDF in a split-pane view alongside the explanation (desktop)
- [ ] **VIEWER-02**: Clicking a `[p.N]` citation jumps the PDF viewer to that page
- [ ] **VIEWER-03**: Hovering a `[p.N]` citation shows a popover containing the quoted source text
- [ ] **VIEWER-04**: Mobile (≤768px) fallback uses tab-switching between explanation and PDF viewer

### Jargon Tooltips (JARGON)

- [ ] **JARGON-01**: Financial terms in the explanation surface a one-sentence plain-English definition on hover/tap
- [ ] **JARGON-02**: Jargon dictionary covers core financial terms (Revenue, EBITDA, Gross Margin, Operating Margin, Net Margin, ROE, ROA, Current Ratio, Quick Ratio, Debt-to-Equity, P/E, P/B, Dividend Yield, Free Cash Flow, etc.)

### AI Score (SCORE)

- [ ] **SCORE-01**: System generates a holistic 1-10 AI assessment score for the company
- [ ] **SCORE-02**: Score breaks down into 4 dimensions: Profitability, Balance Sheet, Growth Trend, Valuation Context
- [ ] **SCORE-03**: Each dimension includes reasoning grounded in document content
- [ ] **SCORE-04**: User can drill into each dimension to see 2–3 quoted document snippets with page citations
- [ ] **SCORE-05**: Score output is schema-validated JSON (using structured-output generation, not free-form prose)
- [ ] **SCORE-06**: Score is prominently labeled "AI Assessment · not financial advice" adjacent to the number

### Stock Context (STOCK)

- [ ] **STOCK-01**: System fetches current (delayed) stock price for the detected IDX ticker
- [ ] **STOCK-02**: System fetches and displays current P/E, P/B, and dividend yield ratios
- [ ] **STOCK-03**: System gracefully shows "Market data temporarily unavailable" when fetch fails or ticker has no data
- [ ] **STOCK-04**: System formats Indonesian Rupiah amounts naturally (e.g., "Rp 85 triliun" not "85,000,000,000,000")
- [ ] **STOCK-05**: Stock data fetches are cached for 24 hours and use exponential backoff on rate-limit errors

### Trend Chart (CHART)

- [ ] **CHART-01**: System renders a multi-year chart of revenue, net income, and key margin trends
- [ ] **CHART-02**: Chart data is sourced from the uploaded document's historical figures (typically 3–5 years of comparatives in IDX filings)

### Chat (CHAT)

- [x] **CHAT-01**: User can ask follow-up questions about the uploaded document via a chat interface
- [x] **CHAT-02**: Chat answers are grounded in retrieved document chunks and include page citations
- [ ] **CHAT-03**: Chat answers stream progressively to the UI as they are generated
- [x] **CHAT-04**: Chat session persists across page refresh (anonymous, browser-keyed, 7-day TTL)
- [x] **CHAT-05**: Chat surfaces 3–5 seeded suggested questions at session start to reduce blank-prompt anxiety
- [x] **CHAT-06**: Buy/sell recommendation language is hard-blocked in chat responses via post-processing filter

### Disclaimers & Compliance (DISCLAIM)

- [ ] **DISCLAIM-01**: "AI analysis · not financial advice" labels are visible adjacent to score, explanation, and chat (not buried in footer)
- [ ] **DISCLAIM-02**: System prompts hard-code no-recommendation instructions for every LLM call
- [ ] **DISCLAIM-03**: First-time visitors see a brief disclaimer/onboarding modal explaining what Clarifin is and is not

### Evaluation Harness (EVAL)

- [ ] **EVAL-01**: A 9-document Indonesian eval set covers all major PDF type variations (large-cap bilingual, mid-cap ID-only digital, small-cap scanned, quarterly, long-form annual report, prospectus)
- [ ] **EVAL-02**: Eval harness measures numeric accuracy (≥90% target) and citation page accuracy (≥90% target)
- [ ] **EVAL-03**: Eval results are reviewable per run (which docs failed which checks); harness blocks Phase 2 sign-off until thresholds met
- [ ] **EVAL-04**: Eval harness can be re-run on demand from the dev environment (`pnpm eval` or equivalent)

### Observability (OBS)

- [ ] **OBS-01**: Every LLM call is traced (input, output, latency, tokens, cost) for production debugging
- [ ] **OBS-02**: Prompts are versioned so quality regressions can be attributed to specific changes

### UX & Reliability (UX)

- [ ] **UX-01**: All long-running operations show streaming output or progress feedback (no silent waits >3s)
- [ ] **UX-02**: All errors show user-friendly messaging with a way to retry; no raw exceptions reach the UI
- [ ] **UX-03**: Layout works on mobile viewports (375px+) without horizontal overflow
- [x] **UX-04**: First-time visitors land on a clear value-proposition page explaining what to upload and what they'll get

### Infrastructure & Safety (INFRA)

- [x] **INFRA-01**: PDF uploads are size-limited (50 MB max) and MIME-type validated server-side
- [ ] **INFRA-02**: Per-IP daily upload rate limit prevents free-tier abuse
- [ ] **INFRA-03**: LLM call concurrency is capped (≤2 concurrent) to stay within free-tier rate limits
- [ ] **INFRA-04**: Raw uploaded PDFs are deleted from object storage after processing completes (Supabase egress discipline)
- [ ] **INFRA-05**: Weekly keep-alive cron pings the database to prevent free-tier inactivity pause

## v2 Requirements

Acknowledged but explicitly deferred. Tracked here so they don't get lost.

### Auto-Fetch (FETCH)

- **FETCH-01**: System auto-fetches the latest filings for an IDX ticker without requiring user upload
- **FETCH-02**: System maintains an indexed library of LQ45 / IDX30 documents for instant search

### Account & Saved Analyses (ACCT)

- **ACCT-01**: User can sign up and persist a library of analyzed documents
- **ACCT-02**: User can share read-only analysis output via public link
- **ACCT-03**: User can compare two companies side-by-side

### Localization (LOCAL)

- **LOCAL-01**: Bahasa Indonesia UI (currently English-only)
- **LOCAL-02**: User-selectable output language (ID/EN toggle on explanation)

### Sector Context (SECTOR)

- **SECTOR-01**: Sector peer-comparison table showing the company's ratios alongside 3–5 peers
- **SECTOR-02**: Sector benchmark ranges (sector P/E median, sector ROE median, etc.)

### Mobile (MOBILE)

- **MOBILE-01**: Native iOS and Android apps (currently web-only)

## Out of Scope

Explicitly excluded from v1 AND v2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Buy/sell recommendations or "should I invest?" verdicts | Regulatory/ethical line. OJK's "Penasihat Investasi" definition (Kep-26/PM/1996) is broad — explicit recommendations could constitute unlicensed investment advice. The product analyzes; it does not advise. |
| Real-time IDX market data | Requires paid feeds. Delayed/free data is acceptable for the research-mode use case. |
| DCF and complex valuation models | Too complex for the beginner audience. Comparable-company ratios are sufficient context. |
| Technical analysis indicators (RSI, MACD, candlesticks, volume profiles) | Different mental model — serves traders, not the fundamentals-curious beginner persona. |
| Coverage of non-IDX exchanges (NYSE, SGX, ASX) | IDX-only focus is part of the wedge; horizontal expansion dilutes positioning. |
| Multi-user accounts, teams, social features | Not needed for v1; product is positioned as a personal research tool. |
| Personalized portfolio tracking, watchlists, price alerts, notifications | Out of scope — product is "doc → understanding," not portfolio management. |
| Premium / paid tiers | Side-project; no commercial pressure; would distort feature priorities. |
| Embedded broker integration (place trades from Clarifin) | Far out of scope; explicit firewall between analysis and execution. |
| Crypto / forex / derivatives | IDX equities only. |
| Social / community / forum features | Distinct product category. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGEST-01 | Phase 2 | Pending |
| INGEST-02 | Phase 2 | Pending |
| INGEST-03 | Phase 3 | Pending |
| INGEST-04 | Phase 3 | Pending |
| INGEST-05 | Phase 3 | Pending |
| INGEST-06 | Phase 4 | Pending |
| INGEST-07 | Phase 2 | Pending |
| INGEST-08 | Phase 2 | Pending |
| TICKER-01 | Phase 9 | Pending |
| TICKER-02 | Phase 9 | Pending |
| EXPLAIN-01 | Phase 6 | Pending |
| EXPLAIN-02 | Phase 6 | Pending |
| EXPLAIN-03 | Phase 6 | Pending |
| EXPLAIN-04 | Phase 6 | Pending |
| EXPLAIN-05 | Phase 6 | Pending |
| TRANSLATE-01 | Phase 6 | Pending |
| TRANSLATE-02 | Phase 6 | Pending |
| VIEWER-01 | Phase 7 | Pending |
| VIEWER-02 | Phase 7 | Pending |
| VIEWER-03 | Phase 7 | Pending |
| VIEWER-04 | Phase 7 | Pending |
| JARGON-01 | Phase 7 | Pending |
| JARGON-02 | Phase 7 | Pending |
| SCORE-01 | Phase 8 | Pending |
| SCORE-02 | Phase 8 | Pending |
| SCORE-03 | Phase 8 | Pending |
| SCORE-04 | Phase 8 | Pending |
| SCORE-05 | Phase 8 | Pending |
| SCORE-06 | Phase 8 | Pending |
| STOCK-01 | Phase 9 | Pending |
| STOCK-02 | Phase 9 | Pending |
| STOCK-03 | Phase 9 | Pending |
| STOCK-04 | Phase 9 | Pending |
| STOCK-05 | Phase 9 | Pending |
| CHART-01 | Phase 9 | Pending |
| CHART-02 | Phase 9 | Pending |
| CHAT-01 | Phase 10 | Complete |
| CHAT-02 | Phase 10 | Complete |
| CHAT-03 | Phase 10 | Pending |
| CHAT-04 | Phase 10 | Complete |
| CHAT-05 | Phase 10 | Complete |
| CHAT-06 | Phase 10 | Complete |
| DISCLAIM-01 | Phase 12 | Pending |
| DISCLAIM-02 | Phase 6 | Pending |
| DISCLAIM-03 | Phase 12 | Pending |
| EVAL-01 | Phase 5 | Pending |
| EVAL-02 | Phase 5 | Pending |
| EVAL-03 | Phase 5 | Pending |
| EVAL-04 | Phase 5 | Pending |
| OBS-01 | Phase 11 | Pending |
| OBS-02 | Phase 11 | Pending |
| UX-01 | Phase 2 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 12 | Pending |
| UX-04 | Phase 1 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 12 | Pending |
| INFRA-03 | Phase 11 | Pending |
| INFRA-04 | Phase 11 | Pending |
| INFRA-05 | Phase 11 | Pending |

**Coverage:** 60/60 v1 requirements mapped — complete.

- v1 requirements: 60 total (note: count is 60, not 53 as initially estimated in the pre-roadmap stub)
- Mapped to phases: 60
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-02 after initial definition*
