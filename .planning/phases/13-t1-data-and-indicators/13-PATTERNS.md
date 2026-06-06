# Phase 13: T1 Data & Indicators - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 17 new/modified files
**Analogs found:** 15 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/ta/seed-and-backfill.ts` | script/utility | batch | `scripts/smoke-vector-perf.ts` | role-match |
| `supabase/migrations/*_ta_t1_schema.sql` | migration | — | `supabase/migrations/20260503000000_init.sql` | exact |
| `src/lib/internal-auth.ts` | utility | request-response | `src/app/api/internal/parse-batch/route.ts` lines 24-43 | exact (extract) |
| `src/lib/ta/fetch-ohlcv.ts` | service | request-response | `src/lib/stock/fetch-stock-data.ts` | exact |
| `src/lib/ta/upsert-ohlcv.ts` | service | CRUD | `src/lib/stock/fetch-stock-data.ts` lines 149-178 | role-match |
| `src/lib/ta/compute-indicators.ts` | utility | transform | `src/lib/stock/stock-schema.ts` + RESEARCH.md examples | partial |
| `src/app/api/ta/analysis/[ticker]/route.ts` | route | request-response | `src/app/api/stock/[ticker]/route.ts` | exact |
| `src/app/api/ta/search/route.ts` | route | request-response | `src/app/api/session/route.ts` | role-match |
| `src/app/api/internal/dispatch/route.ts` | route/middleware | request-response | `src/app/api/internal/parse-batch/route.ts` | exact |
| `src/app/ta/[ticker]/page.tsx` | page (RSC) | request-response | `src/app/doc/[documentId]/page.tsx` | exact |
| `src/components/ta/candlestick-chart.tsx` | component | event-driven | `src/components/doc/trend-chart-card.tsx` | role-match |
| `src/components/ta/indicator-subpanel.tsx` | component | event-driven | `src/components/doc/trend-chart-card.tsx` | role-match |
| `src/components/ta/ticker-search.tsx` | component | request-response | `src/components/chat/starter-questions.tsx` | partial |
| `src/components/site-header.tsx` | component | — | `src/app/layout.tsx` + `src/components/onboarding-modal.tsx` | partial |
| `vercel.json` | config | — | `vercel.json` (current) | exact (replace) |
| `tests/ta/ohlcv-validation.test.ts` | test | — | `src/lib/stock/fetch-stock-data.test.ts` | exact |
| `tests/ta/indicators.fixture.test.ts` | test | — | `src/lib/stock/fetch-stock-data.test.ts` | role-match |

---

## Pattern Assignments

### `scripts/ta/seed-and-backfill.ts` (script, batch)

**Analog:** `scripts/smoke-vector-perf.ts`

**Imports pattern** (lines 1-14):
```typescript
#!/usr/bin/env npx tsx
/**
 * One-shot: seed ticker_metadata with market-cap top-100 (≥2yr history)
 * and backfill 5yr OHLCV into ohlcv_cache.
 * Run: pnpm exec tsx scripts/ta/seed-and-backfill.ts
 */
