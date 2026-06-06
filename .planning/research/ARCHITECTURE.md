# TA Module v2.0 — Architecture Research

**Researched:** 2026-06-06
**Domain:** Integration of standalone Technical Analysis surface (`/ta/{ticker}`) into the shipped Clarifin v1.0 Next.js 15 / Vercel Hobby / Supabase stack.
**Confidence:** HIGH on integration points (codebase verified); MEDIUM on ONNX deployment cost (size depends on training); MEDIUM on Vercel cron-count tradeoff (key facts ASSUMED — see Assumptions Log).

---

## Summary

The TA module slots into the v1.0 stack as a **sibling product surface**, not an extension of the document-upload pipeline. The codebase already has every primitive the TA module needs: Next.js 15 App Router on Vercel Hobby (60s function cap), a hardened `/api/internal/*-batch` worker pattern with `INTERNAL_PARSE_SECRET` Bearer + `?secret=` query auth, a singleton Langfuse client in `src/lib/langfuse.ts` instrumenting four LLM call sites, a `fetchStockData` server-only yahoo-finance2 wrapper with exponential backoff at `src/lib/stock/fetch-stock-data.ts`, a shared investment-advice guardrail at `src/lib/guardrail.ts`, and a Vercel AI SDK streaming chat route at `src/app/api/chat/route.ts` with onFinish persistence.

The major architectural decisions for v2.0 are: (1) **isolation** — TA is a sibling surface under `/ta/{ticker}` with its own RSC + client tree, sharing only the root layout and the session token; (2) **schema split** — five new TA-prefixed tables, leaving v1.0's `documents` / `chunks` / `chat_sessions` untouched; (3) **cron consolidation** — collapse the existing two crons plus three new TA needs into a **single dispatcher cron** to stay under the Vercel Hobby 2-cron limit; (4) **ONNX as a deployed static asset** — model file checked into the repo at `src/lib/ta/model/pattern-classifier.onnx`, lazy-loaded singleton via `onnxruntime-node`, accepting a one-time per-region cold start cost; (5) **two-pass cache** — Next.js `unstable_cache` per-deployment + Supabase `ta_analysis_cache` cross-deployment, invalidated by the nightly pre-warm cron at 11:00 UTC (18:00 WIB, one hour after IDX close); (6) **reuse, not extend** — the existing `langfuse` singleton, `guardrail`, `streamText` + `onFinish` pattern, and `INTERNAL_PARSE_SECRET` auth all transplant directly.

**Primary recommendation:** Build T1 (data + indicators + basic chart, no LLM, no ML) first as a clean, isolated path that proves the routing + caching architecture. Add T2 (patterns + Gemini explanation) once T1 is verified end-to-end against real BBCA.JK / TLKM.JK / GOTO.JK data. T3 (ML) can be developed in parallel with T2 because the ONNX model only needs the OHLCV cache from T1 to train and to feed inference at runtime. T4 (chat + observability + nightly pre-warm) is the last wave and reuses Phase 10/11 patterns wholesale.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| `/ta/{ticker}` page render | Frontend Server (RSC) | Browser (client subtree) | Same pattern as `/doc/[documentId]/page.tsx` — RSC fetches cached analysis, passes to client chart |
| Ticker autocomplete UI | Browser / Client | API / Backend (search route) | Debounced input fires `/api/ta/search`, returns ranked ticker matches |
| OHLCV fetch + cache | API / Backend (internal worker) | Database (ohlcv_cache) | yahoo-finance2 is server-only (Phase 9 lesson, CORS); cache lives in Supabase |
| Indicator computation | API / Backend (synchronous in analysis route) | — | Pure CPU work, `technicalindicators` npm package, ~50ms — runs inline |
| Candlestick + chart pattern detection | API / Backend (synchronous in analysis route) | — | Pure rule-based logic, ~20ms |
| ONNX inference | API / Backend (lazy-loaded singleton) | — | `onnxruntime-node` is Node.js native bindings, server-only |
| LLM explanation streaming | API / Backend (analysis or chat route) | Browser (AI SDK streaming reader) | Vercel AI SDK streamText, same pattern as Phase 10 chat |
| Pattern outcome backfill | API / Backend (cron-dispatched worker) | Database | Reads `pattern_outcome_log`, fills `actual_Nd_return` columns from cached OHLCV |
| Chart rendering | Browser / Client | — | Recharts is browser-only (Phase 9 Pitfall 2 verified); candlestick chart needs `"use client"` |
| Session token (localStorage) | Browser / Client | — | Reuses `src/components/session-provider.tsx` — no new session machinery |
| Disclaimer rendering | Browser / Client | — | Reuses Phase 12 DISCLAIM-01 inline pattern; new top-of-page banner per seed §9 |
| Rate limiting | API / Backend (route middleware) | — | Reuses `src/lib/rate-limit.ts` (Phase 12 INFRA-02 per-IP daily limiter) |

---

## 1. Page + Routing Structure

### 1.1 Page tier decision: RSC shell + client interactive subtree

The TA page **must** mirror the v1.0 `/doc/[documentId]/page.tsx` pattern: a Server Component shell that does the data fetch (cache lookup → OHLCV fetch → indicator/pattern compute → cached LLM explanation read) and hands a fully-populated prop tree to a client subtree for chart rendering and chat. Three reasons make RSC mandatory rather than optional:

1. **Recharts is browser-only.** v1.0 Phase 9 verified this — the SSR crash pitfall (`window is not defined`) is in `09-RESEARCH.md §Pitfall 2`. The candlestick chart and indicator subpanels must live inside `"use client"` components.
2. **yahoo-finance2 and the ONNX inference call are server-only.** Both must run on the server tier. RSC is the natural fetch boundary so the page doesn't need a separate client-side fetch round trip on first load.
3. **The Gemini Files API key cannot leak to the browser.** Same constraint as Phase 6 — call must happen server-side, response streams to client via `streamText`.

### 1.2 Relationship to `/doc/[documentId]`

