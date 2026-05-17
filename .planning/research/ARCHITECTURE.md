# Architecture Patterns

**Domain:** AI-powered PDF financial document explainer with citation-grounded RAG  
**Project:** Clarifin  
**Researched:** 2026-05-02  
**Confidence:** HIGH (stack), HIGH (RAG patterns), MEDIUM (Indonesian LLM quality), HIGH (deployment topology)

---

## Recommended Architecture

### System Overview

Clarifin is a **single-ingestion, multi-output RAG application**. A user uploads a PDF once; the system parses, chunks, and embeds it into a per-document vector namespace. Three downstream LLM pipelines (Explainer, Scorer, Chat) all read from the same embedded representation. The frontend communicates with Next.js API routes that orchestrate LLM calls and retrieve stock data.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                    │
│                                                                         │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────────────┐ │
│  │  Upload UI  │   │  Results Viewer  │   │  Chat Interface          │ │
│  │  (dropzone) │   │  (explanation +  │   │  (useChat hook,          │ │
│  └──────┬──────┘   │   score + chart) │   │   streaming messages)    │ │
│         │          └────────┬─────────┘   └────────────┬─────────────┘ │
└─────────┼───────────────────┼──────────────────────────┼───────────────┘
          │ multipart POST    │ poll/fetch                │ SSE stream
          ▼                   ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS API ROUTES (Vercel)                       │
│                                                                         │
│  /api/ingest          /api/explain         /api/chat                   │
│  /api/stock           /api/score                                        │
│                                                                         │
│  ┌────────────────┐  ┌──────────────┐  ┌───────────────┐               │
│  │  PDF Parser    │  │  Explainer   │  │   Chat LLM    │               │
│  │  (pdfplumber + │  │  LLM         │  │  (Gemini 2.5  │               │
│  │   pdfminer /   │  │  (Gemini 2.5 │  │   Flash,      │               │
│  │   pdf-parse)   │  │   Flash)     │  │   streamText) │               │
│  └───────┬────────┘  └──────┬───────┘  └───────┬───────┘               │
│          │                  │                  │                        │
│  ┌───────▼────────┐  ┌──────▼───────┐  ┌───────▼───────┐               │
│  │  Chunker       │  │  Scorer LLM  │  │   Retriever   │               │
│  │  (hybrid:      │  │  (Gemini 2.5 │  │  (vector      │               │
│  │  table-atomic  │  │   Flash,     │  │   similarity  │               │
│  │  + semantic    │  │   structured │  │   + metadata  │               │
│  │  prose)        │  │   output)    │  │   filter)     │               │
│  └───────┬────────┘  └──────────────┘  └───────────────┘               │
│          │                                                              │
│  ┌───────▼────────┐  ┌──────────────┐  ┌───────────────┐               │
│  │  Embedder      │  │  Stock Data  │  │   Observ.     │               │
│  │  (text-emb-3   │  │  Fetcher     │  │  (Langfuse)   │               │
│  │   -small or    │  │  (yahoo-     │  └───────────────┘               │
│  │   Gemini emb)  │  │   finance2)  │                                  │
│  └───────┬────────┘  └──────┬───────┘                                  │
└──────────┼─────────────────┼──────────────────────────────────────────┘
           │                 │
           ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│  Vector Store    │  │  In-Memory Cache │  │  Persistence (Neon PG    │
│  (Upstash Vector │  │  (Next.js route  │  │  or local SQLite)        │
│  free tier,      │  │  cache / Redis   │  │                          │
│  namespaced by   │  │  free tier)      │  │  - chat_sessions         │
│  doc_id)         │  │  TTL: 30min      │  │  - chat_messages         │
└──────────────────┘  └──────────────────┘  │  - eval_cases            │
                                             │  - eval_results          │
                                             │  - doc_metadata          │
                                             └──────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **PDF Parser** | Extracts raw text + table structures from uploaded PDF preserving page numbers. Uses `pdf-parse` (Node.js) for text + `python-pdfplumber` or `pdf2pic` for table detection. | → Chunker |
