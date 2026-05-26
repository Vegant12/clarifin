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

---

## Deploying to Vercel

### 1. Push to GitHub
Ensure your repo is on GitHub and connected to Vercel.

### 2. Set environment variables
In Vercel → **Project Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `INTERNAL_PARSE_SECRET` | `openssl rand -hex 32` |
| `CRON_SECRET` | **Same value** as `INTERNAL_PARSE_SECRET` |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |

> `CRON_SECRET` is Vercel's built-in mechanism — it automatically adds `Authorization: Bearer <CRON_SECRET>` to every cron request. Setting it equal to `INTERNAL_PARSE_SECRET` means the batch routes accept it with no extra code.

### 3. Provision the Supabase Storage bucket
The `pdfs` bucket must be created manually on the hosted project (not applied by migrations):

1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `pdfs` | **Private** | File size limit: `20 MB` | MIME type: `application/pdf`

### 4. Deploy
Vercel auto-deploys on every push to `main`. The `vercel.json` at the repo root registers two cron jobs (parse-batch + embed-batch) that run every minute to drive the ingestion pipeline.

### Notes
- Vercel Hobby functions are capped at **60 seconds**. Large PDFs that exceed the analyze window will be retried on the next cron tick.
- Cron logs appear in Vercel dashboard → **Functions → Logs**.
- Supabase free tier pauses after 1 week of inactivity — regular uploads and cron activity will keep it awake.

