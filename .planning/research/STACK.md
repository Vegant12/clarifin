# Technology Stack: Clarifin

**Project:** Clarifin — AI-powered IDX financial-document explainer  
**Researched:** 2026-05-02  
**Researcher:** gsd-project-researcher  

---

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

**Total monthly cost at low traffic: $0**

---

## 1. Web Framework — Next.js 15 (App Router)

**Confidence: HIGH**

Use **Next.js 15** with the App Router.

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

```bash
npx create-next-app@latest clarifin --typescript --tailwind --eslint --app --src-dir
```

---

## 2. LLM — Gemini 2.5 Flash (primary) + Groq/Llama 3.3 70B (fallback)

**Confidence: MEDIUM** (quality on Indonesian financial vocab needs eval — see Section 2.5)

### Primary: Gemini 2.5 Flash

**Use `gemini-2.5-flash` via `@ai-sdk/google`.**

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

**Why Gemini 2.5 Flash wins for this project:**

1. **1M token context**: a 300-page Indonesian annual report is typically 150K–400K tokens. Gemini can ingest the entire document in a single request. No other free model comes close.
2. **Native PDF input**: upload PDF to Gemini Files API, send to model with a prompt — no manual text extraction needed for the initial explanation pass. Tables, headers, and layout are understood natively.
3. **Indonesian multilingual**: trained on diverse multilingual web corpus. Scores 84.5/100 on Global-MMLU-Lite (2025), a benchmark covering 15 languages. Performs well on Indonesian comprehension tasks in CroFinBen benchmarks.
4. **Free and permanent**: no 30-day expiry, no credit card required via Google AI Studio.
5. **Hybrid reasoning**: `thinking_budget` parameter lets you control reasoning depth per request (use low budget for chat, higher for scoring).

**Free tier limits:**
- 10 RPM, 250 RPD, 250K TPM
- At low traffic (hobby launch): ~250 document analyses per day — more than enough.
- Daily reset at midnight Pacific Time.
- NOT suitable for high-traffic production; add rate limiting early.

### Fallback: Groq + Llama 3.3 70B

Use **`llama-3.3-70b-versatile` via Groq** when Gemini 2.5 Flash returns HTTP 429.

| Property | Value |
|----------|-------|
| Free RPM | 30 |
| Free RPD | 1,000 |
| Free TPD | 100,000 |
| Context window | 128,000 tokens |
| Cost | Free (permanent, no credit card) |

Groq's rate limits are more generous (1K RPD vs 250 RPD), but the smaller context window (128K) means you cannot feed an entire 300-page report. Use Groq for:
- Short chat follow-up questions with retrieved context (RAG)
- Rate-limit fallback during burst traffic

**Do NOT use Groq for the primary explanation pass** — 128K tokens cannot hold a full annual report.

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

The single biggest technical risk in this project is LLM quality on Bahasa Indonesia financial documents. This must be validated before shipping.

**Build a minimum eval set of 10 cases:**

```
eval/
  cases/
    01_laba_bersih.json    # "Net profit" extraction from ID text
    02_aset_lancar.json    # "Current assets" interpretation  
    03_arus_kas.json       # Cash flow narrative, ID→EN
    04_rasio_keuangan.json # Financial ratios in ID
    05_catatan_laporan.json # "Notes to financial statements" in ID
    ...
  expected/
    01_laba_bersih.expected.json
    ...
  run_eval.ts
```

**Key Indonesian financial terms to test:**

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

**Eval criteria:**
1. Correct translation of financial terms (binary)
2. Numeric accuracy (extracted numbers match source)
3. Citation accuracy (page numbers are correct)
4. No hallucination (no invented numbers)

**Use Langfuse** (Section 11) to track eval runs and compare models.

### Installation

```bash
npm install @ai-sdk/google ai
```

```typescript
// lib/ai.ts
import { google } from '@ai-sdk/google'

export const geminiFlash = google('gemini-2.5-flash')
export const geminiEmbedding = google.textEmbeddingModel('text-embedding-004')
```

---

## 3. PDF Upload — Supabase Storage (client upload)

**Confidence: HIGH**

**Use Supabase Storage with client-side upload** (browser → Supabase directly, no Vercel routing).