| **Chunker** | Splits parsed content into two track types: (A) table chunks (kept atomic, one chunk = one table), (B) prose chunks (semantic recursive split, ~500 tokens with 50-token overlap). Tags each chunk with `{page, section, chunk_type, doc_id}`. | → Embedder |
| **Embedder** | Converts chunks to dense vectors. Uses `text-embedding-3-small` (OpenAI, low cost) or Gemini `embedding-001`. Bundles metadata alongside each vector. | → Vector Store |
| **Vector Store** | Stores and retrieves vectors by semantic similarity. Uses Upstash Vector (free tier, 200M operations/month). Namespaced per `doc_id`. | ← Retriever |
| **Retriever** | Given a query, fetches top-K chunks from the doc's namespace. Returns chunk text + full metadata (`page`, `chunk_type`, `section`). Used by Chat LLM and Explainer. | ← Chat LLM, Explainer LLM |
| **Explainer LLM** | Generates plain-English explanation of the entire document. Receives all retrieved high-coverage chunks (or full-doc strategy for short docs). Outputs explanation with `[p.N]` inline citations. Cached per doc_id after first generation. | ← Retriever, → Cache |
| **Scorer LLM** | Generates 1-10 holistic score with structured reasoning (profitability, balance-sheet, growth, valuation). Uses `generateObject` for schema-validated output. Cached per doc_id. | ← Retriever, → Cache |
| **Chat LLM** | Handles user follow-up questions. Receives conversation history + retrieved relevant chunks. Streams response with inline `[p.N]` citations. Not cached (session-scoped). | ← Retriever, ← Session Store |
| **Stock Data Fetcher** | Fetches current price, P/E, P/B, dividend yield via `yahoo-finance2` with `.JK` ticker suffix. Server-side only (API key isolation). Caches result 30 min. | → In-Memory / Redis Cache |
| **Chart Renderer** | Client-side only. Receives financial time-series data (extracted by Explainer or a dedicated structured extraction call). Renders multi-year chart using Recharts. | ← Results Viewer (browser) |
| **Frontend** | Next.js App Router. Upload form, results display, chat interface. Uses `useChat` for streaming. Manages session ID in localStorage. | → API Routes |
| **Eval Harness** | Offline/dev-time only. A script + small DB table of (question, expected_answer, doc_id) test cases. Runs RAGAS metrics (faithfulness, answer relevancy, context recall) via LLM judge. Reports pass/fail per case. | ← Vector Store, ← LLMs |
| **Observability** | Langfuse SDK. Traces every LLM call with input, output, token counts, latency, cost estimate. Integrated as middleware wrapper around all LLM calls. | ← All LLM components |

---

## Data Flow: Upload → Explanation → Chat (End-to-End Trace)