import { createClient } from "@supabase/supabase-js";
import YahooFinance from "yahoo-finance2";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}
```

**Core pattern** (lines 28-116 of smoke-vector-perf.ts):
```typescript
// Pattern: requireEnv() for secrets, createClient with no session, main() + catch
async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // batch loop with progress logging
  for (let i = 0; i < total; i += batch) {
    const { error: insErr } = await supabase.from("ohlcv_cache").insert(rows);
    if (insErr) {
      // log and continue (D-06: defensive "best-available" handling)
      console.warn(`[seed] insert error for ${ticker}:`, insErr.message);
    }
    process.stdout.write(`  …${ticker} done\r`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Error handling pattern:** Log-and-continue per D-06 ("best-available" for gaps). Use `console.warn` for per-ticker failures; `console.error` + `process.exit(1)` only for fatal setup failures (missing env vars, Supabase unreachable).

**Key difference from smoke-vector-perf.ts:** The seed script writes a JSON output file to disk (`scripts/ta/seed-tickers.json`) alongside the DB upsert, so the ticker list is git-diff-visible and deterministic across deploys (D-02).

---

### `supabase/migrations/*_ta_t1_schema.sql` (migration)

**Analog:** `supabase/migrations/20260503000000_init.sql`

**Imports pattern** (lines 1-11 of init.sql):
```sql
-- ============================================================
-- Clarifin v2 TA T1 migration
-- ============================================================
-- Do NOT remove NOT NULL constraints from ohlcv_cache.
-- UNIQUE(ticker, date) is required to prevent duplicate rows
-- from concurrent cron runs (PITFALLS.md P2 — T1-OWNED).
-- ============================================================

-- Extensions already enabled in init.sql; no re-enable needed.
```

**Core table pattern** (lines 40-75 of init.sql — documents table):
```sql
-- Copy the table-definition pattern: uuid PK + NOT NULL constraints + indexes
create table if not exists public.ohlcv_cache (
  id          uuid primary key default gen_random_uuid(),
  ticker      text not null,
  date        date not null,
  open        numeric(18, 4) not null,
  high        numeric(18, 4) not null,
  low         numeric(18, 4) not null,
  close       numeric(18, 4) not null,
  adj_close   numeric(18, 4) not null,
  volume      bigint not null,
  fetched_at  timestamptz not null default now(),
  -- CRITICAL: without this, concurrent cron runs create duplicates
  constraint ohlcv_cache_ticker_date_unique unique (ticker, date)
);

-- Index pattern from init.sql lines 74-75 (doc_id_idx + page_idx style)
create index if not exists idx_ohlcv_ticker_date_desc
  on public.ohlcv_cache (ticker, date desc);

create table if not exists public.ticker_metadata (
  id           uuid primary key default gen_random_uuid(),
  ticker       text not null unique,
  name_en      text not null,
  name_id      text,
  sector       text,
  market_cap   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ticker_metadata_ticker
  on public.ticker_metadata (ticker);
-- For autocomplete ILIKE: prefix index pattern
create index if not exists idx_ticker_metadata_name_en_trgm
  on public.ticker_metadata using gin (name_en gin_trgm_ops);
```

**Migration comment pattern** (lines 2-6 of 20260519120000_stock_cache_columns.sql):
```sql
-- Phase 13 T1: ohlcv_cache + ticker_metadata tables (TA-INGEST-01, TA-DATA-01, TA-TICKER-01)
-- D-06: 5yr backfill uses these tables. T2/T3 both read them.
-- IF NOT EXISTS guards make the migration idempotent.
-- UNIQUE(ticker, date) on ohlcv_cache is NON-NEGOTIABLE — see PITFALLS.md P2.
```

---

### `src/lib/internal-auth.ts` (utility, request-response)

**Analog:** `src/app/api/internal/parse-batch/route.ts` lines 1-43 (extraction source)

**This is an exact extraction — copy verbatim from the triplicated pattern:**

**Full extracted module** (parse-batch/route.ts lines 1, 24-43):
```typescript
// src/lib/internal-auth.ts
import { timingSafeEqual } from "node:crypto";

/**
 * Shared internal-route auth helpers. Extracted from parse-batch / embed-batch / analyze-batch
 * in T1 Wave 0. All three existing routes MUST be updated to import from here.
 *
 * Dual-path auth (Bearer header OR ?secret= query param) is REQUIRED because
 * Vercel Cron GET requests cannot send custom headers (A5 in RESEARCH.md).
 */

export function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Pad both to the same length so the timingSafeEqual call always runs.
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA);
  bb.copy(padB);
  // Still do explicit length check, but only AFTER constant-time compare.
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}

export function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) {
    return null;
  }
  return h.slice(7);
}

// Dual-path: Bearer header (server after()) OR ?secret= query param (Vercel Cron)
export function resolveCandidate(request: Request): string {
  const url = new URL(request.url);
  return extractBearer(request) ?? url.searchParams.get("secret") ?? "";
}
```

**Update pattern for existing routes after extraction:**
```typescript
// Replace the inline implementations in parse-batch/route.ts, embed-batch/route.ts,
// analyze-batch/route.ts with:
import { timingSafeStringEq, resolveCandidate } from "@/lib/internal-auth";

// Then replace the inline candidate resolution:
// Before:
// const headerSecret = extractBearer(request);
// const querySecret = url.searchParams.get("secret");
// const candidate = headerSecret ?? querySecret ?? "";
// After:
const candidate = resolveCandidate(request);
```

**No `server-only` needed here** — this module uses only `node:crypto` which is a Node built-in, not a secret-leaking import. The routes that import it are already server-only routes.

---

### `src/lib/ta/fetch-ohlcv.ts` (service, request-response)

**Analog:** `src/lib/stock/fetch-stock-data.ts` — exact shape match

**Imports pattern** (lines 1-13 of fetch-stock-data.ts):
```typescript
import "server-only";   // REQUIRED — yahoo-finance2 is server-only (same as v1.0)

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

import { supabaseAdmin } from "@/db/client";  // omit if fetch-ohlcv.ts is pure fetch (upsert lives in upsert-ohlcv.ts)
```

**withBackoff pattern** (lines 40-64 of fetch-stock-data.ts — copy verbatim):
```typescript
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;

function isRateLimitError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /(429|rate.?limit|quota|RESOURCE_EXHAUSTED)/i.test(err.message)
  );
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt === RETRY_DELAYS_MS.length) {
        console.warn("[fetchOHLCV] no data available:", err instanceof Error ? err.message : err);
        return null;
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}
```

**Core pattern** (lines 71-76 of fetch-stock-data.ts — adapt for historical):
```typescript
// Ticker validation: same regex as fetch-stock-data.ts line 72
export async function fetchOHLCV(
  ticker: string,
  period1: Date,
  period2: Date,
): Promise<OHLCVBar[] | null> {
  if (!/^[A-Z]{1,5}$/.test(ticker)) {
    console.error("[fetchOHLCV] invalid ticker rejected", ticker);
    return null;
  }
  const symbol = `${ticker}.JK`;
  // Use yahoo-finance2 historical() instead of quote() + quoteSummary()
  const bars = await withBackoff(() =>
    yahooFinance.historical(symbol, { period1, period2, interval: "1d" })
  );
  if (!bars || bars.length === 0) return null;
  // TA-INGEST-01: validate each bar before returning
  return bars
    .filter((b) => b.high >= b.low && b.close > 0 && b.volume >= 0)
    .map((b) => ({ /* ... mapping ... */ }));
}
```

**Return-null-on-failure convention** (lines 86-88): Never throw to caller. Return null. Caller decides how to handle absence.

**Zod schema pattern** (stock-schema.ts lines 8-36): Define an `ohlcvBarSchema` + `OHLCVBar` type in a sibling `src/lib/ta/ohlcv-schema.ts` following the exact same pattern as `stock-schema.ts`.

---

### `src/lib/ta/upsert-ohlcv.ts` (service, CRUD)

**Analog:** `src/lib/stock/fetch-stock-data.ts` lines 149-178 (the cache-write section of `fetchStockDataForDocument`)

**Core upsert pattern** (fetch-stock-data.ts lines 172-178):
```typescript
import "server-only";

import { supabaseAdmin } from "@/db/client";
import type { OHLCVBar } from "./ohlcv-schema";

export async function upsertOHLCV(
  ticker: string,
  bars: OHLCVBar[],
): Promise<void> {
  if (bars.length === 0) return;
  const { error } = await supabaseAdmin
    .from("ohlcv_cache")
    .upsert(
      bars.map((b) => ({
        ticker,
        date: b.date,
        open: b.open, high: b.high, low: b.low,
        close: b.close, adj_close: b.adjClose, volume: b.volume,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "ticker,date" },   // CRITICAL — prevents duplicate rows
    );
  if (error) {
    console.error("[upsertOHLCV] upsert error", ticker, error.message);
    // Do not throw — match fetch-stock-data.ts return-null-on-failure convention
  }
}
```

**Error handling:** Log and swallow (same as fetch-stock-data.ts lines 86-88 cache-write pattern). The nightly cron will retry on next run.

---

### `src/lib/ta/compute-indicators.ts` (utility, transform)

**Analog:** `src/lib/stock/stock-schema.ts` (schema + types co-located with transforms) + RESEARCH.md code examples

**No exact analog in codebase** — technicalindicators is a new library. Use the patterns from RESEARCH.md.

**Imports pattern:**
```typescript
// Pure server-side computation — NOT "server-only" (technicalindicators is pure JS,
// but computation must stay server-side so results are cached, per RESEARCH.md anti-pattern 3)
import { RSI, MACD, BollingerBands, EMA, SMA, ATR, Stochastic, OBV } from "technicalindicators";
import type { OHLCVBar } from "./ohlcv-schema";
```

**Warmup alignment pattern** (RESEARCH.md Pattern 2 — mandatory):
```typescript
// CRITICAL: every indicator returns fewer values than input by its warmup period.
// Must left-pad with null to align with OHLCV bars. See PITFALLS.md C2.
function alignIndicator<T>(values: T[], totalBars: number, warmup: number): (T | null)[] {
  // Assert values.length + warmup === totalBars, or log mismatch warning
  return [...Array(warmup).fill(null), ...values];
}

const WARMUP = {
  RSI: (period: number) => period,
  MACD: (fast: number, slow: number, signal: number) => slow + signal - 2,
  BollingerBands: (period: number) => period - 1,
  EMA: (period: number) => period - 1,
  SMA: (period: number) => period - 1,
  ATR: (period: number) => period,
  Stochastic: (period: number) => period - 1,
  OBV: () => 0,
} as const;
```

**Core computation pattern:**
```typescript
export function computeIndicators(bars: OHLCVBar[]): IndicatorSet {
  const closes = bars.map((b) => b.adjClose);  // ALWAYS adjClose, never raw close
  const highs  = bars.map((b) => b.high);
  const lows   = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);
  const n = bars.length;

  const rsiRaw = RSI.calculate({ period: 14, values: closes });
  const rsi = alignIndicator(rsiRaw, n, WARMUP.RSI(14));
  // ... repeat for each indicator ...
  return { rsi, macd, bollingerBands, ema20, ema50, ema200, sma50, atr, stochastic, obv };
}
```

**Zod schema for output:** Co-locate a `src/lib/ta/indicator-schema.ts` mirroring `stock-schema.ts` pattern — Zod schema + TS type for `IndicatorSet`.

---

### `src/app/api/ta/analysis/[ticker]/route.ts` (route, request-response)

**Analog:** `src/app/api/stock/[ticker]/route.ts` — exact structure match

**Imports pattern** (stock/[ticker]/route.ts lines 1-5):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
// TA-specific imports:
import { computeIndicators } from "@/lib/ta/compute-indicators";
import { upsertOHLCV } from "@/lib/ta/upsert-ohlcv";
```

**Ticker validation pattern** (stock/[ticker]/route.ts lines 7-8):
```typescript
// COPY VERBATIM — same regex used throughout v1.0 for IDX ticker validation
const tickerSchema = z.string().regex(/^[A-Z]{1,5}$/);
```

**Route handler pattern** (stock/[ticker]/route.ts lines 12-51):
```typescript
export const maxDuration = 60;
export const runtime = "nodejs"; // required for supabaseAdmin + server-only imports

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const { ticker: rawTicker } = await context.params;
  const parsed = tickerSchema.safeParse(rawTicker);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid ticker. Must be 1–5 uppercase letters." },
      { status: 400 },
    );
  }
  // ... fetch from ohlcv_cache, compute indicators, return AnalysisPayload ...
}
```

**Cache-Control header pattern** (stock/[ticker]/route.ts lines 40-50):
```typescript
// Short-lived CDN cache — analysis is nightly-refreshed, not real-time
return NextResponse.json(
  { data: analysisPayload, error: null },
  {
    status: 200,
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
  },
);
```

---

### `src/app/api/ta/search/route.ts` (route, request-response)

**Analog:** `src/app/api/session/route.ts` (simple POST with Zod validation + Supabase query)

**Core pattern** (session/route.ts lines 1-51):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/db/client";

// Zod validates the search query param
const searchSchema = z.object({
  q: z.string().min(1).max(10).toUpperCase(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({ q: url.searchParams.get("q") });
  if (!parsed.success) {
    return NextResponse.json({ results: [] });
  }
  const { q } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("ticker_metadata")
    .select("ticker, name_en, name_id, sector")
    .or(`ticker.ilike.${q}%,name_en.ilike.${q}%`)
    .limit(10);

  if (error) {
    return NextResponse.json({ results: [] }, { status: 200 }); // fail-open for autocomplete
  }
  return NextResponse.json({ results: data ?? [] });
}
```