### Why NOT Vercel directly

Vercel Serverless Functions have a **hard 4.5 MB request body limit** that cannot be increased. A single IDX annual report can be 5–30 MB. Routing uploads through Vercel API routes will fail for any report over 4.5 MB.

### Why Supabase Storage

- Already in the stack (avoids adding a second vendor)
- **1 GB free** file storage
- Client-side upload via `@supabase/storage-js` goes browser → Supabase CDN directly, bypasses Vercel's limit
- Supports signed URLs, public/private buckets, resumable uploads
- Can enforce file type and size constraints server-side via RLS policies

### Upload Architecture

```
Browser → Supabase Storage (direct, no Vercel middleman)
        → returns public/signed URL
Browser → POST /api/documents { storageUrl } → Vercel API Route
Vercel  → download from Supabase URL (file is already stored)
        → run unpdf parsing
        → store page chunks + embeddings in Supabase pgvector
```

### Free Tier Limit

- **1 GB total storage** — sufficient for ~200–500 PDF uploads depending on size.
- Implement a cleanup policy: delete PDFs from Storage after embedding is complete and raw file is no longer needed. Store only the embeddings and metadata long-term.

### Installation

```bash
npm install @supabase/supabase-js
```

---

## 4. PDF Parsing — unpdf (page-level extraction)

**Confidence: HIGH**

Use **`unpdf`** for extracting text from PDFs on Vercel serverless functions.

### Why unpdf

- **Pure JavaScript** — zero native binary dependencies. Works in Node.js, Deno, Bun, Cloudflare Workers, Vercel.
- **Page-by-page extraction**: returns one text block per page, each carrying the `pageNumber` index. Use this to tag every chunk with its source page.
- **Vercel-safe**: unlike `pdf-parse` (which depends on `canvas` C++ bindings and causes build failures), unpdf installs and runs without compilation.
- v1.6.0 (April 2026) adds `extractTextItems` for structured, positional text extraction.
- 383K weekly downloads, actively maintained.

### Page-Level Chunk Implementation

```typescript
import { extractText, getDocumentProxy } from 'unpdf'

export async function parsePdfToPageChunks(buffer: ArrayBuffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const chunks: { page: number; text: string }[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => item.str).join(' ')
    chunks.push({ page: pageNum, text })
  }

  return chunks
}
```

Each chunk's `page` field is stored as metadata in pgvector → enables page citations on every RAG answer.

### Known Limitation: Image-Only PDFs

Some Indonesian annual reports scan pages as images (no selectable text). `unpdf` cannot extract text from scanned pages. For these documents:
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

```bash
npm install unpdf
```

---

## 5. PDF-Native LLM Reasoning — Gemini Files API

**Confidence: HIGH**

For the **initial explanation pass and scoring**, use the Gemini Files API to send the entire PDF directly to Gemini 2.5 Flash without pre-processing.

### Why

- Gemini reads PDFs, images, tables, charts natively — no loss from imperfect text extraction.
- A single API call with the full document + detailed prompt generates the explanation, score, and page citations simultaneously.
- Eliminates the need for a complex chunking pipeline for the initial analysis pass.

### How it works

```typescript
import { GoogleAIFileManager } from '@google/generative-ai/server'

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!)

// 1. Upload PDF to Gemini Files API
const uploadResult = await fileManager.uploadFile(pdfBuffer, {
  mimeType: 'application/pdf',
  displayName: 'annual-report.pdf',
})

// 2. Send to Gemini 2.5 Flash with citation instruction
const result = await model.generateContent([
  {
    fileData: {
      mimeType: uploadResult.file.mimeType,
      fileUri: uploadResult.file.uri,
    },
  },
  {
    text: EXPLANATION_PROMPT, // instructs Gemini to cite page numbers
  },
])
```

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

```bash
npm install @google/generative-ai
```

---

## 6. Embeddings — Google `text-embedding-004`

**Confidence: MEDIUM** (free tier availability verified; multilingual quality is good but not benchmarked specifically on Indonesian financial text)

Use **`text-embedding-004`** via `@ai-sdk/google`.

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

If embedding quality proves insufficient for Indonesian financial retrieval (chunks retrieved are off-topic), upgrade to `voyage-multilingual-2` by Voyage AI. It has 200M free tokens and is specifically designed for multilingual content.