```
1. USER UPLOAD
   Browser → POST /api/ingest (multipart, PDF file, ~1-200MB)
     ↓
   [PDF Parser]
     Extracts pages as {page_number, raw_text, tables: [{headers, rows, bbox}]}
     Preserves page boundaries — EACH page object tagged with page_number
     ↓
   [Chunker]
     For each page:
       - Detect tables → create TABLE chunks {text: "markdown table", page, chunk_type:"table", section}
       - Run recursive semantic split on remaining prose → PROSE chunks {text, page, chunk_type:"prose", section}
     All chunks carry: {doc_id, page, section, chunk_type, char_offset}
     ↓
   [Embedder]
     Batch embed all chunks → float vectors
     ↓
   [Vector Store]
     Upsert vectors to namespace doc_id with metadata payload
     ↓
   Returns: {doc_id, page_count, chunk_count, company_name (extracted or user-provided)}
   Stored in: doc_metadata table (Postgres)

2. EXPLANATION GENERATION
   Browser → GET /api/explain?doc_id=xyz
     ↓
   Check cache: doc_metadata.explanation IS NULL?
     ↓ (cache miss)
   [Retriever]
     Retrieve all chunks OR top-N high-coverage chunks sorted by page order
     (For short financial statements <50 pages: retrieve everything, pass as context)
     (For long annual reports >50 pages: retrieve top-40 by MMR diversity)
     ↓
   [Explainer LLM — Gemini 2.5 Flash, non-streaming]
     System: "You are explaining an Indonesian IDX financial document to an English-fluent non-finance reader.
              Use inline citations [p.N] after every factual claim. Source doc may be in Bahasa Indonesia—
              translate and explain natively in English."
     Prompt: [document chunks with page markers] + "Explain this document in plain English."
     Output: Markdown explanation with [p.N] citations throughout
     ↓
   [Observability — Langfuse trace created: explain/{doc_id}]
     ↓
   Cache: Store explanation in doc_metadata.explanation (Postgres)
   Return: {explanation_md, page_count}

3. SCORE GENERATION (parallel with explanation or sequential)
   Browser → GET /api/score?doc_id=xyz
     ↓
   Check cache: doc_metadata.score IS NULL?
     ↓ (cache miss)
   [Scorer LLM — Gemini 2.5 Flash, generateObject]
     Receives same chunks as Explainer (or cached explanation as compressed context)
     Schema: {overall: 1-10, profitability: {score, reasoning}, balance_sheet: {score, reasoning},
              growth: {score, reasoning}, valuation_context: {score, reasoning}}
     Output: Structured JSON score object
     ↓
   Cache: Store in doc_metadata.score_json (Postgres)
   Return: score JSON

4. STOCK DATA (parallel with explanation)
   Browser → GET /api/stock?ticker=BBCA.JK
     ↓
   [Stock Data Fetcher — server-side API route]
     Check in-memory cache (Next.js route cache or Redis): TTL 30 min
     Miss → call yahoo-finance2 .quote() + .historical()
     Return: {price, pe, pb, dividend_yield, sector_pe, 5y_revenue_arr}
     ↓
   [Chart Renderer — client-side]
     Receives financial time-series from Explainer output (structured extraction)
     or Stock Data Fetcher historical data
     Renders Recharts LineChart with multi-year trends

5. CHAT FLOW
   Browser (useChat) → POST /api/chat  {messages: [...], doc_id, session_id}
     ↓
   [Session Lookup]
     Load chat history from chat_messages WHERE session_id = ? ORDER BY created_at
     (session_id = UUID generated client-side, stored in localStorage, TTL = 7 days)
     ↓
   [Retriever]
     Embed latest user message → vector search in namespace doc_id → top-5 chunks
     Returns: [{text, page, chunk_type, section}, ...]
     ↓
   [Chat LLM — Gemini 2.5 Flash, streamText]
     System: "Answer questions about this IDX financial document. Cite page numbers as [p.N].
              Translate from Bahasa Indonesia natively. Never give buy/sell advice."
     Messages: [chat_history] + retrieved_context_block + user_message
     Stream: toDataStreamResponse() → SSE to browser
     ↓
   [Observability — Langfuse trace: chat/{session_id}/{turn_n}]
     ↓
   Persist: INSERT into chat_messages (session_id, doc_id, role, content, citations, created_at)
   Stream: tokens arrive in browser via useChat → progressive rendering
```

---

## Citation Preservation Mechanism

Citations travel from parse time to LLM output through a **metadata chain**:

```
[PDF Parse]
  raw_text at page N
        ↓ tag
[Chunk Metadata]
  {text: "...", page: N, section: "Balance Sheet", chunk_type: "table|prose"}
        ↓ embed + upsert with metadata
[Vector Store]
  vector + metadata payload (page, section, chunk_type stored as vector metadata fields)
        ↓ retrieve, return metadata with text
[LLM Context Window]
  Each chunk is rendered as:
  ---
  [PAGE 12 | Balance Sheet | TABLE]
  Revenue: Rp 12.4T (2024), Rp 10.1T (2023)
  ---
  The LLM is instructed: "When citing a fact, append [p.12] inline using the page number shown in the chunk header."
        ↓ LLM output
[Raw Response]
  "Revenue grew 23% YoY to Rp 12.4 trillion in 2024 [p.12]."
        ↓ parse citations
[Citation Extractor]
  Regex: /\[p\.(\d+)\]/g → extract page numbers
  Map each citation to a PDF.js page viewer anchor: #page=12
        ↓
[Frontend]
  Renders [p.12] as a clickable badge → opens PDF viewer pane scrolled to page 12
```

**Key guarantee:** Page number is an immutable property of every chunk from parse time forward. It is never inferred — only carried through.

---

## Indonesian Translation Strategy

**Recommendation: LLM-handles-both-natively (no separate translation step)**

**Rationale:**

| Approach | Pros | Cons |
|----------|------|------|
| **Translate-then-explain** (ID→EN translation API first, then RAG on EN text) | Guaranteed EN retrieval quality; embeddings in EN space | Extra API cost; loses document structure context (tables break in translation); doubles latency; translation errors compound into explanation errors; citation page numbers may shift |
| **LLM-native multilingual** (feed ID chunks directly, instruct LLM to explain in EN) | Single pass; Gemini 2.5 Flash is multilingual-capable; preserves structure; lower latency and cost; translation errors caught in context | Retrieval may be less precise for mixed-language embeddings |

**Decision:** Use multilingual embeddings (Gemini `text-multilingual-embedding-002` or `text-embedding-3-small` which handles ID well) and instruct the LLM to "read the Indonesian source and explain in English." Gemini 2.5 Flash demonstrates strong Indonesian multilingual performance per 2026 benchmarks.

**Hybrid guard:** If a chunk's text is >80% ASCII (already in EN), no special handling needed. If detected as ID (langdetect), include in system prompt: "The following excerpt is in Bahasa Indonesia. Translate concepts faithfully and explain in English."

**Cost/quality tradeoff:** Native multilingual at current Gemini 2.5 Flash quality is HIGH confidence for standard financial vocabulary. Known risk: obscure acronyms specific to OJK/IDX regulatory filings (e.g., "POJK", "PSAK 71"). Mitigate with a glossary injection in the system prompt.

---

## Streaming Architecture

```
Server (Next.js API Route /api/chat)
  streamText({
    model: google("gemini-2.5-flash"),
    messages: [...history, systemContext, userMessage],
    onFinish: async ({ text, usage }) => {
      // persist to DB
      // send Langfuse trace
    }
  })
  .toDataStreamResponse()   // SSE stream, compatible with useChat

Client (React, useChat hook)
  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { doc_id, session_id },
  })
  // messages[i].content updates progressively as tokens arrive
  // Citation badges rendered after stream completes (post-process [p.N] markers)
```

**Explanation generation (non-streaming):** The initial explanation is generated server-side once, cached in DB, then returned as a complete response. No streaming needed — the user sees a loading state, then the full explanation appears. This avoids mid-explanation citation confusion.

**Score generation:** Always `generateObject` (structured output), not streamed. Returns when complete.

**Vercel timeout:** Free tier has 10s function timeout. For ingestion (which may take 30-60s for large PDFs), use Vercel Edge Runtime's streaming response or offload to a background job pattern (return `{status: "processing"}` → client polls `/api/status?doc_id=xyz`).

---

## Persistence Boundaries

### Ephemeral (no DB required)
- Uploaded PDF bytes — parsed in memory, discarded after chunking
- Embedding computation — happens in request, vectors go to vector store
- Stock API responses — cached in Next.js route handler memory or Upstash Redis (TTL 30 min)
- Explanation/score LLM call context — in-request only