| Concern | Decision | Rationale |
|---|---|---|
| Root layout | Shared (`src/app/layout.tsx`) | Same `<SessionProvider>` + `<OnboardingModal>` — the localStorage session token + first-time disclaimer modal apply to both surfaces |
| Top navigation | **New shared header component** to add — `src/components/site-header.tsx` | Currently no nav exists; v1.0 has a single surface at `/doc/{id}` reached via upload flow. Adding `/ta` requires a way to switch surfaces. Build a minimal header with two links: `Upload Document` (→ `/`) and `TA Analysis` (→ `/ta`). Render in `RootLayout`. |
| Session token | Shared via existing `SessionProvider` localStorage UUID | The v1.0 session UUID is anonymous and unscoped — it can index both `chat_sessions` (fundamentals chat) and a new `ta_session_views` table without conflict |
| Shared UI primitives | Reuse `src/components/ui/*` (shadcn) | Card, Badge, Accordion, Skeleton, Button — all already present |
| Disclaimer modal | Reuse existing `OnboardingModal` | DISCLAIM-03 already mounts in `RootLayout` — also covers first-visit TA users |
| Inline disclaimer | New TA-specific component | The seed §9 specifies a top-of-page non-dismissible "Educational analysis only" banner — distinct from v1.0 DISCLAIM-01 inline labels but follows the same pattern |
| Data isolation | Hard separation | TA page reads only from TA tables. It MUST NOT query `documents`, `chunks`, or `document_analysis`. The two surfaces share infrastructure, not data. |

### 1.3 Route map

```
src/app/
├── layout.tsx                  # EXTEND: mount <SiteHeader /> above {children}
├── page.tsx                    # unchanged (upload landing)
├── doc/[documentId]/           # unchanged (v1.0 fundamentals)
└── ta/                         # NEW SURFACE
    ├── page.tsx                # /ta — landing: ticker search + recent views
    └── [ticker]/
        └── page.tsx            # /ta/BBCA — RSC: fetch cached analysis, render chart + explanation + chat
```

The `/ta` landing page (without a ticker) is intentionally separate from `/` so the v1.0 upload flow stays the dominant first-touch surface. Users who land on `/` and want TA click the header link.

### 1.4 Open subdecision: ticker URL casing

URLs use **uppercase ticker without `.JK` suffix**: `/ta/BBCA`. Rationale: the `.JK` is a yahoo-finance2 implementation detail (Phase 9 `fetchStockData` already appends it server-side at line 76). Validate the path param with the same regex as the v1.0 stock route: `/^[A-Z]{1,5}$/`. Lower-case URLs redirect to upper-case via Next.js `redirect()` in the page component to keep cache keys deterministic.

---

## 2. Data Layer

### 2.1 Schema audit (vs seed §3)

The seed proposes five tables. Audit:

| Table | Verdict | Issues / Fixes |
|---|---|---|
| `ohlcv_cache` | Keep | Schema is correct. Add `expires_at TIMESTAMPTZ NULL` (optional — see §2.4 retention). Consider replacing the `id UUID` PK with a composite `PRIMARY KEY (ticker, date)` to halve row overhead at scale. |
| `ta_analysis_cache` | Keep | Schema is correct. The `expires_at` set to "next market close" is the right invalidation contract (matches seed §10 and the dispatcher cron strategy below). |
| `ta_session_views` | Useful but defer to T4 | Reading recent views is a nice-to-have, not a T1 requirement. Defer the table creation until T4 ("Recently viewed" UI strip). Cost is one migration later, not a re-architecture. |
| `pattern_outcome_log` | Keep, T3 timing | This table is the data substrate for model accuracy reporting (Decision 4 / seed §7). Create it in T3 alongside the ONNX integration. |
| `ticker_metadata` | Keep, T1 timing | Needed by `/api/ta/search` autocomplete. Seed schema is correct. Populate in a one-time migration script from a curated top-100 IDX list (no API source dependency at runtime). |
| **`stock_cache`** (v1.0) | Not present | The question references "redundant with v1.0 stock_cache" — **no such table exists**. v1.0 uses **column-level caching** on `documents.stock_data JSONB` + `documents.stock_fetched_at TIMESTAMPTZ` (D-07 in `09-RESEARCH.md`, lines 285–308). No redundancy concern. The TA module's `ohlcv_cache` stores time-series candles per ticker per date — a different shape than `documents.stock_data` (which stores current-quote + annual income history JSONB per document). Both can coexist. |

### 2.2 Missing tables / columns (seed gaps)

| Addition | Why | When |
|---|---|---|
| `ohlcv_cache.fetched_at TIMESTAMPTZ DEFAULT NOW()` | Distinguish "row created" from "data point time" so we can detect stale rows the cron skipped | T1 |
| `ta_analysis_cache.session_token UUID NULL` | Optional — lets us serve a personalized cached analysis if the user comes back within a market day. Skip in T1; revisit in T4. | T4 |
| `ta_analysis_cache.indicators_json_version INT` | Cheap forward-compat: if the indicator output shape changes (e.g., MACD signal field rename), bump this and invalidate stale rows by version mismatch instead of a destructive migration | T2 |
| `pattern_outcome_log.context_hash TEXT` | A SHA of (`rsi_bucket`, `trend_ema50`, `trend_ema200`, `cap_category`, `sector`, `pattern_name`) lets the UI quickly retrieve "similar contexts" sample size without scanning JSONB | T3 |

### 2.3 Indexes

```sql
-- OHLCV cache — primary access pattern is "give me the last N candles for ticker X"
CREATE INDEX idx_ohlcv_ticker_date_desc ON ohlcv_cache(ticker, date DESC);

-- Analysis cache lookup — exact match on (ticker, analysis_date)
-- The UNIQUE constraint already creates an index; no extra needed.

-- Pattern outcome log — accuracy queries by pattern, then by date
CREATE INDEX idx_pattern_outcome_pattern_date ON pattern_outcome_log(pattern_name, detected_date DESC);

-- Pattern outcome log — backfill cron query "find rows missing actual_Nd_return"
CREATE INDEX idx_pattern_outcome_backfill ON pattern_outcome_log(detected_date) WHERE actual_10d_return IS NULL;

-- Ticker metadata — search autocomplete by company_name ILIKE 'bank%' OR ticker LIKE 'BB%'
CREATE INDEX idx_ticker_metadata_company_name_lower ON ticker_metadata(LOWER(company_name) varchar_pattern_ops);
CREATE INDEX idx_ticker_metadata_ticker_prefix ON ticker_metadata(ticker varchar_pattern_ops);
```

The partial index on `pattern_outcome_log(detected_date) WHERE actual_10d_return IS NULL` is the key one — without it the nightly backfill cron does a full-table scan that grows linearly with logged patterns.