**Error handling:** Fail-open (return `{ results: [] }` on DB error) — autocomplete is non-critical. Same fail-open pattern as `rate-limit.ts` lines 31-35.

---

### `src/app/api/internal/dispatch/route.ts` (route, request-response)

**Analog:** `src/app/api/internal/parse-batch/route.ts` — same auth surface, dispatcher structure from RESEARCH.md Pattern 3

**Full pattern** (parse-batch/route.ts lines 1-107 — adapt):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { timingSafeStringEq, resolveCandidate } from "@/lib/internal-auth"; // Wave 0 extraction
import { runParseBatch } from "@/lib/ingest/parse-document-batch";
import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";
import { runAnalyzeBatch } from "@/lib/ingest/analyze-document-batch";
import { runTaRefreshOhlcv } from "@/lib/ta/jobs/refresh-ohlcv";

export const maxDuration = 60;
export const runtime = "nodejs";

// CRITICAL: Direct function imports ONLY. Never self-fetch.
// parse-batch/route.ts lines 13-22 document the 508 INFINITE_LOOP_DETECTED reason.
```

**Auth pattern** (parse-batch/route.ts lines 49-56):
```typescript
// Reuse resolveCandidate() from internal-auth.ts (extracted in Wave 0)
const candidate = resolveCandidate(request);
if (!timingSafeStringEq(candidate, env.INTERNAL_PARSE_SECRET)) {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}
```

**Job dispatch pattern** (RESEARCH.md Pattern 3):
```typescript
const jobSchema = z.enum(["daily", "weekly"]);

