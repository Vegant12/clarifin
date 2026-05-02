# Clarifin

## What This Is

A web app where English-fluent Indonesian retail investors upload an IDX-listed company's financial document (annual report, quarterly filing, balance sheet, cash flow, income statement) and get a plain-English explanation, an AI-generated holistic score (1-10) with reasoning, light valuation context (current ratios vs sector + multi-year trend), and a chat interface to ask follow-up questions about the document. Built for the urban Indonesian professional who invests in IDX stocks but cannot read financial statements.

## Core Value

**Make IDX financial documents understandable in plain English to investors who don't speak finance.** Every other feature (scoring, valuation context, chat) supports this one job. If the explanation layer isn't trustworthy and clear, nothing else matters.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Hypotheses until validated by usage. -->

- [ ] User can upload an IDX financial PDF (annual report, quarterly filing, balance sheet, income statement, cash flow statement) from a web interface
- [ ] System parses the PDF preserving page boundaries so every claim can be cited back to a specific page
- [ ] System detects the company/ticker from the uploaded document (or lets the user specify it)
- [ ] AI generates a plain-English explanation of the document's contents — written for a financially-illiterate but intelligent reader
- [ ] Every factual claim in the explanation includes a page-level citation the user can click to verify
- [ ] AI generates a holistic 1-10 score with reasoning (clearly labeled as AI opinion, not financial advice)
- [ ] Score breakdown shows what drove the verdict (profitability signals, balance-sheet health, growth trend, valuation context)
- [ ] System fetches current stock price and key ratios (P/E, P/B, dividend yield) from a free data source and shows them vs the sector
- [ ] System renders a multi-year financial trend chart (revenue, net income, margins) from the uploaded document and prior periods if available
- [ ] User can chat with the document — ask follow-up questions and get grounded, cited answers
- [ ] Prominent "Not financial advice" disclaimers throughout the AI-generated experience
- [ ] All AI output is in English; underlying source documents may be in Bahasa Indonesia and the system handles ID→EN faithfully

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Auto-fetch documents from idx.co.id by ticker** — v1 is upload-only; auto-fetch is a v2 expansion that requires scraping/integration infra
- **DCF or other complex valuation models** — too complex for the beginner audience; comparable-companies / current ratios are sufficient
- **Technical analysis indicators (RSI, MACD, candlesticks, etc.)** — different mental model; serves traders, not the fundamentals-curious beginner persona
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
| Upload-only ingestion in v1 (no IDX auto-fetch) | Keeps v1 scope tight; works for ANY company; defers scraping/legal complexity | — Pending |
| English-first UI and output | Targets the underserved English-fluent-but-financially-illiterate Indonesian professional segment; simpler eval surface than bilingual; ID UI is a future expansion | — Pending |
| Desktop-first web (not mobile) | Product is a "sit-down research session" — not a quote-checker; serious analysis benefits from screen real estate | — Pending |
| Free-tier-only AI/data stack | Side-project ambition, no commercial pressure, hobby budget; forces good prompting over expensive models | — Pending |
| AI-driven holistic 1-10 score (vs Piotroski/Altman frameworks) | More useful and intuitive for beginners; established frameworks can be added later if AI score is well-received | — Pending |
| Tiered output: facts cited from source, AI commentary clearly labeled as opinion | Highest-trust path given the "Rich insights" ambition; lets users distinguish ground truth from AI judgment | — Pending |
| Page-level citations are mandatory, not optional | Trust is the moat; users will not believe AI-generated financial commentary without verifiable source links | — Pending |
| Chat with document is in scope for v1 | Users will have follow-up questions after the initial explanation; one-shot output is incomplete | — Pending |
| No buy/sell recommendations | Regulatory caution + ethical responsibility; "explain and contextualize" is the line | — Pending |

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
*Last updated: 2026-05-02 after initialization*