### 2.4 500 MB Supabase free-tier capacity check

Seed assumption: **5 years × 100 tickers × ~250 trading days/year OHLCV = 125,000 rows.**

Row size estimate (Postgres on-disk overhead ~24 bytes + payload):
- 4 numerics (OHLC) × 8 bytes = 32
- 1 numeric adj_close × 8 = 8
- 1 bigint volume = 8
- 1 date = 4
- 1 varchar(20) ticker ≈ 12
- 1 uuid + timestamptz = 24
- Tuple header ≈ 24
- **Per-row ≈ 110–120 bytes**

`125,000 × 120 bytes ≈ 15 MB` for the OHLCV table. With the descending date index roughly doubling on-disk footprint: **~30 MB**. Well within the 500 MB budget.

`ta_analysis_cache` is more JSONB-heavy. Conservative estimate: 50 KB per row (full indicator series + patterns + LLM explanation text). 100 tickers refreshed daily for 30 days of cache lookback = 3,000 rows × 50 KB = **150 MB**. **This is the binding constraint.** Mitigation: auto-delete rows where `expires_at < NOW() - INTERVAL '7 days'` via the dispatcher cron — this caps `ta_analysis_cache` at ~700 rows / **35 MB** steady-state.

`pattern_outcome_log` grows linearly with detected patterns. Estimate 10 patterns × 100 tickers × ~5 detections/year average = 5,000 rows/year ≈ **0.6 MB/year**. Negligible.

**Conclusion:** Free-tier safe at the proposed scale, provided we add the `ta_analysis_cache` retention cron.

### 2.5 Multi-tenancy / RLS

v1.0 uses `supabaseAdmin` (service role) for all writes and most reads, with the anon key gated. The TA tables follow the same model — no RLS needed because there is no per-user TA data (everything is keyed by ticker, not session). Exception: if `ta_session_views` is ever added (T4), it should be readable by session_token via an RLS policy, mirroring how `chat_messages` is gated by `session_id`.

---

## 3. API + Cron Strategy

### 3.1 New API routes — mapping to v1.0 patterns

The v1.0 route patterns to inherit (verified in codebase reads):

- **Server-only imports.** Every route handler starts with `import "server-only"` (see `src/lib/langfuse.ts:1`, `src/lib/stock/fetch-stock-data.ts:1`).
- **Zod schema at every boundary.** Body parsing uses `safeParse`, returns 400 on invalid input (see `parse-batch/route.ts:45–66`).
- **Never-throws to client.** External-facing routes wrap calls in try/catch and return null / a fallback shape — never propagate raw Gemini / yahoo-finance2 errors. See `fetchStockData` return-null convention.
- **`maxDuration = 60`** at the top of any handler that calls an LLM or external API. `runtime = "nodejs"` where Node features are needed (Langfuse, Buffer, onnxruntime-node).
- **Bearer + query-secret auth** for internal worker routes (see `parse-batch/route.ts` `timingSafeStringEq` + `extractBearer` lines 24–43).

| Route | Method | Tier | Auth | Pattern Mirror |
|---|---|---|---|---|
| `/api/ta/analysis/[ticker]` | GET | Public | None (rate-limited per IP) | `/api/stock/[ticker]/route.ts` — cache-then-fetch, never throws |
| `/api/ta/search` | GET | Public | None (rate-limited) | New shape; query param `q`; debounced from client |
| `/api/ta/chat` | POST | Public | None (per-IP + per-session rate limit) | `/api/chat/route.ts` — Vercel AI SDK `streamText` + `onFinish` + Langfuse Pattern B + guardrail pre-check |
| `/api/internal/ta-batch` | GET/POST | `INTERNAL_PARSE_SECRET` Bearer or `?secret=` | Cron-callable | `parse-batch/route.ts` — same `timingSafeStringEq` auth boundary |

### 3.2 Internal route — `ta-batch` as a multi-job dispatcher

Following v1.0's `parse-batch` pattern (a single internal worker that picks the next document to process), the TA batch worker should accept a `job` parameter and dispatch internally:

```typescript
// /api/internal/ta-batch — body or query param
type TaBatchJob =
  | { job: "refresh-ohlcv"; tickers?: string[] }    // refresh daily OHLCV for top 50 (or specified list)
  | { job: "prewarm-analysis"; tickers?: string[] } // run full analysis pipeline + cache for top 50
  | { job: "backfill-outcomes" }                    // fill actual_Nd_return on pattern_outcome_log rows
  | { job: "evict-cache" };                         // delete ta_analysis_cache rows past retention window
```

The single endpoint dispatches to handler modules in `src/lib/ta/jobs/`. This collapses multiple logical cron jobs into a single endpoint — see §3.4 for the dispatcher pattern.

### 3.3 Streaming chat — `/api/ta/chat`

Reuses the Phase 10 pattern wholesale. Key points from `src/app/api/chat/route.ts:1-50`:
- Build provider via `createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY })` (not the bare `google` export — line 39 of v1.0 chat route documents the Bug 3 fix that took down chat in early dev).
- Run `isInvestmentAdviceQuery(userMessage)` **before** the LLM call (CHAT-06 guardrail, zero LLM cost on deflection).
- Open Langfuse generation before `streamText`, close in `onFinish` (Pattern B from `11-CONTEXT.md` D-03).
- Persist user message **before** streaming starts so a mid-stream failure does not lose it.
- Reuse `CHAT_EMPTY_RETRIEVAL_MESSAGE` pattern for "no patterns detected for this ticker."

TA chat does not retrieve from `chunks` (no document corpus). Instead, retrieval inputs are:
- The current `ta_analysis_cache` row for the active ticker (indicators + patterns + probabilities)
- A short TA-glossary system prompt (RSI / MACD / Bollinger Bands definitions) — same shape as `CHAT_SYSTEM_PROMPT` in `src/lib/prompts.ts`

### 3.4 Vercel Hobby cron limit — the consolidation strategy

**Current state of `vercel.json` (verified):**
```json
{
  "crons": [
    { "path": "/api/internal/parse-batch", "schedule": "0 0 * * *" },
    { "path": "/api/internal/embed-batch", "schedule": "0 0 * * *" }
  ]
}
```