async function handleDispatch(request: Request): Promise<Response> {
  // ... auth check ...
  const url = new URL(request.url);
  const jobParsed = jobSchema.safeParse(url.searchParams.get("job"));
  if (!jobParsed.success) {
    return NextResponse.json({ error: "Unknown job." }, { status: 400 });
  }
  const deadline = Date.now() + 55_000; // same 55s budget as parse-batch line 93
  if (jobParsed.data === "daily") {
    return handleDaily(deadline);
  }
  return handleWeekly(deadline);
}

export function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}
```

---

### `src/app/ta/[ticker]/page.tsx` (RSC page, request-response)

**Analog:** `src/app/doc/[documentId]/page.tsx` — exact RSC + gate-states pattern

**Imports pattern** (doc/[documentId]/page.tsx lines 1-12):
```typescript
// RSC page — no "use client". Data fetching happens server-side.
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/db/client";
import { z } from "zod";
// TA-specific
import { CandlestickChart } from "@/components/ta/candlestick-chart";
import { TAPageSkeleton } from "@/components/ta/ta-page-skeleton";
import { TAErrorCard } from "@/components/ta/ta-error-card";
import { SparseDataCard } from "@/components/ta/sparse-data-card";
import { MobileInfoCard } from "@/components/ta/mobile-info-card";
```

**Gate-states pattern** (doc/[documentId]/page.tsx lines 14-146):
```typescript
export default async function TaTickerPage(props: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await props.params;

  // D-05: Uppercase redirect — same pattern as v1.0 ticker validation
  const tickerSchema = z.string().regex(/^[A-Z]{1,5}$/);
  if (rawTicker !== rawTicker.toUpperCase()) {
    redirect(`/ta/${rawTicker.toUpperCase()}`);  // TA-TICKER-02: lowercase 301
  }
  const parsed = tickerSchema.safeParse(rawTicker);
  if (!parsed.success) {
    return <TAErrorCard ticker={rawTicker} />;
  }

  // Gate: is ticker in ticker_metadata?
  const metaRes = await supabaseAdmin
    .from("ticker_metadata")
    .select("ticker, name_en")
    .eq("ticker", parsed.data)
    .maybeSingle();
  if (!metaRes.data) return <TAErrorCard ticker={parsed.data} />;

  // Fetch analysis from ta_analysis_cache (or compute inline if uncached)
  const analysisRes = await fetch(`${baseUrl}/api/ta/analysis/${parsed.data}`, { cache: "no-store" });
  const analysis = await analysisRes.json();

  // Gate: TA-CHART-08 sparse-data state
  if (!analysis.data || analysis.data.ohlcv.length < 30) {
    return <SparseDataCard ticker={parsed.data} />;
  }

  // Gate: D-05 mobile baseline (server-agent check OR client-side useMediaQuery)
  // Server-agent approach (simpler for RSC):
  // const ua = headers().get("user-agent") ?? "";
  // const isMobile = /Mobi|Android/i.test(ua);
  // if (isMobile) return <MobileInfoCard />;

  return (
    <CandlestickChart
      ticker={parsed.data}
      ohlcv={analysis.data.ohlcv}
      indicators={analysis.data.indicators}
    />
  );
}
```

---

### `src/components/ta/candlestick-chart.tsx` (component, event-driven)

**Analog:** `src/components/doc/trend-chart-card.tsx` — same "use client" + chart-in-useEffect pattern; but library differs (lightweight-charts vs Recharts)

**"use client" + imports pattern** (trend-chart-card.tsx lines 1-16):
```typescript
"use client";