### Embedding pipeline

```typescript
import { embedMany } from 'ai'
import { google } from '@ai-sdk/google'

const { embeddings } = await embedMany({
  model: google.textEmbeddingModel('text-embedding-004'),
  values: pageChunks.map(c => c.text),
})

// Store: { document_id, page_number, content, embedding: vector(768) }
```

---

## 7. Vector Store — Supabase pgvector

**Confidence: HIGH**

Use **Supabase with pgvector extension** as the vector store. No separate vector DB needed.

### Why

- Already in the stack — same Postgres DB used for chat history and document metadata.
- pgvector is free, no separate vendor, no extra ops.
- At the scale of this project (≤300 vectors per document, ≤1,000 documents total on free tier), pgvector performance is indistinguishable from Pinecone or Qdrant.
- p50 latency with HNSW indexing: ~5ms — fine for chat-response use cases.
- Supabase free tier supports ~100K vectors within the 500 MB DB limit.

### Schema

```sql
-- Enable extension (run once via Supabase dashboard)
create extension if not exists vector;

-- Documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  ticker text,
  total_pages integer,
  uploaded_at timestamptz default now(),
  storage_url text
);

-- Page chunks table (vector embeddings)
create table page_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  page_number integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz default now()
);

-- HNSW index for fast approximate nearest neighbor search
create index on page_chunks using hnsw (embedding vector_cosine_ops);
```

### RAG retrieval query

```sql
select page_number, content
from page_chunks
where document_id = $1
order by embedding <=> $2  -- cosine distance
limit 5;
```

### Why NOT dedicated vector DBs

| Option | Verdict |
|--------|---------|
| Pinecone | ❌ Unnecessary — 2GB free but extra vendor; pgvector is free in existing Supabase |
| Qdrant Cloud | ❌ 1GB free but extra ops, extra vendor; overkill for this scale |
| ChromaDB local | ❌ No persistence on Vercel serverless; local-only |
| Weaviate Cloud | ❌ Extra vendor; 14K object free limit is too small |

---

## 8. Chat History & Metadata — Supabase Postgres

**Confidence: HIGH**

Store everything in Supabase's Postgres DB.

### Schema additions

```sql
-- Chat sessions
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  created_at timestamptz default now(),
  session_token text unique -- localStorage token for anonymous user continuity
);

-- Chat messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb, -- [{ page: 5, excerpt: "..." }]
  created_at timestamptz default now()
);

-- AI analysis results (cached to avoid re-running on page reload)
create table analysis_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  explanation text,
  score integer check (score between 1 and 10),
  score_reasoning text,
  score_breakdown jsonb, -- { profitability: 7, balance_sheet: 8, ... }
  created_at timestamptz default now()
);
```

### Free tier capacity

| Resource | Limit | Clarifin usage |
|----------|-------|----------------|
| DB storage | 500 MB | ~10K analyses, ~100K chat messages |
| File storage | 1 GB | ~200–500 PDFs (delete after processing) |
| Monthly active users | 50,000 | N/A (no auth in v1) |
| Bandwidth | 5 GB egress | Watch this — PDF downloads count |
| Projects | 2 | Use 1 for prod, 1 for dev |
| Inactivity pause | After 1 week (changed Feb 2026) | Keep project active with a cron ping |

⚠️ **Project pausing**: As of February 2026, Supabase free projects pause after 1 week of inactivity. Add a weekly cron job (Vercel Cron, free on Hobby) that pings the DB to prevent pausing.

---

## 9. Stock Data — yahoo-finance2

**Confidence: MEDIUM** (unofficial API; works but no SLA or rate limit guarantees)

Use **`yahoo-finance2`** npm package for IDX stock data.

### Why

- Pure JavaScript, no API key required, no cost.
- Actively maintained — v3.14.0 published March 26, 2026 (162K weekly downloads).
- Supports `.JK` ticker suffix for IDX-listed companies (e.g., `BBCA.JK`, `TLKM.JK`, `GOTO.JK`).
- Returns: current price, P/E ratio, P/B ratio, dividend yield, 52-week high/low, market cap.
- Works in Next.js API routes (server-side only — do NOT call from client to avoid CORS issues).