### Persistent (DB required)
| Table | What | Why |
|-------|------|-----|
| `documents` | doc_id, filename, company_name, ticker, page_count, created_at, session_id | Track uploads per session; retrieve metadata for results page |
| `document_analysis` | doc_id, explanation_md, score_json, status, generated_at | Cache LLM outputs; don't re-generate on page refresh |
| `chat_sessions` | session_id, doc_id, created_at, last_active | Anonymous sessions; keyed by localStorage UUID |
| `chat_messages` | id, session_id, role, content, citations_json, created_at | Persist conversation history for multi-turn chat |
| `eval_cases` | id, doc_id, question, expected_answer, created_at | Test dataset for eval harness |
| `eval_results` | id, eval_case_id, run_id, faithfulness, answer_relevancy, context_recall, actual_answer, created_at | RAGAS metric results per eval run |

**V1 minimum persistence:** `documents`, `document_analysis`, `chat_sessions`, `chat_messages`. Eval tables are dev-time only.

**DB choice for v1:** Neon (Postgres, free tier: 0.5GB storage, 1 compute hour/day). Drizzle ORM for type-safe queries. Alternatively, SQLite with Turso (free tier: 500 DB instances) for simpler ops.

**Anonymous session model:**
- On first visit, browser generates `crypto.randomUUID()` → stored in `localStorage`
- Session ID sent with every API request in request header or body
- Sessions expire after 7 days of inactivity (cron job or lazy cleanup)
- No auth, no login, no PII collected — compliant with minimal privacy footprint

---

## Two-Pass Generation Architecture

```
Single Ingestion (once per upload)
  PDF → Parse → Chunk → Embed → Store
        │
        └──→ doc_id returned to client

Pass 1A: Explanation (triggered immediately post-ingest, cached)
  doc_id → Retrieve all/top-N chunks → Explainer LLM → explanation_md → Store in DB

Pass 1B: Score (triggered in parallel with 1A, cached)
  doc_id → Retrieve all/top-N chunks → Scorer LLM → score_json → Store in DB

Pass 2: Chat (on-demand per user question, NOT cached)
  (question, session_id, doc_id) → Retrieve relevant chunks → Chat LLM → Stream response

Caching decision:
  - Explanation + Score: CACHE ALWAYS. They are deterministic per document (same PDF = same output).
    Re-generate only if explicitly requested (re-process button). Stored in `document_analysis`.
  - Chat: NEVER cache individual turns. Each conversation is unique. Chat history is persisted
    for continuity, not for output caching.

Stock data:
  - Cache at HTTP route level (Next.js `revalidate: 1800` or Redis TTL)
  - Not stored in main DB — too volatile and not needed for audit trail
```

---

## Eval Harness Architecture

**Location:** `scripts/eval/` directory in the repo. Dev-time only — never deployed to production.

```
scripts/eval/
  run-eval.ts          — main eval runner
  cases/               — JSON files with (doc_id, question, expected_answer, tags)
    bbca-2024-q3.json
    tlkm-2023-annual.json
  metrics/
    faithfulness.ts    — RAGAS faithfulness: are claims supported by retrieved context?
    relevancy.ts       — RAGAS answer relevancy: does answer address question?
    citation_check.ts  — Custom: do [p.N] citations match actual page content?
    id_accuracy.ts     — Custom: for ID-source docs, is translation accurate? (LLM judge)
  results/             — JSON outputs from eval runs (gitignored or tracked for regression)
```

**Test case structure for ID financial docs:**
```json
{
  "doc_id": "bbca-2024-q3",
  "source_language": "id",
  "question": "What was BBCA's net interest income in Q3 2024?",
  "expected_answer": "Net interest income was Rp 7.8 trillion",
  "expected_page": 5,
  "tags": ["financial_metric", "table", "bahasa_source"]
}
```

**Minimum test set for v1:** 20 questions across 3-4 different IDX documents (2 in ID, 1 in EN, 1 bilingual). Cover: tables, footnotes, multi-year comparisons, ratio calculations.

**LLM judge for translation accuracy:** A separate `judge` LLM call: "Given [ID chunk] and [EN explanation], does the explanation accurately translate the key figures and meaning? Answer YES/NO with reasoning."