// lightweight-charts is canvas-based; must be "use client" only
import { createChart, type IChartApi } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
```

**useEffect + ref pattern** (RESEARCH.md Pitfall 6 — mandatory):
```typescript
export function CandlestickChart({ ohlcv, indicators, ticker }: ChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // NEVER call createChart outside useEffect — ref.current is null on SSR
    if (!mainRef.current) return;
    const mainChart = createChart(mainRef.current, { /* options */ });
    // ... create series, sync subpanels ...
    return () => {
      mainChart.remove(); // ALWAYS dispose in cleanup
    };
  }, [ohlcv, indicators]); // re-run when data changes

  return (
    <div className="flex flex-col gap-0">
      <div ref={mainRef} role="img" aria-label={`${ticker} candlestick chart`} className="h-[300px] w-full" />
      <div ref={volumeRef} className="h-[80px] w-full" />
      <div ref={rsiRef} className="h-[100px] w-full" />
      <div ref={macdRef} className="h-[120px] w-full" />
    </div>
  );
}
```

**Subpanel sync pattern** (RESEARCH.md Pattern 1 — copy verbatim):
```typescript
let isSyncing = false; // REQUIRED guard — prevents infinite re-entrant sync loops
function syncFrom(source: IChartApi, charts: IChartApi[]) {
  if (isSyncing) return;
  isSyncing = true;
  const range = source.timeScale().getVisibleRange();
  if (range) {
    charts.filter((c) => c !== source).forEach((c) => c.timeScale().setVisibleRange(range));
  }
  isSyncing = false;
}
mainChart.timeScale().subscribeVisibleTimeRangeChange(() =>
  syncFrom(mainChart, [volumeChart, rsiChart, macdChart])
);
```

**Tailwind styling pattern** (trend-chart-card.tsx lines 59-73):
```typescript
// Use same section + aria-label + cn() pattern
<section
  aria-label="Technical Analysis"
  className={cn("flex flex-col gap-4 rounded-lg border border-border bg-background p-4", className)}