### Usage

```typescript
import yahooFinance from 'yahoo-finance2'

export async function getStockData(ticker: string) {
  // ticker: "BBCA.JK", "TLKM.JK", etc.
  const quote = await yahooFinance.quote(ticker)
  const summary = await yahooFinance.quoteSummary(ticker, {
    modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'],
  })
  return { quote, summary }
}
```

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

Yahoo Finance is an **unofficial API**. It can break without warning. Wrap all calls in try/catch and show a graceful fallback:

```typescript
try {
  const data = await getStockData(`${ticker}.JK`)
  return data
} catch (e) {
  // Show "stock data temporarily unavailable" — don't block document analysis
  return null
}
```

### Why NOT the alternatives

| Alternative | Verdict |
|-------------|---------|
| Alpha Vantage | ❌ 25 requests/day free limit — too restrictive |
| Stockbit API | ❌ No official public API; requires reverse engineering |
| RTI Business scraping | ❌ Fragile scraping; legal grey area |
| IDX official API | ❌ No free programmatic API |

---

## 10. Charts — Recharts v3

**Confidence: HIGH**

Use **Recharts v3** for financial trend charts.

### Why

- TypeScript-first full rewrite in v3 (released December 2024).
- 2.4–3.6M weekly downloads — most popular React charting library.
- Composable React component API — easy to reason about, easy to get AI help with.
- SVG-based — accessible, CSS-styleable.
- ~50KB gzipped — acceptable bundle size.
- Well-documented patterns for time-series (revenue/net income/margins over years) — exactly what Clarifin needs.

### Charts needed in Clarifin

```typescript
// Revenue + Net Income trend (Line/Bar combo)
<ComposedChart data={yearlyData}>
  <Bar dataKey="revenue" name="Revenue" />
  <Line dataKey="netIncome" name="Net Income" />
</ComposedChart>

// Margin trend (net margin %, gross margin %)
<LineChart data={yearlyData}>
  <Line dataKey="netMargin" />
  <Line dataKey="grossMargin" />
</LineChart>

// Score breakdown (Radar or Bar)
<RadarChart data={scoreBreakdown}>...</RadarChart>
```

### Why NOT the alternatives

| Alternative | Verdict |
|-------------|---------|
| Tremor | ⚠️ Good for SaaS dashboards, built on Recharts anyway, adds 200KB — skip the abstraction |
| ECharts | ❌ Config-driven, not React-native; overkill for 3–4 chart types |
| Chart.js | ❌ Imperative, canvas-based; Recharts is more React-native |
| Nivo | ⚠️ Beautiful but heavy (multiple packages); better for complex exploratory visuals |
| Visx | ❌ Too low-level; D3-like; solo dev overhead not worth it |

### Installation

```bash
npm install recharts
```

---

## 11. Hosting — Vercel Hobby

**Confidence: HIGH**

Deploy to **Vercel Hobby** (free tier).

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

Vercel Hobby limits API routes to **60 seconds maximum**. Long PDF processing (downloading from Supabase → parsing 300 pages → generating 300 embeddings) can exceed this.

**Mitigations:**
1. **Use streaming for LLM responses** — `streamText` from Vercel AI SDK is not subject to the 60s timeout the same way (streaming keeps connection alive).
2. **Split embedding pipeline**: trigger embedding as a separate background API call after the initial explanation starts streaming.
3. **Limit free-tier processing**: in v1, cap documents at 50 pages for free users to keep processing under 30 seconds. Show "large document" warning for reports over 50 pages.
4. **Defer RAG setup**: start streaming Gemini explanation immediately (Files API, fast); run embedding pipeline asynchronously in the background (polling via SSE or Supabase Realtime).

### Commercial use restriction

⚠️ Vercel Hobby is restricted to **personal, non-commercial use**. If Clarifin becomes a paid product, upgrade to Vercel Pro ($20/month) or migrate to a VPS.

### Installation

Deploy with: `vercel --prod` or connect GitHub repo in Vercel dashboard.

---

## 12. Auth — None for v1

**Confidence: HIGH** (aligned with PROJECT.md decision)

Per PROJECT.md: "No authentication required for v1 unless needed for rate-limiting or saving chat history."