Two cron slots are already used. v1.0 has three **registered-but-needed** cron jobs that are still pending (R1, R2, R3 in `PROJECT.md` Active backlog): `analyze-batch`, `keep-alive`, and the auth fix for the existing two. Adding TA needs **at least three more** logical jobs (refresh-ohlcv, prewarm-analysis, backfill-outcomes, evict-cache).

**Vercel Hobby plan cron limits [ASSUMED — A1]:**
- Hobby plans permit a small fixed number of cron job definitions (the seed and CLAUDE.md both reference "2 free crons"). [ASSUMED — A1]
- Hobby plans historically allow only **daily** cron granularity; sub-daily schedules require Pro. [ASSUMED — A2]

**Consolidation pattern: a single dispatcher cron.**

```json
{
  "crons": [
    { "path": "/api/internal/dispatch?job=daily",  "schedule": "0 11 * * *" },
    { "path": "/api/internal/dispatch?job=weekly", "schedule": "0 12 * * 0" }
  ]
}
```

- `dispatch?job=daily` (11:00 UTC = 18:00 WIB, one hour after IDX close) runs a sequence: `parse-batch`, `embed-batch`, `analyze-batch`, `ta-batch?job=refresh-ohlcv`, `ta-batch?job=prewarm-analysis`, `ta-batch?job=backfill-outcomes`, `ta-batch?job=evict-cache`.
- `dispatch?job=weekly` runs `keep-alive` (the lightweight `SELECT 1` from INFRA-05, currently in `src/app/api/cron/keep-alive/route.ts`).

**Critical Vercel constraint to honor:** the `parse-batch` route comment (lines 13–22 of `src/app/api/internal/parse-batch/route.ts`) calls out **508 INFINITE_LOOP_DETECTED** when a route self-fetches the same URL. The dispatcher must invoke job handlers as **direct function imports** (`runParseBatch`, `runAnalyzeBatch`, `runTaRefreshOhlcv`, etc.) — not via HTTP fetch to other internal routes. Each handler is a pure module function; the dispatcher orchestrates them within the single 60s function invocation, monitoring an overall deadline.

```typescript
// src/app/api/internal/dispatch/route.ts — sketch
export const maxDuration = 60;

async function handleDaily() {
  const deadline = Date.now() + 55_000;
  const jobs = [
    runParseBatch,         // existing
    runEmbedBatch,         // existing
    runAnalyzeBatch,       // existing
    runTaRefreshOhlcv,     // T1
    runTaPrewarmAnalysis,  // T4 (depends on refresh first)
    runTaBackfillOutcomes, // T3
    runTaEvictCache,       // T2
  ];
  const results: Record<string, unknown> = {};
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    results[job.name] = await job({ deadline }).catch((err) => ({ error: String(err) }));
  }
  return NextResponse.json({ ok: true, results });
}
```

Each job function takes `{ deadline }` so it self-limits when the dispatcher is running low on time. Jobs that didn't run today are picked up tomorrow — same eventual-consistency model as v1.0's `parse-batch` loop.

**Trade-off accepted:** in the worst case, late jobs in the daily chain may be skipped if early ones exhaust the 60s budget. The pre-warm job is the most time-sensitive (it warms cache before market open the next day), so it runs **early in the chain**, after `refresh-ohlcv` (which it depends on). Document this ordering invariant in the dispatcher source.

### 3.5 INTERNAL_PARSE_SECRET reuse

Reuse the existing `INTERNAL_PARSE_SECRET` env var for the dispatcher and `ta-batch` routes — no new secret needed. The auth helper (`timingSafeStringEq` + `extractBearer`) should be **extracted to a shared module `src/lib/internal-auth.ts`** before T1 starts; both `parse-batch` and `analyze-batch` already duplicate it (visible at lines 24–43 of each route).

### 3.6 R1 — cron auth bug interaction

The v1.0 known issue R1 (`vercel.json` cron auth method mismatch) applies to the new dispatcher cron too. Vercel cron triggers issue GET requests **without custom headers** — auth must come from a query param. The dispatcher must accept `?secret=...` (the existing `parse-batch` route already does — line 52). When the dispatcher is the only cron entry point, the R1 fix is reduced to a single route's responsibility instead of touching every internal route.

---

## 4. ONNX Model Lifecycle

### 4.1 Where the file lives

| Location | Verdict |
|---|---|
| `public/models/pattern-classifier.onnx` | ❌ — this would expose the model to the public HTTP origin. Not a security issue (the model is a static artifact, not a secret), but adds a needless download path for end users and pollutes the CDN cache. |
| `src/lib/ta/model/pattern-classifier.onnx` | ✅ — **chosen.** Sits next to the TS code that loads it. Bundler treats it as an asset import. Not served by Next.js as a static file. |
| `node_modules/.../pattern-classifier.onnx` | ❌ — would require publishing the model as a private npm package; over-engineered. |
| Supabase Storage download at runtime | ⚠️ — viable fallback if the model grows beyond 50 MB. Cold-start cost shifts from "function bundle size" to "first request latency." Defer this design until T3 sizing is known. |

### 4.2 Singleton load pattern

```typescript
// src/lib/ta/model/inference.ts
import "server-only";
import * as ort from "onnxruntime-node";
import path from "node:path";

let sessionPromise: Promise<ort.InferenceSession> | null = null;

export function getSession(): Promise<ort.InferenceSession> {
  if (sessionPromise) return sessionPromise;
  const modelPath = path.join(process.cwd(), "src/lib/ta/model/pattern-classifier.onnx");
  sessionPromise = ort.InferenceSession.create(modelPath);
  return sessionPromise;
}
```

The `sessionPromise` (not the resolved session) is cached. Concurrent first-request callers all `await` the same in-flight promise — no race condition, no double-load. This mirrors the singleton pattern in `src/lib/langfuse.ts`.

### 4.3 Bundling concern — Next.js + Vercel

Webpack/Turbopack does NOT automatically copy non-JS files referenced via runtime `path.join` reads. Two options to ensure the `.onnx` file ships with the deployment:

1. **`next.config.js outputFileTracingIncludes`** — explicitly include the file path so Vercel's nft tracer ships it with the function bundle. **Recommended.**
   ```js
   experimental: {
     outputFileTracingIncludes: {
       'src/app/api/**/route.ts': ['./src/lib/ta/model/*.onnx'],
     }
   }
   ```
