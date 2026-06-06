<!-- GSD:project-start source:PROJECT.md -->
## Project

**Clarifin**

A web app where English-fluent Indonesian retail investors upload an IDX-listed company's financial document (annual report, quarterly filing, balance sheet, cash flow, income statement) and get a plain-English explanation, an AI-generated holistic score (1-10) with reasoning, light valuation context (current ratios vs sector + multi-year trend), and a chat interface to ask follow-up questions about the document. Built for the urban Indonesian professional who invests in IDX stocks but cannot read financial statements.

**Core Value:** **Make IDX financial documents understandable in plain English to investors who don't speak finance.** Every other feature (scoring, valuation context, chat) supports this one job. If the explanation layer isn't trustworthy and clear, nothing else matters.

### Constraints

- **Budget**: Free-tier only — Vercel/Netlify free hosting, free LLM tier (Gemini 2.0 Flash, GPT-4o-mini, or equivalent), free vector DB (local or free-tier hosted), free stock data (Yahoo Finance via `.JK` ticker suffix). Total monthly burn target: ~$0 at low traffic.
- **Tech stack**: TBD via research phase. Must be solo-buildable with AI assistance. Modern, well-trodden frameworks preferred. No exotic infrastructure.
- **AI quality**: LLM must handle Bahasa Indonesia financial vocabulary accurately when input documents are in ID. This is the single biggest technical risk and must be validated with a small eval set early.
- **Citations**: Every AI-generated factual claim must trace back to a specific page in the source PDF. Non-negotiable for trust.
- **Compliance / disclaimers**: Product must NOT make buy/sell recommendations. All AI output is "analysis and explanation," clearly labeled. Disclaimers must be visible, not buried.
- **Audience English level**: Output must be readable by a smart, non-finance professional. No jargon without inline definition. No assumed prior finance knowledge.
- **Scope discipline**: Upload-only v1. Resist scope creep toward auto-fetch, multi-stock comparison, portfolio features, or advice — those are v2+ topics.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack at a Glance
| Layer | Choice | Version | Free Tier |
|-------|--------|---------|-----------|
| Web framework | Next.js (App Router) | 15.x | — |
| LLM (primary) | Gemini 2.5 Flash | Latest | 250 RPD · 10 RPM |
| LLM (fallback) | Groq + Llama 3.3 70B | — | 1K RPD · 100K TPD |
| PDF upload | Supabase Storage | — | 1 GB |
| PDF parsing | unpdf | 1.6+ | Free (local) |
| PDF-native reasoning | Gemini Files API | — | 20 GB/project, 48h TTL |
| Embeddings | Google `text-embedding-004` | — | Free under Gemini quota |
| Vector store | Supabase pgvector | 0.8.x | ≤100K vectors in 500 MB |
| Chat history / metadata | Supabase Postgres | — | 500 MB DB |
| Stock data | yahoo-finance2 | 3.14.x | Free (unofficial) |
| Charts | Recharts | v3 | Free (MIT) |
| AI streaming SDK | Vercel AI SDK | 4.x | Free (MIT) |
| Hosting | Vercel Hobby | — | 100 GB · 1M invocations |
| Auth (v1) | None | — | — |
| Observability | Langfuse Cloud | — | 50K events/month |
## 1. Web Framework — Next.js 15 (App Router)
### Why
- **Vercel-native**: zero-config deploys, edge/streaming API routes built in, Vercel AI SDK examples are all Next.js.
- **Vercel AI SDK is written for Next.js**: `useChat`, `streamText`, and server action streaming patterns are all Next.js-first.
- **Largest AI ecosystem**: Cursor, Claude Code, and every AI coding tool has seen far more Next.js than SvelteKit; expect fewer hallucinations and better code generation from AI assistance.
- **2026 status**: Next.js 16 is in RC with stable Turbopack; v15 is the production-stable LTS. App Router is fully mature.
- **TypeScript-first**: `create-next-app --typescript` is the default; no setup needed.
### Why NOT the alternatives
| Alternative | Verdict |
|-------------|---------|
| SvelteKit | Better DX and smaller bundles, but fewer AI SDK examples, smaller ecosystem; switch if Next.js complexity becomes a burden in v2+ |
| Remix | Merged into React Router v7 (2024); momentum slowed post-Shopify acquisition |
| Astro | Wrong paradigm — Astro is content-site focused; streaming chat + server actions are awkward |
### Installation
## 2. LLM — Gemini 2.5 Flash (primary) + Groq/Llama 3.3 70B (fallback)
### Primary: Gemini 2.5 Flash
| Property | Value |
|----------|-------|
| Context window | 1,000,000 tokens |
| Free tier RPM | 10 |
| Free tier RPD | 250 |
| Free tier TPM | 250,000 |
| Input pricing (paid) | $0.30 / 1M tokens |
| Output pricing (paid) | $2.50 / 1M tokens |
| Native PDF input | ✅ via Files API |
| Reasoning mode | ✅ (thinking budget configurable) |
| Audio output | 24+ languages |
- 10 RPM, 250 RPD, 250K TPM
- At low traffic (hobby launch): ~250 document analyses per day — more than enough.
- Daily reset at midnight Pacific Time.
- NOT suitable for high-traffic production; add rate limiting early.
### Fallback: Groq + Llama 3.3 70B
| Property | Value |
|----------|-------|
| Free RPM | 30 |
| Free RPD | 1,000 |
| Free TPD | 100,000 |
| Context window | 128,000 tokens |
| Cost | Free (permanent, no credit card) |
- Short chat follow-up questions with retrieved context (RAG)
- Rate-limit fallback during burst traffic
### Candidates Compared (Indonesian Financial Vocabulary)
| Model | Indonesian Quality | Context | Free Tier | Verdict |
|-------|--------------------|---------|-----------|---------|
| Gemini 2.5 Flash | HIGH (multilingual corpus, Global-MMLU top-2) | 1M tokens | 250 RPD | ✅ Primary |
| Groq / Llama 3.3 70B | MEDIUM (multilingual Llama, weaker than Gemini on low-resource langs) | 128K | 1K RPD | ✅ Fallback |
| GPT-4o-mini | MEDIUM-HIGH (strong multilingual) | 128K | ❌ None | ❌ No free tier |
| DeepSeek V3 | MEDIUM (primarily Chinese/English) | 1M | 5M tokens (30d only) | ❌ Expiring credits, reliability concerns |
| Claude 3.5 Haiku | HIGH | 200K | ❌ None | ❌ No free tier |
| Gemini 2.0 Flash-Lite | MEDIUM | 1M | Larger free quota | ⚠️ Lower quality, consider if 2.5 Flash quota insufficient |
### 2.5 — CRITICAL: Indonesian Language Eval Harness
| Bahasa Indonesia | English | Test risk |
|-----------------|---------|-----------|
| Laba bersih | Net profit | Low |
| Aset lancar | Current assets | Low |
| Ekuitas | Equity | Low |
| Laba ditahan | Retained earnings | Medium |
| Pendapatan komprehensif lain | Other comprehensive income | High |
| Catatan atas laporan keuangan | Notes to financial statements | High |
| Beban pokok penjualan | Cost of goods sold | Medium |
| Arus kas dari aktivitas operasi | Operating cash flow | Medium |
### Installation
## 3. PDF Upload — Supabase Storage (client upload)
### Why NOT Vercel directly
### Why Supabase Storage
- Already in the stack (avoids adding a second vendor)
- **1 GB free** file storage
- Client-side upload via `@supabase/storage-js` goes browser → Supabase CDN directly, bypasses Vercel's limit
- Supports signed URLs, public/private buckets, resumable uploads
- Can enforce file type and size constraints server-side via RLS policies
### Upload Architecture
### Free Tier Limit
- **1 GB total storage** — sufficient for ~200–500 PDF uploads depending on size.
- Implement a cleanup policy: delete PDFs from Storage after embedding is complete and raw file is no longer needed. Store only the embeddings and metadata long-term.
### Installation
## 4. PDF Parsing — unpdf (page-level extraction)
### Why unpdf
- **Pure JavaScript** — zero native binary dependencies. Works in Node.js, Deno, Bun, Cloudflare Workers, Vercel.
- **Page-by-page extraction**: returns one text block per page, each carrying the `pageNumber` index. Use this to tag every chunk with its source page.
- **Vercel-safe**: unlike `pdf-parse` (which depends on `canvas` C++ bindings and causes build failures), unpdf installs and runs without compilation.
- v1.6.0 (April 2026) adds `extractTextItems` for structured, positional text extraction.
- 383K weekly downloads, actively maintained.
### Page-Level Chunk Implementation
### Known Limitation: Image-Only PDFs
- **Detection**: if extracted text is < 50 chars for a "text" page, flag as likely scanned.
- **Mitigation**: route to **Gemini Files API** (Section 5) instead — Gemini reads images and PDFs natively, including scanned pages.
- **v1 behavior**: show user a warning if scanned content is detected.
### Why NOT the alternatives
| Alternative | Verdict |
|-------------|---------|
| `pdf-parse` | ❌ canvas C++ deps — Vercel builds break |
| PyMuPDF4LLM | ❌ Python runtime on Vercel adds infra complexity; unnecessary for text PDFs |
| LlamaParse | ❌ Per-page cost (even on free tier, 10K credit limit); adds external API dependency |
| `pdfjs-dist` | ⚠️ `unpdf` wraps pdfjs — use unpdf's cleaner API instead |
### Installation
## 5. PDF-Native LLM Reasoning — Gemini Files API
### Why
- Gemini reads PDFs, images, tables, charts natively — no loss from imperfect text extraction.
- A single API call with the full document + detailed prompt generates the explanation, score, and page citations simultaneously.
- Eliminates the need for a complex chunking pipeline for the initial analysis pass.
### How it works
### Free Tier Limits
- **Per-file limit**: 2 GB (well above any IDX report)
- **Project storage**: 20 GB
- **TTL**: files auto-deleted after **48 hours** — this is fine; we only need the PDF during processing. Long-term storage is in Supabase.
### What uses Files API vs RAG
| Use case | Approach |
|----------|---------|
| Initial explanation (full doc) | Gemini Files API → single LLM pass |
| Holistic 1-10 score with reasoning | Gemini Files API → single LLM pass |
| Chat follow-up questions | RAG: retrieve top-K page chunks → Gemini |
| Financial number extraction | Gemini Files API (tables handled natively) |
### Installation
## 6. Embeddings — Google `text-embedding-004`
### Why
| Property | Value |
|----------|-------|
| Cost | Free under Gemini API free tier |
| Dimensions | 768 |
| Max input tokens | 2,048 |
| MTEB score | ~68.3 (leads commercial benchmarks) |
| Multilingual | ✅ Strong across Indo-European and SEA languages |
- **No extra API key** — same Gemini key as the LLM.
- **Free under Gemini quotas** — no additional cost at low volume.
- Strong MTEB benchmark score (68.3/100), comparable to paid alternatives.
- 2,048 token context is sufficient for a single PDF page (most pages are 200–800 tokens).
### Why NOT the alternatives
| Alternative | Verdict |
|-------------|---------|
| `text-embedding-3-small` (OpenAI) | ❌ No free tier — $0.02/MTok |
| Voyage AI | ⚠️ 200M free tokens then $0.02/MTok; good quality but adds another vendor |
| Cohere | ⚠️ Free tier exists but small; vendor creep |
| Local (nomic-embed) | ❌ Cannot run on Vercel; needs GPU server |
### When to switch
### Embedding pipeline
## 7. Vector Store — Supabase pgvector
### Why
- Already in the stack — same Postgres DB used for chat history and document metadata.
- pgvector is free, no separate vendor, no extra ops.
- At the scale of this project (≤300 vectors per document, ≤1,000 documents total on free tier), pgvector performance is indistinguishable from Pinecone or Qdrant.
- p50 latency with HNSW indexing: ~5ms — fine for chat-response use cases.
- Supabase free tier supports ~100K vectors within the 500 MB DB limit.
### Schema
### RAG retrieval query
### Why NOT dedicated vector DBs
| Option | Verdict |
|--------|---------|
| Pinecone | ❌ Unnecessary — 2GB free but extra vendor; pgvector is free in existing Supabase |
| Qdrant Cloud | ❌ 1GB free but extra ops, extra vendor; overkill for this scale |
| ChromaDB local | ❌ No persistence on Vercel serverless; local-only |
| Weaviate Cloud | ❌ Extra vendor; 14K object free limit is too small |
## 8. Chat History & Metadata — Supabase Postgres
### Schema additions
### Free tier capacity
| Resource | Limit | Clarifin usage |
|----------|-------|----------------|
| DB storage | 500 MB | ~10K analyses, ~100K chat messages |
| File storage | 1 GB | ~200–500 PDFs (delete after processing) |
| Monthly active users | 50,000 | N/A (no auth in v1) |
| Bandwidth | 5 GB egress | Watch this — PDF downloads count |
| Projects | 2 | Use 1 for prod, 1 for dev |
| Inactivity pause | After 1 week (changed Feb 2026) | Keep project active with a cron ping |
## 9. Stock Data — yahoo-finance2
### Why
- Pure JavaScript, no API key required, no cost.
- Actively maintained — v3.14.0 published March 26, 2026 (162K weekly downloads).
- Supports `.JK` ticker suffix for IDX-listed companies (e.g., `BBCA.JK`, `TLKM.JK`, `GOTO.JK`).
- Returns: current price, P/E ratio, P/B ratio, dividend yield, 52-week high/low, market cap.
- Works in Next.js API routes (server-side only — do NOT call from client to avoid CORS issues).
### Usage
### Available data for IDX stocks
| Data point | Available | Notes |
|------------|-----------|-------|
| Current price | ✅ | Delayed ~15 min |
| P/E ratio | ✅ | TTM |
| P/B ratio | ✅ | |
| Dividend yield | ✅ | |
| Historical prices | ✅ | Up to 10+ years |
| Revenue/earnings history | ✅ | Quarterly/annual |
| Sector P/E comparison | ⚠️ | Available via `quoteSummary`, but IDX sector data is sparse |
### Error handling (critical)
### Why NOT the alternatives
| Alternative | Verdict |
|-------------|---------|
| Alpha Vantage | ❌ 25 requests/day free limit — too restrictive |
| Stockbit API | ❌ No official public API; requires reverse engineering |
| RTI Business scraping | ❌ Fragile scraping; legal grey area |
| IDX official API | ❌ No free programmatic API |
## 10. Charts — Recharts v3
### Why
- TypeScript-first full rewrite in v3 (released December 2024).
- 2.4–3.6M weekly downloads — most popular React charting library.
- Composable React component API — easy to reason about, easy to get AI help with.
- SVG-based — accessible, CSS-styleable.
- ~50KB gzipped — acceptable bundle size.
- Well-documented patterns for time-series (revenue/net income/margins over years) — exactly what Clarifin needs.
### Charts needed in Clarifin
### Why NOT the alternatives
| Alternative | Verdict |
|-------------|---------|
| Tremor | ⚠️ Good for SaaS dashboards, built on Recharts anyway, adds 200KB — skip the abstraction |
| ECharts | ❌ Config-driven, not React-native; overkill for 3–4 chart types |
| Chart.js | ❌ Imperative, canvas-based; Recharts is more React-native |
| Nivo | ⚠️ Beautiful but heavy (multiple packages); better for complex exploratory visuals |
| Visx | ❌ Too low-level; D3-like; solo dev overhead not worth it |
### Installation
## 11. Hosting — Vercel Hobby
### Why
- Next.js is made by Vercel — zero-config deploys, automatic preview branches.
- Vercel AI SDK streaming works natively (no WebSocket infra needed).
- 100 GB/month fast CDN transfer — plenty for a side project.
- 1M serverless function invocations/month.
- Built-in cron jobs (Vercel Cron) — used for Supabase keep-alive.
### Free tier limits
| Resource | Limit | Clarifin usage |
|----------|-------|----------------|
| Bandwidth | 100 GB/month | ~3,000–10,000 page views |
| Function invocations | 1M/month | ~10 per document analysis |
| Function max duration | **60 seconds** (Hobby) | ⚠️ See below |
| Memory per function | 2 GB | Sufficient |
| Concurrent builds | 1 | Fine for solo dev |
| Cron jobs | 2 free | Use 1 for Supabase keep-alive |
### ⚠️ Critical: Function duration limit
### Commercial use restriction
### Installation
## 12. Auth — None for v1
- Generate a UUID session token on first visit, store in `localStorage`.
- Associate documents and chat sessions with session token in Supabase DB.
- No login, no email, no password.
- Users request "see my previous analyses"
- Need to enforce per-user rate limits (avoid abuse)
- Launch premium tier
## 13. LLM Observability — Langfuse
### Why
- **50,000 events/month** on the free Cloud tier — sufficient for hundreds of document analyses.
- Open-source (MIT) and self-hostable if free tier is exceeded.
- SDK-based instrumentation (add 2 lines to your LLM call) — does NOT require changing your base URL.
- Prompt management: version your prompts (explanation prompt, scoring prompt, RAG prompt) in Langfuse UI.
- Eval support: track Indonesian language eval runs against ground truth.
- Active maintenance; Helicone (the alternative) entered maintenance mode after acquisition by Mintlify in March 2026.
### Key use cases for Clarifin
### Installation
### Free tier limits
- 50,000 events/month on Langfuse Cloud
- At ~10 events per document analysis: supports ~5,000 analyses/month
## 14. AI Streaming SDK — Vercel AI SDK
### Why
- `useChat` hook handles streaming, message state, error states out of the box.
- `streamText` in API routes manages streaming to the browser.
- Provider-agnostic: switch between Gemini and Groq by changing one import.
- Official `@ai-sdk/google` provider for Gemini 2.5 Flash.
- Has built-in RAG patterns (Supabase pgvector templates available).
### DON'T use LangChain
- Introduces a 3rd-party abstraction layer between your code and the LLM API, making debugging harder.
- Version churn is brutal — breaking changes across minor versions.
- AI SDK is simpler, TypeScript-native, and better supported for Vercel/Next.js.
- LangChain is justified when you need complex agent graphs or multi-provider routing — not for Clarifin's use case.
### Installation
## Full Stack Installation
# Core framework
# LLM + AI SDK
# Supabase (DB, storage, vector)
# PDF parsing
# Stock data
# Charts
# Observability
# Dev utilities
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | SvelteKit | Fewer AI examples, smaller ecosystem for our use case |
| LLM | Gemini 2.5 Flash | GPT-4o-mini | No free tier |
| LLM fallback | Groq/Llama 3.3 | DeepSeek | Dynamic rate limits, 30-day trial only |
| PDF upload | Supabase Storage | Vercel Blob | Vercel Blob is paid beyond hobby limits; Supabase already in stack |
| PDF parsing | unpdf | PyMuPDF4LLM | Python on Vercel adds infra complexity |
| PDF parsing | unpdf | LlamaParse | Per-page cost, external API dependency |
| Vector store | Supabase pgvector | Pinecone | Separate vendor, not needed at this scale |
| Vector store | Supabase pgvector | Qdrant Cloud | Same reason |
| Embeddings | Google `text-embedding-004` | OpenAI `text-embedding-3-small` | No free tier ($0.02/MTok) |
| Stock data | yahoo-finance2 | Alpha Vantage | 25 req/day limit too restrictive |
| Charts | Recharts v3 | Tremor | Built on Recharts, adds 200KB, less customizable |
| Auth | None (v1) | Clerk | Unnecessary complexity for v1 |
| Observability | Langfuse | Helicone | In maintenance mode since March 2026 |
| AI SDK | Vercel AI SDK | LangChain | Abstraction overhead, version churn |
## Total Monthly Cost Estimate (Low Traffic)
| Service | Free Tier | Overage Risk |
|---------|-----------|--------------|
| Vercel Hobby | $0 (100 GB bandwidth) | Low — PDFs served from Supabase, not Vercel |
| Supabase | $0 (500 MB DB, 1 GB storage) | Medium — 5 GB bandwidth limit is the binding constraint |
| Gemini API | $0 (250 RPD free) | Low at launch; watch for rate-limit errors |
| Groq | $0 (permanent free) | None |
| Langfuse | $0 (50K events/month) | None at side-project scale |
| yahoo-finance2 | $0 (unofficial API) | N/A |
| **Total** | **$0/month** | — |
## Sources
- [Vercel Hobby Plan docs](https://vercel.com/docs/accounts/plans/hobby) — function limits, bandwidth (accessed 2026-05)
- [Gemini API free tier](https://aifreeapi.com/en/posts/gemini-api-free-quota-2026) — rate limits (accessed 2026-05)
- [unpdf GitHub](https://github.com/unjs/unpdf) — v1.6.0 changelog, page extraction API (accessed 2026-05)
- [Supabase pricing](https://supabase.com/docs/pricing) — free tier limits (accessed 2026-05)
- [Langfuse observability comparison](https://open-techstack.com/blog/langfuse-vs-phoenix-vs-helicone-llm-observability-2026/) — Helicone maintenance mode (accessed 2026-05)
- [CroFinBen benchmark](https://jcst.ict.ac.cn/article/doi/10.1007/s11390-025-5524-7) — multilingual financial LLM evaluation including Indonesian
- [Global-MMLU-Lite leaderboard](https://llmdb.com/benchmarks/global-mmlu-lite) — Gemini 2.5 Flash-Lite multilingual score
- [yahoo-finance2 npm](https://www.npmjs.com/package/yahoo-finance2) — v3.14.0 release date, weekly downloads
- [Groq rate limits](https://console.groq.com/docs/rate-limits) — Llama 3.3 70B free limits
- [Vector DB pricing comparison 2026](https://agentdeals.dev/vector-database-pricing) — pgvector vs Pinecone/Qdrant
- Unpdf page-boundary limitation — verified via `unpdf` vs `pdf-parse` 2026 comparison article
- Vercel 4.5MB body limit — [Vercel Blob server upload docs](https://vercel.com/docs/vercel-blob/server-upload) (critical architecture constraint)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