**Decision: skip auth entirely in v1.** Use anonymous sessions:
- Generate a UUID session token on first visit, store in `localStorage`.
- Associate documents and chat sessions with session token in Supabase DB.
- No login, no email, no password.

**When to add auth (v2 triggers):**
- Users request "see my previous analyses"
- Need to enforce per-user rate limits (avoid abuse)
- Launch premium tier

**When you do add auth, use Supabase Auth** — already in the stack, 50K MAU free, integrates with RLS for DB-level security. Do NOT use Clerk (adds $20/month at scale, separate vendor, no direct pgvector integration).

---

## 13. LLM Observability — Langfuse

**Confidence: HIGH**

Use **Langfuse** for LLM tracing and eval tracking.

### Why

- **50,000 events/month** on the free Cloud tier — sufficient for hundreds of document analyses.
- Open-source (MIT) and self-hostable if free tier is exceeded.
- SDK-based instrumentation (add 2 lines to your LLM call) — does NOT require changing your base URL.
- Prompt management: version your prompts (explanation prompt, scoring prompt, RAG prompt) in Langfuse UI.
- Eval support: track Indonesian language eval runs against ground truth.
- Active maintenance; Helicone (the alternative) entered maintenance mode after acquisition by Mintlify in March 2026.

### Key use cases for Clarifin

1. **Token cost tracking**: monitor which prompts consume the most tokens
2. **Indonesian eval harness**: log model outputs for each eval case, track accuracy over prompt iterations
3. **Latency monitoring**: identify slow API calls (Gemini Files API upload, embedding)
4. **Error tracking**: 429 rate limit events, PDF parse failures

### Installation

```bash
npm install langfuse
```

```typescript
import { Langfuse } from 'langfuse'

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: 'https://cloud.langfuse.com',
})

const trace = langfuse.trace({ name: 'document-analysis', userId: sessionToken })
const span = trace.span({ name: 'gemini-explanation' })
// ... call Gemini ...
span.end({ output: result })
```

### Free tier limits

- 50,000 events/month on Langfuse Cloud
- At ~10 events per document analysis: supports ~5,000 analyses/month

---

## 14. AI Streaming SDK — Vercel AI SDK

**Confidence: HIGH**

Use **Vercel AI SDK v4** (`ai` package + `@ai-sdk/google`).

### Why

- `useChat` hook handles streaming, message state, error states out of the box.
- `streamText` in API routes manages streaming to the browser.
- Provider-agnostic: switch between Gemini and Groq by changing one import.
- Official `@ai-sdk/google` provider for Gemini 2.5 Flash.
- Has built-in RAG patterns (Supabase pgvector templates available).

### DON'T use LangChain

❌ **Do NOT build on LangChain** (`langchain`, `@langchain/core`). Reasons:
- Introduces a 3rd-party abstraction layer between your code and the LLM API, making debugging harder.
- Version churn is brutal — breaking changes across minor versions.
- AI SDK is simpler, TypeScript-native, and better supported for Vercel/Next.js.
- LangChain is justified when you need complex agent graphs or multi-provider routing — not for Clarifin's use case.

### Installation

```bash
npm install ai @ai-sdk/google
npm install @ai-sdk/groq  # for fallback
```

```typescript
// Streaming chat response (API route)
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

export async function POST(req: Request) {
  const { messages, context } = await req.json()
  
  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages,
    system: SYSTEM_PROMPT,
  })

  return result.toDataStreamResponse()
}
```

---

## Full Stack Installation

```bash
# Core framework
npx create-next-app@latest clarifin --typescript --tailwind --eslint --app --src-dir

# LLM + AI SDK
npm install ai @ai-sdk/google @ai-sdk/groq @google/generative-ai

# Supabase (DB, storage, vector)
npm install @supabase/supabase-js

# PDF parsing
npm install unpdf

# Stock data
npm install yahoo-finance2

# Charts
npm install recharts

# Observability
npm install langfuse

# Dev utilities
npm install -D @types/node tsx
```

---

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

---

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

**Binding constraint at scale**: Supabase's 5 GB/month bandwidth and Gemini's 250 RPD free limit. Both are acceptable at hobby launch; monitor from day one.

---

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