>
```

---

### `src/components/ta/indicator-subpanel.tsx` (component, event-driven)

**Analog:** `src/components/doc/trend-chart-card.tsx` (chart component structure)

This is a specialized sub-component of `candlestick-chart.tsx`. The subpanel sync is wired in `candlestick-chart.tsx` (the parent), not inside this component. The subpanel itself is a presentational wrapper.

**Pattern:** Same `"use client"` + `useEffect` + `useRef<HTMLDivElement>` pattern as `candlestick-chart.tsx`. The subpanel receives a `chartRef` or `onChartReady` callback to let the parent wire up `subscribeVisibleTimeRangeChange`.

---

### `src/components/ta/ticker-search.tsx` (component, request-response)

**Analog:** `src/components/chat/starter-questions.tsx` (interactive list of clickable items) — partial match

**"use client" + interaction pattern** (starter-questions.tsx lines 1-51):
```typescript
"use client";

import { cn } from "@/lib/utils";

// Pattern: simple state-driven component, no complex hooks
export function TickerSearch(props: {
  onSelect: (ticker: string) => void;
  className?: string;
}) {
  // shadcn Command component for autocomplete
  // Debounce: standard useEffect + setTimeout pattern (not from codebase — standard React)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/ta/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setResults(json.results ?? []);
    }, 200); // 200ms debounce
    return () => clearTimeout(timer);
  }, [query]);
}
```

**Button/item style pattern** (starter-questions.tsx lines 37-47):
```typescript
// Reuse the same rounded-full border bg-muted/30 chip style for search result items
className={cn(
  "rounded-full border border-border bg-muted/30 px-3 py-1.5",
  "text-sm text-foreground hover:bg-muted text-left min-h-[36px]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
)}
```

---

### `src/components/site-header.tsx` (component)

**Analog:** `src/components/onboarding-modal.tsx` (client component mounted in RootLayout, reads browser state) + `src/app/layout.tsx` (mounting pattern)

**"use client" + env flag pattern:**
```typescript
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// D-04: NEXT_PUBLIC_TA_ENABLED gates the TA Analysis link
// This is a NEXT_PUBLIC_ var — safe to read in client components
const TA_ENABLED = process.env.NEXT_PUBLIC_TA_ENABLED === "true";

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      role="banner"
      className={cn("sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur", className)}
    >
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-foreground">
          Clarifin
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Upload Document
        </Link>
        {TA_ENABLED && (
          <Link href="/ta" className="text-sm text-muted-foreground hover:text-foreground">
            TA Analysis
          </Link>
        )}
      </nav>
    </header>
  );
}
```

**Layout mounting pattern** (layout.tsx lines 25-34):
```typescript
// In src/app/layout.tsx — add SiteHeader ABOVE {children}, same level as SessionProvider
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteHeader />                  {/* NEW — add above SessionProvider */}
        <SessionProvider>{children}</SessionProvider>
        <OnboardingModal />
      </body>
    </html>
  );
}
```

---

### `vercel.json` (config)

**Analog:** `vercel.json` (current — replace both entries)

**Before (current):**
```json
{
  "crons": [
    { "path": "/api/internal/parse-batch", "schedule": "0 0 * * *" },
    { "path": "/api/internal/embed-batch",  "schedule": "0 0 * * *" }
  ]
}
```

**After (T1 Wave 3 replacement):**
```json
{
  "crons": [
    { "path": "/api/internal/dispatch?job=daily",  "schedule": "0 11 * * *" },
    { "path": "/api/internal/dispatch?job=weekly", "schedule": "0 12 * * 0" }
  ]
}
```

**CRITICAL:** The `?secret=` auth param is NOT in the path here — secrets must not be in `vercel.json` (committed to git). The dispatcher reads `INTERNAL_PARSE_SECRET` from env at runtime and the `resolveCandidate()` function accepts the value via the `?secret=` query param that Vercel appends at cron-trigger time. (Note: Vercel does NOT append secrets automatically — the dispatcher must accept an unauthenticated cron call and validate via the `CRON_SECRET` Vercel env var, OR the secret must be embedded. Planner must clarify this edge case against RESEARCH.md A5.)

---

### `tests/ta/ohlcv-validation.test.ts` (test)

**Analog:** `src/lib/stock/fetch-stock-data.test.ts` — exact test structure

**Imports + vi.mock pattern** (fetch-stock-data.test.ts lines 1-28):
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock yahoo-finance2 BEFORE importing the module under test
vi.mock("yahoo-finance2", () => ({
  default: {
    historical: vi.fn(),  // swap quote/quoteSummary for historical
  },
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import yahooFinance from "yahoo-finance2";
import { fetchOHLCV } from "@/lib/ta/fetch-ohlcv";

const mockedHistorical = vi.mocked(yahooFinance.historical);

beforeEach(() => {
  mockedHistorical.mockReset();
});
```

