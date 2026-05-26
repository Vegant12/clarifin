# Clarifin

> Make IDX financial documents understandable in plain English to investors who don't speak finance.

Clarifin is a web app for English-fluent Indonesian retail investors. Upload any IDX-listed company's financial document — annual report, quarterly filing, balance sheet, cash flow statement — and get a structured plain-English breakdown, an AI-generated holistic score, live stock context, and a chat interface to ask follow-up questions about the document.

---

## Features

- **Plain-English explanation** — AI reads the full PDF and produces a structured, section-by-section breakdown written for a non-finance professional. No jargon without a definition.
- **Inline citations** — every factual claim links back to the source page. Click a citation pill (`[p.49]`) to jump the PDF viewer to that exact page.
- **AI holistic score (1–10)** — overall financial health score with reasoning, covering profitability, liquidity, leverage, and growth.
- **Live stock context** — current IDX price, P/E, P/B, dividend yield, and multi-year trend charts pulled in real time via Yahoo Finance.
- **Document chat** — ask follow-up questions about the document. Answers are grounded in the source PDF via RAG, not just model memory.
- **PDF viewer** — original document displayed side-by-side with the analysis. No switching tabs.
- **Indonesian jargon tooltips** — hover over Indonesian accounting terms (laba bersih, ekuitas, arus kas…) for instant plain-English definitions.
- **Markdown-rendered output** — bold, lists, headings, and inline formatting render correctly in both explanations and chat.
- **Persistent analysis** — analysis is stored against a stable URL. Revisit without re-uploading.
- **No login required** — session-token-based, zero friction for first-time users.
- **Compliance-safe** — all AI output is clearly labeled as analysis, not investment advice. Inline disclaimers on every section.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| LLM (analysis) | Gemini 2.5 Flash via Files API |
| LLM (chat) | Gemini 2.5 Flash + Groq/Llama 3.3 70B fallback |
| Embeddings | Google `text-embedding-004` |
| Vector store | Supabase pgvector |
| Database | Supabase Postgres |
| File storage | Supabase Storage |
| PDF parsing | unpdf (page-level extraction) |
| AI streaming | Vercel AI SDK v4 |
| Stock data | yahoo-finance2 (IDX `.JK` tickers) |
| Charts | Recharts v3 |
| Styling | Tailwind CSS + shadcn/ui |
| Observability | Langfuse |
| Hosting | Vercel Hobby |
| Testing | Vitest |
| Linting | Biome |

---

## Getting Started

### Prerequisites

- Node 20+
- pnpm 9+
- Docker Desktop (running)
- Supabase CLI 1.190+ (`brew install supabase/tap/supabase`)

### Setup

```bash
pnpm install
cp .env.example .env.local   # fill in API keys
pnpm db:start                # start local Supabase (Postgres + Storage + Studio)
pnpm db:reset                # apply migrations
pnpm db:types                # generate TypeScript types from local DB
pnpm dev                     # start Next.js at http://localhost:3000
```

### Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key (LLM + embeddings) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `LANGFUSE_PUBLIC_KEY` | Langfuse observability (optional) |
| `LANGFUSE_SECRET_KEY` | Langfuse observability (optional) |

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | Biome lint |
| `pnpm test` | Vitest test suite |
| `pnpm db:start` | Start local Supabase |
| `pnpm db:reset` | Recreate local DB from migrations |
| `pnpm db:types` | Regenerate DB TypeScript types |

---

## How It Works

1. **Upload** — user drops a PDF on the homepage. The file is uploaded directly to Supabase Storage via a signed URL (bypasses Vercel's 4.5 MB body limit).
2. **Parse** — unpdf extracts text page-by-page. Each page becomes a chunk tagged with its page number.
3. **Embed** — chunks are embedded with `text-embedding-004` and stored in Supabase pgvector.
4. **Analyze** — the full PDF is sent to Gemini via the Files API. A single LLM pass produces the plain-English explanation, section scores, and the holistic 1–10 score with page citations.
5. **Stock context** — ticker symbol is extracted from the document; yahoo-finance2 fetches live IDX data and historical financials.
6. **Chat** — follow-up questions use RAG: top-K relevant chunks are retrieved from pgvector and passed to Gemini with the question. Answers are streamed via Vercel AI SDK.