---

## Observability Architecture

**Tool:** Langfuse (free cloud tier: 1M spans/month, or self-hosted Docker for zero cost)

```typescript
// Wrap every LLM call
import Langfuse from 'langfuse';

const langfuse = new Langfuse();

// In /api/explain:
const trace = langfuse.trace({ name: 'explain', userId: session_id, metadata: { doc_id } });
const generation = trace.generation({ name: 'explainer-llm', model: 'gemini-2.5-flash', input: prompt });
const result = await streamText({ ... });
generation.end({ output: result.text, usage: result.usage });
```

**What to track:**
- Latency per LLM call (target: explain <15s, score <8s, chat <5s first token)
- Token usage per call (input + output tokens, map to cost estimate)
- Retrieval quality: how many chunks retrieved, which pages cited
- Error rate: hallucination flags (if faithfulness score from eval drops below threshold)
- Session depth: average chat turns per document (product metric)

---

## Deployment Topology

```
┌─────────────────────────────────────────┐
│  Vercel (free hobby tier)               │
│                                         │
│  Next.js App Router                     │
│  ├── /app/**          (frontend)        │
│  ├── /api/ingest      (Node.js 60s)     │
│  ├── /api/explain     (Node.js 60s)     │
│  ├── /api/score       (Node.js 30s)     │
│  ├── /api/chat        (Edge, streaming) │
│  └── /api/stock       (Edge, cached)    │
└──────────────────┬──────────────────────┘
                   │
      ┌────────────┼─────────────┐
      ▼            ▼             ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Upstash  │ │  Neon    │ │ Langfuse │
│ Vector   │ │ Postgres │ │ (cloud   │
│ (free)   │ │ (free)   │ │  free)   │
└──────────┘ └──────────┘ └──────────┘
      │
┌──────────┐
│ Upstash  │
│ Redis    │
│ (free,   │
│ stock    │
│  cache)  │
└──────────┘
```

**Runtime notes:**
- `/api/ingest` and `/api/explain` may exceed Vercel's 10s timeout for large PDFs. Strategy: use `maxDuration: 60` (Vercel hobby supports up to 60s on Node runtime). If still too slow, stream progress back with a polling pattern.
- `/api/chat` runs on Edge runtime for minimal cold-start latency — streaming tokens faster to the user.
- `/api/stock` runs on Edge with `export const revalidate = 1800` (30 min ISR cache).
- LLM API calls (Gemini) happen server-side only — API keys never exposed to client.
- PDF bytes are uploaded via multipart POST → parsed in memory → never written to Vercel disk (ephemeral filesystem is fine for this pattern).

---

## Scalability Considerations

| Concern | At 100 users/day | At 10K users/day | At 1M users/day |
|---------|-----------------|------------------|-----------------|
| Vector store | Upstash free (200M ops) | Upstash paid ($20/mo) | Pinecone/Weaviate |
| LLM costs | Gemini free tier + quota | Gemini pay-as-you-go | Rate limiting, queuing |
| DB | Neon free (0.5GB) | Neon paid ($19/mo) | Connection pooling, read replicas |
| Ingestion time | In-request OK | Background jobs + status polling | Dedicated ingestion workers |
| PDF storage | Ephemeral (re-upload) | S3/R2 for dedup | CDN + dedup by hash |

---

## Build Order (Component Dependencies)

Components are ordered by dependency — each stage requires the prior stage to function.