**Test case pattern** (fetch-stock-data.test.ts lines 31-50):
```typescript
describe("fetchOHLCV (TA-INGEST-01)", () => {
  it("returns null when ticker is malformed", async () => {
    const res = await fetchOHLCV("invalid-ticker", new Date(), new Date());
    expect(res).toBeNull();
    expect(mockedHistorical).not.toHaveBeenCalled();
  });

  it("appends .JK suffix before calling yahoo-finance2", async () => {
    mockedHistorical.mockResolvedValueOnce([/* bars */] as never);
    await fetchOHLCV("BBCA", new Date(), new Date());
    expect(mockedHistorical).toHaveBeenCalledWith("BBCA.JK", expect.any(Object));
  });

  it("filters bars where high < low (TA-INGEST-01 validation rule)", async () => {
    mockedHistorical.mockResolvedValueOnce([
      { date: new Date("2024-01-01"), open: 100, high: 90, low: 100, close: 95, adjClose: 95, volume: 1000 },
    ] as never);
    const res = await fetchOHLCV("BBCA", new Date(), new Date());
    expect(res).toEqual([]);  // invalid bar filtered out
  });
});
```

---

### `tests/ta/indicators.fixture.test.ts` (test)

**Analog:** `src/lib/stock/fetch-stock-data.test.ts` (structure) — but content is a fixture-based deterministic assertion (no vi.mock needed for indicator computation)

**Pattern:**
```typescript
import { describe, expect, it } from "vitest";
import { computeIndicators } from "@/lib/ta/compute-indicators";

// 250-bar synthetic OHLCV series committed as a fixture
import ohlcvFixture from "./fixtures/ohlcv-250.json";
// Ground-truth values computed offline (e.g., from Python pandas-ta)
import groundTruth from "./fixtures/indicators-ground-truth.json";

describe("compute-indicators (TA-IND-01..04, REQUIRED for VERIFICATION.md)", () => {
  it("RSI(14) last value matches ground truth within 0.001 tolerance", () => {
    const result = computeIndicators(ohlcvFixture);
    const lastRsi = result.rsi.filter((v) => v !== null).at(-1) as number;
    expect(lastRsi).toBeCloseTo(groundTruth.rsi14Last, 3);
  });

  it("MACD(12,26,9) warmup alignment: first non-null index is bar 34", () => {
    const result = computeIndicators(ohlcvFixture);
    expect(result.macd[33]).toBeNull();  // bar index 33 = warmup period 34, 0-indexed
    expect(result.macd[34]).not.toBeNull();
  });

  it("BollingerBands(20) last upper/lower within 0.001 of ground truth", () => {
    // ...
  });
});
```