2. **`fs.readFile` at module load with a `?raw` loader** — not idiomatic in App Router. Skip.

### 4.4 Cold-start cost honest assessment

| Concern | Estimate / Risk |
|---|---|
| Model file size | XGBoost → ONNX with ~8 features × 100s of trees: **~2–10 MB** is realistic [ASSUMED A3]. Even at 50 MB the file fits Vercel's per-deployment limit (250 MB compressed [ASSUMED A4]). |
| Cold start: function bundle download | Adds ~50–500 ms to first invocation per region [ASSUMED A5] |
| Cold start: `InferenceSession.create()` | ~50–200 ms for small XGBoost models [ASSUMED A6] |
| Steady-state inference | Seed §2 estimates <100 ms — credible for an 8-feature XGBoost forward pass through `onnxruntime-node` |
| Per-region deployment | Vercel Hobby deploys to a single region by default. Multi-region adds proportional cold-start surface but Hobby plan is unlikely to need it. |

**Mitigation:** the nightly pre-warm cron (`ta-batch?job=prewarm-analysis`) calls `predictPatternOutcome` for the top-50 tickers. This warms the singleton inside the cron's function instance — but **does NOT warm the singleton for user-facing function instances**, because Vercel serverless invocations are independent processes. The cron warm-up is therefore only useful for cache population (Supabase rows), not for in-process model warm-up.

**Conclusion:** treat the first user request after a cold start in any region as paying a ~200 ms ONNX warm-up cost. This fits within the 4s "cache miss" budget from the seed §12 performance table.

### 4.5 What ships into the repo

```
src/lib/ta/
└── model/
    ├── pattern-classifier.onnx     # checked in via git LFS if >10 MB, else git-native
    ├── inference.ts                # singleton + predict()
    ├── feature-encoder.ts          # raw OHLCV + indicators → 8-dim feature vector
    └── model-version.json          # { version, trained_on, accuracy_oos, sample_size }
```

The `model-version.json` is **required** for the seed §7 "Display model accuracy in the UI" promise. The UI reads it via a server-side import and surfaces "Model accuracy: 52% on out-of-sample 2024 IDX data (n=4,200)" in the probability card.

### 4.6 Python training pipeline — out of production

Per Decision 4 in `notes/ta-module-design-decisions.md`, **no Python runtime ships to Vercel.** The Python training script lives in `scripts/ta/train_pattern_classifier.py`, runs locally on the developer's machine (or in a one-off Colab notebook), produces the `.onnx` file plus `model-version.json`, and the artifacts are committed to git. T3 plan must include a "how to retrain" runbook.

---

## 5. Caching Strategy

### 5.1 Three-tier cache

| Tier | Implementation | Lifetime | Cross-deployment? |
|---|---|---|---|
| 0. In-flight de-dup | Singleton promise (model session, etc.) | Per function instance | No |
| 1. Next.js `unstable_cache` | Wraps `fetchAndComputeFull(ticker)` with `revalidate: 300` during market hours | ~5 minutes per deployment instance | No — each function instance has its own memory |
| 2. Supabase `ta_analysis_cache` | Row keyed by `(ticker, analysis_date)` with `expires_at` set to next 11:00 UTC | Until next market close + cron run | **Yes** |
| 3. yahoo-finance2 OHLCV layer | `ohlcv_cache` rows fetched nightly by cron | Daily candle granularity | Yes |

### 5.2 Comparison to v1.0 Phase 9 caching

v1.0's caching pattern (verified in `src/lib/stock/fetch-stock-data.ts:148-180`):
- Cache lives **on the `documents` table** (`stock_data JSONB`, `stock_fetched_at TIMESTAMPTZ`).
- TTL is **24 hours** measured from `stock_fetched_at`.
- Pattern: read-then-fetch — if `stock_fetched_at` is within TTL, return cached; else fetch and upsert.
- **No Next.js `unstable_cache`** in v1.0 — Phase 9 deliberately skipped it because the page-level RSC fetch already deduplicates within a request, and Supabase row reads are <10ms.

TA module decision: **add the Next.js `unstable_cache` layer** because the TA analysis JSON payload is much larger (full OHLCV + indicators + patterns + LLM text — easily 200KB). Reading 200KB from Supabase 100 times during market open is ~5MB of egress per minute; the `unstable_cache` deduplicates within and across requests on the same function instance. v1.0's much smaller stock JSON didn't warrant this.

```typescript
// src/lib/ta/cache/get-analysis-cached.ts
import { unstable_cache } from "next/cache";

export const getAnalysisCached = (ticker: string) =>
  unstable_cache(
    async () => fetchAndComputeFull(ticker),
    ["ta-analysis", ticker],
    {
      revalidate: isMarketHours() ? 300 : 86400,
      tags: [`ta-analysis:${ticker}`],
    },
  )();
```

### 5.3 `revalidateTag` integration

The nightly pre-warm cron must invalidate the Next.js cache for all top-50 tickers after recomputing analysis. Pattern:

```typescript
// inside runTaPrewarmAnalysis(deadline)
for (const ticker of TOP_50) {
  await refreshSupabaseAnalysisRow(ticker);
  revalidateTag(`ta-analysis:${ticker}`);
}
```

When the cache entry is created with tag `ta-analysis:${ticker}`, `revalidateTag` drops the tag, forcing the next call to re-execute and re-read the freshly-written Supabase row.

**Note:** `revalidateTag` only invalidates the Data Cache on the **same deployment that calls it**. Other regions / function instances still serve their stale cache until their own `revalidate: 300` expires. This is acceptable: the worst case is 5 minutes of slightly-stale analysis served from a different region.

### 5.4 Market-close timing

IDX closes at 16:00 WIB. UTC offset is +7. Closing time UTC = **09:00 UTC**. The cron at `"0 11 * * *"` (11:00 UTC) gives a 2-hour buffer for yahoo-finance2's data to reflect the day's final candle. Earlier triggers risk getting yesterday's data.

### 5.5 Cache-busting on schema/model changes

If the indicator output shape changes between deploys, cached rows in `ta_analysis_cache` become incompatible. Mitigation: include `model_version` and `indicators_json_version` in the cache row; the read path checks both match current version and treats mismatch as cache miss.

---

## 6. Reuse Map

### 6.1 What gets reused as-is