```
FOUNDATIONAL (build first — everything else depends on these)
  1. PDF Parser + Chunker
     → Without chunking, no retrieval, no LLM calls possible
  2. Embedder + Vector Store integration (Upstash Vector)
     → Must store chunks before retrieval works
  3. Basic Retriever (similarity search with metadata passthrough)
     → Gate before ANY LLM feature

CORE FEATURES (build second — primary user value)
  4. Explainer LLM + citation formatting pipeline
     → Core value: plain-English explanation with page citations
  5. Frontend: Upload form + results viewer + PDF viewer (citation links)
     → Must show something to users
  6. Persistence: Neon DB setup + document_analysis caching
     → Without caching, re-generation on every page refresh

EXTENDED FEATURES (build third — value-add)
  7. Scorer LLM (generateObject schema)
     → Depends on same retrieval infra as Explainer; can share chunks
  8. Chat interface + Chat LLM + session state
     → Depends on Retriever + Persistence (chat_messages table)
  9. Stock Data Fetcher (yahoo-finance2 + cache)
     → Independent; can be built in parallel with chat

OBSERVABILITY + EVAL (build alongside or after)
  10. Langfuse integration (wrapper around all LLM calls)
      → Best added during LLM integration, not after
  11. Chart Renderer (client-side Recharts)
      → Depends on structured financial data from Explainer or Stock Fetcher
  12. Eval Harness (scripts/eval/)
      → Offline; build after first E2E flow works; use to validate ID translation quality

DEFERRED (v2+)
  - IDX auto-fetch (scraping)
  - Multi-document comparison
  - User accounts / saved analyses
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Chunking Tables as Prose
**What happens:** Standard recursive text splitter cuts table rows mid-row, losing column schema. LLM retrieves half a table and hallucinates missing cells.  
**Instead:** Detect tables with pdfplumber, serialize as Markdown, treat as atomic single chunks. Never split a table.

### Anti-Pattern 2: Generating Explanation Per Chat Turn
**What happens:** Calling the Explainer LLM on every follow-up question burns tokens and adds latency.  
**Instead:** Generate explanation ONCE on upload, cache in DB. Chat uses its own lightweight Retriever → Chat LLM path.

### Anti-Pattern 3: Translate All Text Before Embedding
**What happens:** Pre-translating ID→EN before embedding adds latency, loses structure, creates a second point of failure.  
**Instead:** Embed the ID text directly (multilingual embeddings handle this). Pass ID chunks to the LLM with instructions to explain in EN.

### Anti-Pattern 4: Client-Side LLM Calls
**What happens:** Exposing API keys in browser; uncontrolled usage; no observability.  
**Instead:** All LLM calls go through Next.js API routes. Client communicates via fetch/SSE only.

### Anti-Pattern 5: No Namespace Isolation in Vector Store
**What happens:** All users' document chunks in one namespace → incorrect cross-document retrieval. User A's chat retrieves User B's document content.  
**Instead:** Use Upstash Vector namespaces keyed by `doc_id`. Each document is fully isolated.

### Anti-Pattern 6: Synchronous Ingestion Blocking the HTTP Response
**What happens:** Large PDFs (200 pages) take 30-60s to parse + embed → Vercel timeout.  
**Instead:** Return `{doc_id, status: "processing"}` immediately. Frontend polls `/api/status?doc_id=xyz`. Signal completion via status flag in DB.

---

## Sources

- arxiv:2604.12047 — "Empirical Evaluation of PDF Parsing and Chunking for Financial Question Answering with RAG" (2026) — HIGH confidence
- arxiv:2603.26815 — Hybrid Document-Routed Retrieval (HDRR) for financial RAG — HIGH confidence
- Vercel AI SDK docs — streamText, useChat, tool calling patterns (sdk.vercel.ai/docs) — HIGH confidence
- Upstash Vector + Next.js integration (upstash.com/docs) — HIGH confidence
- Langfuse pricing / open-source (langfuse.com) — HIGH confidence
- yahoo-finance2 v3.14+ bundling fix for Next.js (github.com/gadicc/yahoo-finance2) — MEDIUM confidence
- INDOTABVQA 2026 benchmark — cross-lingual table understanding in Bahasa Indonesia — MEDIUM confidence
- Gemini 2.5 Flash multilingual capabilities — MEDIUM confidence (specific ID financial domain not benchmarked)
- RAGAS evaluation framework (ragas.io) — HIGH confidence