**Fixture format:** `tests/ta/fixtures/ohlcv-250.json` — 250 synthetic bars with fixed seed (deterministic). `tests/ta/fixtures/indicators-ground-truth.json` — pre-computed last values for RSI/MACD/BB/EMA.

---

## Shared Patterns

### server-only Boundary
**Source:** `src/lib/stock/fetch-stock-data.ts` line 1, `src/lib/rate-limit.ts` line 1, `src/db/client.ts` line 1
**Apply to:** `src/lib/ta/fetch-ohlcv.ts`, `src/lib/ta/upsert-ohlcv.ts`, all TA lib modules that touch yahoo-finance2 or supabaseAdmin
```typescript
import "server-only";  // FIRST LINE — causes build error if accidentally client-imported
```

### Internal Route Authentication
**Source:** `src/app/api/internal/parse-batch/route.ts` lines 24-56 (to be extracted to `src/lib/internal-auth.ts`)
**Apply to:** `src/app/api/internal/dispatch/route.ts`
```typescript
const candidate = resolveCandidate(request);  // Bearer header OR ?secret= query param
if (!timingSafeStringEq(candidate, env.INTERNAL_PARSE_SECRET)) {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}
```

### Zod Validation at Every Boundary
**Source:** `src/app/api/stock/[ticker]/route.ts` lines 7-8, `src/app/api/session/route.ts` lines 6-8
**Apply to:** All TA API routes (ticker path param, search query param, response payloads)
```typescript
const tickerSchema = z.string().regex(/^[A-Z]{1,5}$/);
const parsed = tickerSchema.safeParse(rawTicker);
if (!parsed.success) { return NextResponse.json({ error: "..." }, { status: 400 }); }
```

### Supabase Admin Client Pattern
**Source:** `src/db/client.ts` lines 1-22
**Apply to:** All TA server-side modules that write to Supabase
```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```
New TA modules import `supabaseAdmin` from `@/db/client` — do not create a second client.

### maxDuration + runtime Declarations
**Source:** `src/app/api/internal/parse-batch/route.ts` line 10; `src/app/api/cron/keep-alive/route.ts` lines 7-8
**Apply to:** `src/app/api/internal/dispatch/route.ts`, `src/app/api/ta/analysis/[ticker]/route.ts`
```typescript
export const maxDuration = 60;   // Vercel Hobby hard cap
export const runtime = "nodejs"; // REQUIRED for any route using supabaseAdmin or onnxruntime-node
```

### Return-null-on-failure Convention
**Source:** `src/lib/stock/fetch-stock-data.ts` lines 71-88 (jsdoc: "Returns null on ANY failure path")
**Apply to:** `src/lib/ta/fetch-ohlcv.ts`, `src/lib/ta/upsert-ohlcv.ts`
Never throw to caller from a fetch/upsert lib function. Return null (fetch) or void-with-log (upsert). Caller decides.

### "use client" + useEffect + Cleanup Pattern
**Source:** `src/components/doc/trend-chart-card.tsx` lines 1-2 + implied by chart usage (Recharts is declarative; lightweight-charts is imperative)
**Apply to:** `src/components/ta/candlestick-chart.tsx`, `src/components/ta/indicator-subpanel.tsx`
```typescript
"use client";
useEffect(() => {
  if (!ref.current) return;           // SSR guard
  const chart = createChart(ref.current, { ... });
  return () => chart.remove();        // cleanup on unmount
}, [data]);
```

### section + aria-label + cn() Component Structure
**Source:** `src/components/doc/stock-widget.tsx` lines 43-49, `src/components/doc/score-card.tsx` lines 20-27
**Apply to:** All new TA components (`candlestick-chart.tsx`, `indicator-subpanel.tsx`, etc.)
```typescript
<section
  aria-label="Technical Analysis — [description]"
  className={cn("flex flex-col gap-4 rounded-lg border border-border bg-background p-4", className)}
>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/ta/compute-indicators.ts` | utility | transform | No existing indicator computation in codebase; `technicalindicators` is a new library. Use RESEARCH.md Pattern 2 (warmup alignment) as primary guide. |

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/`, `src/components/`, `scripts/`, `supabase/migrations/`, `vercel.json`
**Files scanned:** ~35 source files read directly; file tree enumerated for ~130 files
**Pattern extraction date:** 2026-06-06