| v1.0 Module | Reused By | How |
|---|---|---|
| `src/lib/langfuse.ts` | T2, T4 LLM call sites | Import the singleton; wrap Gemini calls with Pattern A (TA explanation) and Pattern B (TA chat onFinish). New trace names `"ta-explanation"` / `"ta-chat"`. |
| `src/lib/guardrail.ts` | `/api/ta/chat` | `isInvestmentAdviceQuery(userInput)` pre-LLM check, deflection on hit. The EN+ID regex already covers TA-flavored advice queries. |
| `src/lib/stock/fetch-stock-data.ts` | T1 — pattern reference only | Don't import — this fetches **quote + income history**, not OHLCV time series. But replicate its shape: server-only, exponential backoff via `withBackoff`, return-null on failure. Build `src/lib/ta/ohlcv/fetch-ohlcv.ts` from the same template. |
| `src/lib/rate-limit.ts` | All `/api/ta/*` public routes | INFRA-02 per-IP daily limiter from Phase 12. Apply at the route entry. |
| `src/lib/env.ts` | TA env additions | t3-env pattern. `INTERNAL_PARSE_SECRET` already exists, reused for dispatcher; no new secrets needed. |
| `src/components/session-provider.tsx` | `/ta/{ticker}` chat | Anonymous UUID session for `ta_session_views` and `ta_chat_sessions` |
| `src/components/onboarding-modal.tsx` | TA first visit | Already mounts in RootLayout via Phase 12. May want a TA-specific addendum line in T4. |
| `src/components/ui/*` | TA card / accordion / badge / skeleton / button | Pure passthrough. shadcn already in stack. |
| `src/app/api/chat/route.ts` | `/api/ta/chat` — pattern reference | Copy the streamText + onFinish + guardrail + Langfuse skeleton. Replace document-chunk retrieval with `ta_analysis_cache` row lookup. |
| `src/app/api/internal/parse-batch/route.ts` | `/api/internal/dispatch` + `/api/internal/ta-batch` — pattern reference | Copy the `timingSafeStringEq` + `extractBearer` + `?secret=` + Bearer auth dual-path. Extract to `src/lib/internal-auth.ts` first to avoid triplication. |

### 6.2 What gets extended (touched, not duplicated)

| v1.0 Module | Extension | Why |
|---|---|---|
| `src/app/layout.tsx` | Add `<SiteHeader />` mount above `{children}` | Currently no shared nav exists — TA module makes this necessary |
| `vercel.json` | **Replace** existing 2 crons with the dispatcher pair | See §3.4 consolidation strategy |
| `src/lib/internal-auth.ts` (new — extracted from existing routes) | Pull `timingSafeStringEq` + `extractBearer` out of parse-batch/analyze-batch/embed-batch | Avoid triplicating + further duplicating across dispatch + ta-batch |

### 6.3 What is entirely new

```
src/lib/ta/
├── ohlcv/                           # T1 — fetch + cache + schema
├── indicators/                      # T1 — wrapper, alignment, schema
├── patterns/                        # T2 — candlestick + chart detectors
├── model/                           # T3 — onnx file + inference + version
├── prompts.ts                       # T2 — TA system prompts
├── explain/                         # T2 — generate-ta-explanation
├── chat/                            # T4 — system prompt + retrieve context
├── cache/                           # T1/T2 — unstable_cache + Supabase read/evict
└── jobs/                            # T1-T4 — refresh, prewarm, backfill, evict

src/app/
├── ta/                              # T1 — landing + [ticker]/page.tsx
└── api/
    ├── ta/{analysis,search,chat}    # T1/T2/T4
    └── internal/{dispatch,ta-batch} # T1 — new dispatcher cron entry

src/components/
├── site-header.tsx                  # T1 — shared nav
└── ta/{search,chart,subpanel,markers,probability,accuracy,explanation,chat,disclaimer}  # T1-T4
```

### 6.4 Sessionization decision

**Reuse the existing session token, do NOT extend `chat_sessions` / `chat_messages`.**

| Decision | Rationale |
|---|---|
| Use existing `SessionProvider` localStorage UUID | Identity is shared; no duplication |
| New tables: `ta_chat_sessions`, `ta_chat_messages` | The v1.0 chat tables have FKs to `documents` and `chunks` (citations point to PDF pages). TA chat has no document — citations would point to indicators / patterns. Different data model. Forcing nullable FKs on `chat_messages` muddies the v1.0 schema. |
| `ta_session_views` | Optional, T4 — for a "Recently viewed tickers" UI strip on `/ta` landing |
| 7-day restore parity | Same TTL as v1.0 chat for consistency |

This decision **diverges from the seed**, which proposed reuse of `chat_sessions`. The divergence is justified by the FK shape mismatch and is consistent with the seed's broader "standalone module" framing (Decision 1).

### 6.5 Gemini call path — concrete example

The existing instrumented wrapper is `src/lib/explain/generate-explanation.ts`. It uses the **`@google/genai`** package (not the Vercel AI SDK) because it needs Files API access for PDFs. For TA, there is **no PDF**, so the right wrapper is the Vercel AI SDK `streamText` path (same as `/api/chat/route.ts`).

The TA explanation call site sketch:

```typescript
// src/lib/ta/explain/generate-ta-explanation.ts
import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { langfuse } from "@/lib/langfuse";
import { env } from "@/lib/env";
import { TA_EXPLANATION_MODEL_ID, buildTaExplanationPrompt } from "@/lib/ta/prompts";

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

export async function generateTaExplanation(args: {
  ticker: string;
  indicators: IndicatorsBlob;
  patterns: PatternResult[];
  probabilities: { bullish: number; neutral: number; bearish: number };
}) {
  const trace = langfuse.trace({
    name: "ta-explanation",
    metadata: {
      ticker: args.ticker,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      step: "ta-explanation",
    },
  });
  const generation = trace.generation({
    name: "gemini-ta-explanation",
    model: TA_EXPLANATION_MODEL_ID,
    input: { ticker: args.ticker, patterns: args.patterns.map(p => p.name) },
  });

  try {
    const prompt = buildTaExplanationPrompt(args);
    const result = await streamText({
      model: google(TA_EXPLANATION_MODEL_ID),
      prompt,
      onFinish: ({ usage, text }) => {
        generation.end({
          output: text,
          usageDetails: { input: usage.promptTokens, output: usage.completionTokens },
        });
      },
    });
    return result.toDataStreamResponse();
  } catch (err) {
    generation.end({ output: { error: String(err) }, level: "ERROR", statusMessage: String(err) });
    throw err;
  } finally {
    await langfuse.flushAsync();  // AI-SPEC §3 pitfall 1 — mandatory
  }
}
```

