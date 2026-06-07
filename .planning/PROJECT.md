# Clarifin

## What This Is

A web app where English-fluent Indonesian retail investors upload an IDX-listed company's financial document (annual report, quarterly filing, balance sheet, cash flow, income statement) and get a plain-English explanation, an AI-generated holistic score (1-10) with reasoning, light valuation context (current ratios vs sector + multi-year trend), and a chat interface to ask follow-up questions about the document. Built for the urban Indonesian professional who invests in IDX stocks but cannot read financial statements.

## Core Value

**Make IDX financial documents understandable in plain English to investors who don't speak finance.** Every other feature (scoring, valuation context, chat) supports this one job. If the explanation layer isn't trustworthy and clear, nothing else matters.

## Current State

**Shipped:** v1.0 MVP on 2026-06-06. See [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

The fundamentals wedge is live in code: upload PDF → parse → embed → Gemini explanation with page citations → AI score with 4-dimension drill-down → stock context + multi-year trend → grounded chat with buy/sell hard-block. 25/60 v1 requirements satisfied; 34/60 partial; 1/60 unsatisfied.

**v1.0 launch blockers (R1–R4) explicitly deferred to permanent backlog** at v2.0 milestone start. See ROADMAP backlog 999.6. Future maintenance milestones may pick them up.

**Phase 13 (T1) complete on 2026-06-07.** OHLCV cache + ticker_metadata seeded with IDX top-100 (117k rows), 10 indicators computed and verified, `/ta/{ticker}` page live behind `NEXT_PUBLIC_TA_ENABLED` flag, single dispatcher cron replacing v1.0 pair. Key T3 constraint discovered: `onnxruntime-node` exceeds Vercel Hobby 250 MB function limit — T3 must use pre-compute + cache, not runtime ONNX inference.

## Current Milestone: v2.0 TA Module

**Goal:** Add a standalone Technical Analysis surface at `/ta/{ticker}` that detects chart patterns, computes indicators, generates probabilistic outlooks (no buy/sell calls), and explains everything in plain English — expanding Clarifin beyond its v1.0 fundamentals wedge into a fundamentals + technicals product.

**Target features (4 internal phases T1–T4, mapped to roadmap Phases 13–16):**
- **Phase 13 (T1) — Data & Indicators:** OHLCV ingest via yahoo-finance2 (EOD only), 10 indicators (RSI, MACD, Bollinger, EMA/SMA, ATR, Stochastic, OBV), ticker autocomplete, basic candlestick chart at `/ta/{ticker}`
- **Phase 14 (T2) — Patterns & Explanation:** 12 candlestick patterns + chart patterns (double top/bottom, H&S, S/R, flags), pattern markers on chart, Gemini streaming explanation, three-tier disclaimer framework
- **Phase 15 (T3) — ML Probability Layer:** XGBoost classifier trained offline on 5yr IDX OHLCV, ONNX inference in Node.js (no Python runtime in production), calibrated probability distribution UI, pattern outcome logging
- **Phase 16 (T4) — Polish:** Follow-up RAG chat over TA context, nightly pre-warm cron for top 50 tickers, Langfuse observability, mobile layout, rate limiting

**Key constraints carried from v1.0:**
- $0/month budget — EOD data only (no real-time IDX feeds)
- Probabilistic framing only — no buy/sell/directional calls (reuses Phase 10 CHAT-06 guardrail pattern)
- Plain-English output — same audience as v1.0 explanation feature

**Pre-existing research questions (blocking T3 and T4):**
- See `.planning/research/questions.md` — Q1 (IDX training data sufficiency), Q2 (XGBoost calibration), Q3 (Gemini quota under combined v1.0 + TA load)

**Audience change accepted at this milestone:** v1.0 served "the fundamentals-curious beginner who can't read a balance sheet." v2.0 broadens to "investors who also want to understand what the chart is doing." The TA module is positioned as analysis (probabilities + history), not advice (directional calls).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ User can upload an IDX financial PDF (annual report, quarterly filing, balance sheet, income statement, cash flow statement) from a web interface — v1.0 (Phase 2: browser-direct upload to Supabase Storage, INGEST-01/02)
- ✓ System parses the PDF preserving page boundaries so every claim can be cited back to a specific page — v1.0 (Phase 3: unpdf per-page extraction + Phase 4: chunks embedded with page_number/source_page_start/end metadata)
- ✓ System detects the company/ticker from the uploaded document (or lets the user specify it) — v1.0 (Phase 9: pure-regex IDX ticker detector wired into parse-document-batch, TICKER-01)
- ✓ AI generates a plain-English explanation of the document's contents — written for a financially-illiterate but intelligent reader — v1.0 (Phase 6: Gemini Files API, 5-section output, EXPLAIN-01..05)
- ✓ Every factual claim in the explanation includes a page-level citation the user can click to verify — v1.0 (Phase 6 inline `[p.N]` + Phase 7 click-to-jump + hover popover, EXPLAIN-02/VIEWER-02/03)
- ✓ AI generates a holistic 1-10 score with reasoning (clearly labeled as AI opinion, not financial advice) — v1.0 (Phase 8: schema-validated `generateObject`, SCORE-01/06; integration-verified, HUMAN-UAT pending)
- ✓ Score breakdown shows what drove the verdict (profitability signals, balance-sheet health, growth trend, valuation context) — v1.0 (Phase 8: 4-dimension drill-down with 1–3 cited snippets, SCORE-02/04)
- ✓ System fetches current stock price and key ratios (P/E, P/B, dividend yield) from a free data source — v1.0 (Phase 9: server-only yahoo-finance2 fetcher with 24h Supabase cache + exponential backoff, STOCK-01/02/05)
- ✓ System renders a multi-year financial trend chart (revenue, net income, margins) — v1.0 (Phase 9: Recharts multi-year trend with IDR formatting, CHART-01/02)
- ✓ User can chat with the document — ask follow-up questions and get grounded, cited answers — v1.0 (Phase 10: streaming RAG chat with PSAK glossary, CHAT-01..05, integration-verified)
- ✓ Prominent "Not financial advice" disclaimers throughout the AI-generated experience — v1.0 (Phase 12 DISCLAIM-01 inline labels on 5 surfaces + Phase 12 DISCLAIM-03 first-time onboarding modal)
- ✓ Buy/sell hard-block on chat — v1.0 (Phase 10 CHAT-06: `isInvestmentAdviceQuery` pre-LLM guardrail in `/api/chat/route.ts:116`)
- ✓ All AI output is in English; underlying source documents may be in Bahasa Indonesia and the system handles ID→EN faithfully — v1.0 (Phase 6: Gemini Files API with PSAK glossary in system prompt, TRANSLATE-01/02; eval harness measured 97.8% numeric / 92.6% citation on 9 IDX docs)

### Active

<!-- Current scope for next milestone. -->

- [ ] R1: `vercel.json` cron auth method mismatch — append `?secret=` to cron paths or change handlers to also accept Bearer
- [ ] R2: Register `/api/internal/analyze-batch` in `vercel.json` crons
- [ ] R3: Register `/api/cron/keep-alive` in `vercel.json` crons
- [ ] R4: Close session-ownership TODO at `src/app/doc/[documentId]/page.tsx:84` — gate explanation + signed PDF URL behind session-owner check
- [ ] Backfill VERIFICATION.md for Phases 6, 7, 9, 10, 12 (paperwork debt)
- [ ] Resume Phase 8 HUMAN-UAT (4 open interactive scenarios since 2026-05-19)
- [ ] Adversarial CHAT-06 testing (prove buy/sell guardrail survives prompt-injection attempts)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Auto-fetch documents from idx.co.id by ticker** — v1 is upload-only; auto-fetch is a v2 expansion that requires scraping/integration infra
- **DCF or other complex valuation models** — too complex for the beginner audience; comparable-companies / current ratios are sufficient
- ~~**Technical analysis indicators (RSI, MACD, candlesticks, etc.)** — different mental model; serves traders, not the fundamentals-curious beginner persona~~ **REVERSED 2026-06-06 at v2.0 milestone start.** TA is now in scope as a standalone module at `/ta/{ticker}`. The fundamentals wedge remains as v1.0; v2.0 adds technicals as a sibling surface. See "Current Milestone: v2.0 TA Module" above.
- **Real-time IDX market data** — paid feeds; delayed/free data is acceptable for research-mode usage
- **Bahasa Indonesia UI** — v1 ships English-only; ID translation is a future expansion
- **Native mobile app** — web-only for v1; product is positioned as a "sit-down research session" experience, desktop-first
- **Multi-user accounts, teams, sharing, social features** — not needed for v1; this is a personal research tool
- **Personalized portfolio tracking, watchlists, notifications** — out of scope for v1; product is doc → understanding, not portfolio management
- **Buy/sell recommendations or "should I invest?" verdicts** — regulatory/ethical line; AI provides analysis, not advice
- **Coverage of non-IDX exchanges (NYSE, SGX, etc.)** — IDX-only focus is the wedge

## Context

**The user (sharp persona):** Imagine a 27-year-old PwC consultant in Jakarta. English-fluent. University-educated. Has Rp 50M sitting in a Stockbit account. Invests in IDX stocks because friends do, or because of news/influencer hype. Has tried opening an annual report PDF, got 200 pages of dense Indonesian financial jargon, and bounced. They are not stupid — they read, write, and reason in English daily. They just never learned finance.

**The wedge / why this exists:** Existing Indonesian retail investing apps (Stockbit, RTI Business, Ajaib, IPOT) all assume the user already understands "Current Ratio," "EBITDA," "Debt-to-Equity." None of them explain the documents in plain English. That's the gap — and it's specifically defensible because it requires LLM quality on Indonesian financial documents, careful prompt engineering, and a clear opinion about what beginners need.

**The market:** Indonesia has 13M+ retail investors (KSEI 2024 data, growing fast). The English-fluent-but-financially-illiterate sub-segment is large in major cities (Jakarta, Surabaya, Medan, Bandung) and growing in the diaspora. No commercial validation needed at v1 — this ships as a public side project to test resonance.

**Document landscape:** IDX requires listed companies to file quarterly and annual reports. They're posted on idx.co.id as PDFs, often bilingual for big caps (LQ45) and Bahasa-only for mid/small caps. Annual reports run 100-300 pages, mixing financial statements, management discussion, audit reports, and ESG disclosures. Pure financial statements (balance sheet, income, cash flow) are usually 5-30 pages.

**Tech / build environment:** Solo developer building heavily with AI assistance (Cursor/Claude Code). Wants to move fast. Comfortable shipping with modern web frameworks. No team, no commercial pressure. Free-tier-only data and AI services for v1.

**Distribution:** Public web URL. No authentication required for v1 unless needed for rate-limiting or saving chat history. Launch quietly, iterate based on real usage.

## Constraints

- **Budget**: Free-tier only — Vercel/Netlify free hosting, free LLM tier (Gemini 2.0 Flash, GPT-4o-mini, or equivalent), free vector DB (local or free-tier hosted), free stock data (Yahoo Finance via `.JK` ticker suffix). Total monthly burn target: ~$0 at low traffic.
- **Tech stack**: TBD via research phase. Must be solo-buildable with AI assistance. Modern, well-trodden frameworks preferred. No exotic infrastructure.
- **AI quality**: LLM must handle Bahasa Indonesia financial vocabulary accurately when input documents are in ID. This is the single biggest technical risk and must be validated with a small eval set early.
- **Citations**: Every AI-generated factual claim must trace back to a specific page in the source PDF. Non-negotiable for trust.
- **Compliance / disclaimers**: Product must NOT make buy/sell recommendations. All AI output is "analysis and explanation," clearly labeled. Disclaimers must be visible, not buried.
- **Audience English level**: Output must be readable by a smart, non-finance professional. No jargon without inline definition. No assumed prior finance knowledge.
- **Scope discipline**: Upload-only v1. Resist scope creep toward auto-fetch, multi-stock comparison, portfolio features, or advice — those are v2+ topics.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Upload-only ingestion in v1 (no IDX auto-fetch) | Keeps v1 scope tight; works for ANY company; defers scraping/legal complexity | ✓ Good (v1.0) — no scope creep observed during 35-day build |
| English-first UI and output | Targets the underserved English-fluent-but-financially-illiterate Indonesian professional segment; simpler eval surface than bilingual; ID UI is a future expansion | ✓ Good (v1.0) — eval harness scored 97.8% numeric / 92.6% citation on ID-language sources with EN output |
| Desktop-first web (not mobile) | Product is a "sit-down research session" — not a quote-checker; serious analysis benefits from screen real estate | ✓ Good (v1.0) — split-pane reader required desktop; 375px tab-fallback shipped for incidental mobile access |
| Free-tier-only AI/data stack | Side-project ambition, no commercial pressure, hobby budget; forces good prompting over expensive models | ⚠️ Revisit (v1.0) — INFRA-03 concurrency cap shipped to stay within Gemini quota; combined load with future TA module untested (see seeds/ta-module-standalone.md Q3) |
| AI-driven holistic 1-10 score (vs Piotroski/Altman frameworks) | More useful and intuitive for beginners; established frameworks can be added later if AI score is well-received | ✓ Good (v1.0) — schema-validated `generateObject` shipped; user resonance untested until public launch |
| Tiered output: facts cited from source, AI commentary clearly labeled as opinion | Highest-trust path given the "Rich insights" ambition; lets users distinguish ground truth from AI judgment | ✓ Good (v1.0) — DISCLAIM-01 inline labels live on score/explanation/chat surfaces (5 total) |
| Page-level citations are mandatory, not optional | Trust is the moat; users will not believe AI-generated financial commentary without verifiable source links | ✓ Good (v1.0) — `[p.N]` format enforced from chunk metadata through `parseCitations` → click-to-jump |
| Chat with document is in scope for v1 | Users will have follow-up questions after the initial explanation; one-shot output is incomplete | ✓ Good (v1.0) — Phase 10 RAG chat with PSAK glossary; 7-day session restore |
| No buy/sell recommendations | Regulatory caution + ethical responsibility; "explain and contextualize" is the line | ✓ Good (v1.0) — CHAT-06 pre-LLM guardrail in `/api/chat/route.ts:116` returns deflection at zero LLM cost; adversarial UAT pending |
| Force-close v1.0 with `gaps_found` audit | User accepted 33 partial / 1 unsatisfied REQ-IDs and 4 code-level launch blockers (R1–R4); shipping debt is tracked in ROADMAP backlog 999.1–999.6 | ⚠️ Revisit (v1.0) — first public deploy will reveal whether R1/R2 cron gaps cause silent pipeline stalls |
| Use `gemini-embedding-001` (not `text-embedding-004`) | `text-embedding-004` returns 404 on `v1beta/batchEmbedContents`; `gemini-embedding-001` is the stable production endpoint with identical 768-dim output | — Phase 4 (2026-05-12) |
| HNSW over IVFFlat for pgvector index | At ≤100K vectors HNSW gives consistent low latency (~107ms measured) without the IVFFlat list-tuning overhead; simpler to operate | — Phase 4 (2026-05-12) |
| `match_document_chunks` RPC restricted to service_role only | Public anon key must never be able to call the RPC directly; REVOKE from public + GRANT to service_role enforced at migration level | — Phase 4 (2026-05-12) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after Phase 13 (T1 Data & Indicators) complete*