The key differences from v1.0's `generate-explanation.ts`:
- Uses `streamText` (AI SDK) not `ai.models.generateContentStream` (`@google/genai`) — no Files API needed.
- Pattern B Langfuse (open before streamText, close in `onFinish`) per `11-CONTEXT.md` D-03 — but lifted to the function level rather than the route, because TA chat (a separate function) also reuses this pattern.
- `langfuse.flushAsync()` in `finally` is non-negotiable — same as Pattern A.

---

## 7. Suggested Wave / Phase Build Order

### 7.1 Cross-phase dependencies

```
T1 (data + indicators)
    │
    ├── ohlcv_cache table          ◀── prerequisite for T3 (training data) AND T2 (pattern detection)
    ├── ticker_metadata table      ◀── prerequisite for /api/ta/search in T1, also used by T2/T4
    ├── indicator engine           ◀── prerequisite for T2 patterns, T3 features, T4 chat context
    └── basic candlestick chart    ◀── visual scaffold for T2 markers, T3 probability card overlay

T2 (patterns + Gemini explanation)
    │
    ├── candlestick + chart pattern detectors
    ├── Gemini streaming explanation
    ├── three-tier disclaimer framework
    ├── ta_analysis_cache table
    └── PARALLELIZABLE WITH T3 once ohlcv_cache + indicators exist

T3 (ML probability layer)
    │
    ├── Python training pipeline (offline, depends ONLY on ohlcv_cache export)
    ├── ONNX model + onnxruntime-node integration
    ├── pattern_outcome_log table + backfill job
    ├── probability card UI + model accuracy card
    └── BLOCKED on T1 ohlcv_cache being populated with 5y history

T4 (polish — chat + pre-warm + observability + mobile + rate limit)
    │
    ├── /api/ta/chat (depends on T2 patterns + T1 indicators in cache row)
    ├── ta_chat_sessions / ta_chat_messages tables
    ├── nightly pre-warm cron (depends on full T1+T2+T3 pipeline)
    ├── Langfuse instrumentation (depends on T2 + T4 LLM call sites existing)
    ├── mobile layout
    └── rate limiting (depends on routes existing)
```

### 7.2 Recommended wave structure

> Maps to existing GSD phase numbering: T1 → Phase 13, T2 → Phase 14, T3 → Phase 15, T4 → Phase 16. Within each phase, "waves" are intra-phase parallel groupings.

**Phase 13 / T1 — Data & Indicators (foundational)** — strictly sequential vs. other phases.

- Wave 0: Install deps (`technicalindicators`, `onnxruntime-node`), DB migration for `ohlcv_cache` + `ticker_metadata`, extract `src/lib/internal-auth.ts`, populate `ticker_metadata` from a checked-in seed JSON.
- Wave 1: `fetch-ohlcv.ts` + `upsert-ohlcv.ts` + `compute-indicators.ts` (parallel — independent modules).
- Wave 2: `/api/ta/analysis/[ticker]` route, `/api/ta/search` route, basic `/ta/[ticker]/page.tsx` RSC, basic `candlestick-chart.tsx` + `indicator-subpanel.tsx` (parallel — independent surfaces sharing Wave 1 fixtures).
- Wave 3: Dispatcher cron skeleton (`/api/internal/dispatch`), wire `runTaRefreshOhlcv` job, **replace** the two existing crons in `vercel.json` with the daily + weekly dispatcher pair. End-to-end verify: BBCA.JK renders with working indicators from cached data.

**Phase 14 / T2 — Patterns & Explanation** — can begin once T1 ohlcv_cache schema is committed (does not need full backfill).

- Wave 0: DB migration for `ta_analysis_cache`, prompt file `src/lib/ta/prompts.ts`, three-tier disclaimer banner.
- Wave 1: Candlestick detectors (12 files, parallelizable), chart pattern detectors (5 detectors, parallelizable).
- Wave 2: Pattern marker overlay component, Gemini streaming explanation function (Pattern A→B Langfuse hybrid as shown in §6.5), `/api/ta/analysis/[ticker]` route extended to invoke pattern detection + LLM call + cache write.
- Wave 3: Wire to dispatcher: `runTaPrewarmAnalysis` job, `runTaEvictCache` job. End-to-end verify: patterns + explanation for BBCA, TLKM, GOTO.

**Phase 15 / T3 — ML Model** — **can run in parallel with Phase 14** if and only if T1 has shipped enough OHLCV backfill data (5 years of top-100 tickers). The parallel split:

- T3 Wave 0 (parallel with T2 Wave 0–2): Python training pipeline, feature engineering, label generation from `ohlcv_cache` export.
- T3 Wave 1 (parallel with T2 Wave 2–3): XGBoost + Platt calibration, ONNX export, `model-version.json`.
- T3 Wave 2 (after T2 ships): `onnxruntime-node` inference singleton, feature encoder, `pattern_outcome_log` table + `runTaBackfillOutcomes` job, probability card + model accuracy card UI components — wires into the cache row built by T2.

Why parallel works: T2 and T3 share `ohlcv_cache` + indicators but otherwise touch disjoint code. The handoff is the `ta_analysis_cache.probabilities` JSONB field — T2 writes a placeholder shape, T3 replaces the placeholder with real ONNX output.

**Phase 16 / T4 — Polish** — strictly after T1+T2+T3.

- Wave 0: DB migration for `ta_chat_sessions`, `ta_chat_messages`, `ta_session_views`.
- Wave 1: `/api/ta/chat` route (mirrors `/api/chat`), TA chat panel, retrieve-ta-context helper, model-version surfacing in UI.
- Wave 2: Mobile layout, rate-limiting wired to TA routes, Langfuse instrumentation on TA chat (Pattern B), final disclaimer review.
- Wave 3: Adversarial test of guardrail on TA chat ("should I buy BBCA?"), end-to-end smoke on top 50 tickers, R1 verification on dispatcher cron auth.

### 7.3 Cross-phase risks to surface to planner

| Risk | Surfaced at | Mitigation |
|---|---|---|
| T3 ML accuracy under 45% — model not shippable | End of T3 Wave 1 | Fall back to historical-stats card (no ONNX output); seed §15 calls this out |
| Gemini 250 RPD exhausted under combined v1+TA load | T4 (cron pre-warming the top 50 burns ~50 calls/day) | See `research/questions.md` Q3 — quantify v1.0 Langfuse traces first; consider Groq fallback for TA chat |
| OHLCV backfill takes longer than expected | T1 Wave 3 | Cron only fetches one day per run; full 5-year backfill needs a one-off script (`scripts/ta/backfill-ohlcv.ts`) — add to T1 |
| ONNX model bundle pushes function over Vercel 250 MB limit | T3 Wave 2 | Fallback: move model to Supabase Storage, load on cold start; document size threshold in T3 plan |
| `revalidateTag` doesn't cross regions | T4 pre-warm | Accept up to `revalidate: 300` of staleness across regions; mention in T4 verification |
| Cron migration (replacing existing 2 crons with dispatcher) regresses parse/embed pipeline | T1 Wave 3 | Same-deploy switch + explicit verification step; keep old routes around as fallback for one deploy cycle |

---

## Assumptions Log

> All items below are flagged `[ASSUMED]` because they were not verified against an official source in this session. Each blocks a planning decision — discuss-phase or planner should confirm before locking.

| # | Claim | Section | Risk if Wrong | Suggested Verification |
|---|---|---|---|---|
| A1 | Vercel Hobby plan limits cron job definitions to 2 | §3.4 | If actually more (say, 5), the consolidation strategy is unnecessary; if fewer (rare), even more aggressive consolidation needed | Verify at https://vercel.com/docs/cron-jobs |
| A2 | Vercel Hobby cron schedules only allow daily granularity | §3.4 | If sub-daily is allowed, pre-warm timing flexibility improves | Same docs check |
| A3 | XGBoost → ONNX model for 8 features × ~200 trees produces a 2–10 MB file | §4.4 | If 50+ MB, function bundle bloat; if multi-GB, Supabase Storage required | Train baseline in T3 Wave 1 and measure |
| A4 | Vercel deployment package limit is 250 MB compressed | §4.4 | If lower, T3 may need Supabase Storage for model from day one | Check https://vercel.com/docs/functions/runtimes#size-limits |
| A5 | Function bundle download cold-start adds 50–500 ms per region | §4.4 | Real number depends on region + bundle size; impacts seed §12 4s target | Measure first-request latency post-deploy |
| A6 | `InferenceSession.create()` for small XGBoost ONNX takes 50–200 ms | §4.4 | If >1s, cold-start budget tight | Benchmark in T3 |
| A7 | yahoo-finance2's `chart()` or `historical()` returns OHLCV for IDX tickers reliably | §6.3 | If broken, T1 must source data differently (Stooq fallback per seed §15) | Live call against BBCA.JK in T1 Wave 0 |
| A8 | `technicalindicators` npm package is current, maintained, no native deps | §6.3 | If lapsed, indicator engine needs more work | `npm view technicalindicators` + try-import in T1 Wave 0 |
| A9 | IDX closes at 16:00 WIB and yahoo-finance2 reflects EOD candles by 18:00 WIB | §5.4 | Longer lag → cron timing adjustment | Empirical observation post-T1 |
| A10 | Supabase free-tier 500 MB DB limit is still current in 2026 | §2.4 | If reduced, retention pressure increases | Verify at supabase.com/pricing |

---

## Open Questions (architecturally relevant)

1. **Top-50 list source.** Hard-coded JSON checked into the repo (recommended for v2.0) vs daily fetch by market cap?
2. **OHLCV backfill bootstrap.** One-off script vs gradual via daily cron? Script approach is mandatory for T3 training data on day one.
3. **Header link visibility before T1 ships.** Coming-soon `/ta` landing in T1 Wave 0, feature-flag, or soft-launch? Recommend coming-soon.
4. **Cron migration sequencing.** Switching to dispatcher is destructive. Plan must include same-deploy switch with verification.
5. **TA chat retrieval context.** Indicator history, patterns, or both? Affects context window. Defer to T4 plan.
6. **Onboarding modal content.** TA-specific disclaimer modal vs reuse of v1.0's generic one? Confirm in T2 discuss-phase.

---

## Sources

### Primary (HIGH confidence — verified in codebase or specs this session)

- `.planning/PROJECT.md` (read in full)
- `.planning/MILESTONES.md` (read in full)
- `.planning/seeds/ta-module-standalone.md` (read in full)
- `.planning/notes/ta-module-design-decisions.md` (read in full)
- `.planning/milestones/v1.0-phases/09-stock-data-trend-chart/09-RESEARCH.md` (read in full)
- `.planning/milestones/v1.0-phases/11-observability-reliability/11-CONTEXT.md` (read in full)
- `.planning/research/questions.md` (read in full)
- `vercel.json` — confirmed only two crons registered
- `src/lib/langfuse.ts` — singleton instantiation pattern
- `src/lib/guardrail.ts` — `isInvestmentAdviceQuery` EN+ID regex
- `src/lib/stock/fetch-stock-data.ts` — yahoo-finance2 wrapper pattern
- `src/lib/explain/generate-explanation.ts` — Langfuse Pattern A skeleton
- `src/app/api/internal/parse-batch/route.ts` — auth pattern, 508 self-fetch warning
- `src/app/api/internal/analyze-batch/route.ts` — single-Gemini-call pattern
- `src/app/api/cron/keep-alive/route.ts` — INFRA-05 SELECT 1 pattern
- `src/app/doc/[documentId]/page.tsx` — RSC fetch pattern, R4 TODO marker
- `src/app/api/chat/route.ts` — AI SDK pattern, Bug 3 fix
- `src/app/layout.tsx` — current root layout
- `package.json` — Next.js 15.5, React 19, AI SDK 4.3, Recharts 3.8, yahoo-finance2 3.14, Langfuse 3.38

### Secondary (training-knowledge claims — flagged in Assumptions Log)

- Vercel cron docs (Hobby plan limits) — A1/A2
- Next.js App Router cache docs (`unstable_cache`, `revalidateTag`)
- Next.js `outputFileTracingIncludes` config
- onnxruntime-node behavior — A6
- Supabase free-tier limits — A10

---

## RESEARCH COMPLETE
