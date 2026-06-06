# Phase 13 (T1): Data & Indicators — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Milestone:** v2.0 TA Module

<domain>
## Phase Boundary

A user can navigate to `/ta/{TICKER}` for any ticker in the seeded `ticker_metadata` list and see a working interactive candlestick chart with the 10 indicators rendered, populated from cached EOD OHLCV data, with the data pipeline refreshed nightly by a single consolidated dispatcher cron.

**In-scope (T1):** OHLCV ingest + cache, 10 indicators (RSI/MACD/Bollinger/EMA/SMA/ATR/Stochastic/OBV), ticker autocomplete + URL routing, candlestick chart with volume/RSI/MACD subpanels and 1M/3M/6M/1Y/2Y range selector, indicator-snapshot strip (plain-English one-liners), shared `<SiteHeader />` mounted in RootLayout, dispatcher cron consolidation (TA-INFRA-02, implicitly closes v1.0 R1), ONNX hello-world smoke (TA-INFRA-04).

**Out-of-scope (later phases):**
- Pattern detection + markers + Gemini streaming explanation + three-tier disclaimer framework → Phase 14 (T2)
- XGBoost probability widget + model-accuracy card + pattern outcome logging → Phase 15 (T3)
- TA follow-up chat + per-IP rate limiting on `/api/ta/*` + Langfuse instrumentation on TA Gemini calls + full 375px mobile polish + 30-prompt adversarial CHAT-06 red-team → Phase 16 (T4)

**Scope anchor:** This is a foundation phase. T2/T3/T4 all depend on T1 VERIFICATION.md on disk. The bilingual buy/sell sanitizer extraction (TA-INFRA-03) is explicitly NOT in T1 — that lives in T2.

</domain>

<decisions>
## Implementation Decisions

### Chart Library
- **D-01:** **lightweight-charts** (TradingView OSS, Apache-2.0, ~250KB) is the chart library for the entire TA module. Reasons: native candlestick rendering (no custom Shape work), native `setMarkers()` API unblocks T2 pattern markers without custom overlay code, TradingView aesthetic that IDX retail investors already recognize from Stockbit/RTI. Bundle cost is route-scoped on `/ta/*` pages, not global. Recharts (reuse) was rejected because Recharts ComposedChart for OHLC requires custom Shape (Bar+Bar+Line) and T2 markers would need a custom overlay layer. ECharts was research-rejected pre-discuss.
  - Implication for planner: indicator subpanels (volume / RSI / MACD) are separate chart instances with synced time axes (lightweight-charts has no built-in subpanel system) — coordinate via `subscribeVisibleTimeRangeChange`.
  - Implication for T2: pattern markers (▲ bullish, ▼ bearish, ◆ continuation/neutral per ROADMAP success criterion #1) use native `setMarkers()` per-series API.

### Ticker Coverage
- **D-02:** **`ticker_metadata` seed source = market-cap top-100 from yahoo-finance2**, populated by a one-shot script run at T1 Wave 0. The script output is committed to repo as JSON (deterministic deploys; list changes are git-diff-visible). Not handpicked — user accepts data-driven over manual maintenance.
- **D-03:** **Minimum-history filter: ≥2yr** at seed time. Drops any top-100 ticker whose `firstTradeDate` is <2yr old. Expected final autocomplete list = 85–100 tickers. Avoids shipping autocomplete entries that immediately hit the sparse-data state (<30 candles).
  - Implication for planner: combine the seed-tickers and 5yr-backfill steps into a single script `scripts/ta/seed-and-backfill.ts` (see D-06). The same yahoo query that ranks by market cap also returns `firstTradeDate` — filter inline.
  - Smoke-test tickers BBCA / TLKM / GOTO from ROADMAP success criteria are all in LQ45 and will always be in the seed regardless of yahoo's exact ranking that day.

### Rollout Posture
- **D-04:** **`/ta` discoverability:** Header link in `<SiteHeader />` is **gated on `NEXT_PUBLIC_TA_ENABLED` env flag**. Flag stays `false` in production until Wave 3 E2E smoke passes and `13-VERIFICATION.md` is committed. Route works in preview deploys for internal testing throughout T1 development.
  - Implication for planner: `<SiteHeader />` mounted in RootLayout at Wave 2 must read the flag and conditionally render the TA Analysis link. Hardcode `NEXT_PUBLIC_TA_ENABLED=true` for preview deploys via Vercel env config; flip prod after VERIFICATION.md lands.
- **D-05:** **Mobile baseline at T1:** On viewports <640px, render a clean info card: *"TA Analysis is best on desktop — we're polishing the mobile experience. Try the v1.0 fundamentals reader on mobile instead [link]."* No half-finished chart UI on phones during the T1→T4 window. Phase 16 (T4) replaces this entirely with the full 375px overflow-free polish.
  - Implication for planner: gate the entire `/ta/{ticker}` chart surface on a `useMediaQuery('(min-width: 640px)')` guard or a Server-Component user-agent check. Don't waste effort on partial responsive work that T4 will replace.

### OHLCV History Scope
- **D-06:** **5yr backfill ships in T1 Wave 0/1.** The seed script (D-02) is extended to also pull 5yr OHLCV per ticker in the same script: `scripts/ta/seed-and-backfill.ts`. Result: 5yr × ~100 tickers in `ohlcv_cache` when T1 ships. Daily dispatcher cron from Wave 3 then just appends new trading days.
  - Why this matters: preserves the ROADMAP's T2 ‖ T3 parallelization design. T3 (Phase 15) Waves 0–1 can run in parallel with T2 because the training data is already in `ohlcv_cache` when T3 starts. Deferring the backfill to "Phase 15 prep" would kill that parallelization and add 1–2 weeks to the v2.0 critical path.
  - Yahoo gap handling: ~100 tickers × 1 ranged query × ~1s = ~2 min runtime; ~126K rows well within Supabase 500MB free tier. Defensive "best-available" handling for tickers with mid-period gaps — log and continue, don't fail the script.

### Claude's Discretion
The following are NOT user-decisions and downstream agents (researcher + planner) own them:
- Exact lightweight-charts subpanel sync wiring (visible-range subscription pattern).
- Indicator-snapshot strip copy wording (must be plain-English direction-only per ROADMAP success criterion #2 — "MACD: Bullish crossover yesterday" form; severity adjectives like "strong/weak" are NOT required, planner picks final tone).
- Dispatcher cron migration sequencing (TA-INFRA-02) — same-deploy hard cutover vs old-routes fallback. Planner picks based on risk appetite + Vercel preview verification, documents choice in PLAN.md.
- ONNX hello-world smoke (TA-INFRA-04) measurement protocol — number of cold curls, time-of-day, threshold operationalization for "consistently >5s". Planner specifies in PLAN.md.
- Wave 1 detector-vs-route parallelization (indicator computation vs API route handlers). ARCHITECTURE.md §7.2 already prescribes wave structure.
- Schema column types + constraints for `ohlcv_cache` and `ticker_metadata` (planner reads ARCHITECTURE.md §3 for the prescribed schema).
- `src/lib/internal-auth.ts` extraction details (currently triplicated in parse-batch / embed-batch / analyze-batch routes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner, gsd-executor) MUST read these before planning or implementing.**

### Phase 13 design seed + research synthesis (read first)
- `.planning/seeds/ta-module-standalone.md` — Original TA surface design; design-context anchor for this phase per ROADMAP.
- `.planning/research/SUMMARY.md` — Synthesis of STACK + FEATURES + ARCHITECTURE + PITFALLS; §5 (build order T1→T4), §8 (open questions), §9 (roadmapper pre-commits) are most relevant.
- `.planning/research/STACK.md` — Stack additions (`technicalindicators`, `onnxruntime-node`); verification checklist for pinning versions; rejection rationale for tulind / onnxruntime-web / TradingView Lightweight (note: research rejected the premium *embed* — we are using the OSS lightweight-charts library, which is the Apache-2.0 OSS package referenced as a candidate in FEATURES).
- `.planning/research/FEATURES.md` — TS-CHART-01..08, TS-IND-01..07 feature shortlists with complexity (S/M/C); audience UX notes; anti-features list.
- `.planning/research/ARCHITECTURE.md` — **§3 schema split (5 TA-prefixed tables, no v1.0 schema changes), §5 cron dispatcher pattern, §7.2 wave order for T1**. Most-load-bearing doc for the planner.
- `.planning/research/PITFALLS.md` — **D3 (OHLCV data quality) and C2 (technicalindicators library bugs) are T1-OWNED**; D1 / C1 / A1 are owned by later phases but referenced.
- `.planning/research/questions.md` — Q1 / Q2 block Phase 15; Q3 blocks Phase 16. **Not blocking for T1**, but T1's TA-INFRA-04 ONNX smoke produces input for the Q1/Q2 decision later.

### Spec + requirements
- `.planning/REQUIREMENTS.md` — Authoritative REQ-IDs for Phase 13: TA-INGEST-01, TA-DATA-01, TA-TICKER-01/02, TA-CHART-01..08, TA-IND-01..07, TA-INFRA-02, TA-INFRA-04, TA-UX-01.
- `.planning/ROADMAP.md` §"Phase 13 (T1): Data & Indicators" — Goal, depends-on, requirements list, waves, 6 success criteria.
- `.planning/PROJECT.md` — Project vision, audience persona, v2.0 milestone context, key decisions (incl. v1.0 force-close + deferred R1–R4 blockers).
- `CLAUDE.md` — Stack constraints, free-tier budget, audience English level.

### v1.0 reuse context (patterns to transplant)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — What v1.0 shipped vs known gaps; R1 details for the TA-INFRA-02 implicit-close.
- `.planning/milestones/v1.0-phases/09-stock-data-trend-chart/09-RESEARCH.md` — yahoo-finance2 wrapper + 24h Supabase cache pattern; the same pattern extends to `ohlcv_cache`.
- `.planning/milestones/v1.0-phases/11-observability-reliability/11-CONTEXT.md` — Langfuse singleton + Pattern A/B `flushAsync` placement (relevant when T1 instruments yahoo-finance2 fetcher; T2/T4 will own the full LLM-call instrumentation).
- `src/lib/langfuse.ts` — Singleton implementation to reuse as-is.
- `src/lib/stock/fetch-stock-data.ts` — yahoo-finance2 wrapper + Supabase cache + exponential-backoff pattern. T1's `fetch-ohlcv.ts` mirrors this shape.
- `src/app/api/internal/parse-batch/route.ts` — **Auth pattern (`INTERNAL_PARSE_SECRET` + `timingSafeStringEq`)**, and lines 13–22 comment block documenting why dispatcher must use direct-function-imports (Vercel 508 INFINITE_LOOP_DETECTED). T1 Wave 0 extracts the auth helper to `src/lib/internal-auth.ts`.
- `vercel.json` — Current cron config (`parse-batch` + `embed-batch`) — to be REPLACED with dispatcher daily + weekly pair in T1 Wave 3.
- `package.json` — Inventory of v1.0 deps already installed (Next.js 15.5, Recharts 3.8, yahoo-finance2 3.14, Langfuse 3.38, `@google/genai`, `@supabase/*`, `server-only`).

### New deps to install (T1 Wave 0)
- `technicalindicators` (~3.1.0 — verify with `npm view technicalindicators version` before pinning; STACK.md verification checklist).
- `lightweight-charts` (TradingView OSS, Apache-2.0; verify license + version before pinning).
- (Deferred to T3 Wave 0/1: `onnxruntime-node` install + offline Python training stack — out of T1 scope, but T1 Wave 3 deploys a hello-world `.onnx` to measure cold INIT_DURATION per TA-INFRA-04.)

### Cross-phase contracts (downstream phases will consume these)
- `ohlcv_cache` schema + indices — T2 reads for pattern detection; T3 reads for training-data export.
- `ticker_metadata` schema — T2 (sidebar list display) + T4 (suggested-prompts) read it.
- `src/lib/internal-auth.ts` (extracted in T1 Wave 0) — T2 (TA prewarm) + T4 (TA chat rate-limit middleware) import the same auth helpers.
- Indicator output shape from `compute-indicators.ts` — T2 (pattern gates needing volume avg + ATR) + T3 (XGBoost feature encoder) consume it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (transplant directly)
- **`src/lib/langfuse.ts` (singleton + Pattern A/B helpers)** — T1 needs no LLM instrumentation (no Gemini calls in T1), but `runTaRefreshOhlcv` may want a Pattern A trace span on the yahoo-finance2 fetch loop for cron observability. Optional; planner decides.
- **`src/lib/stock/fetch-stock-data.ts`** — yahoo-finance2 v3.14 wrapper with 24h Supabase cache + exponential-backoff + `server-only` boundary. T1's `fetch-ohlcv.ts` follows the same shape: server-only, batched yahoo calls, Supabase upsert into `ohlcv_cache`, retry-on-429/5xx.
- **`src/app/api/internal/parse-batch/route.ts`** — Auth pattern (Bearer + `timingSafeStringEq`); the dispatcher cron `/api/internal/dispatch` reuses this auth surface.
- **`src/lib/guardrail.ts`** — Buy/sell hard-block source. **Not used in T1** — extraction to `src/lib/safety/buy-sell-filter.ts` is a T2 (TA-INFRA-03) deliverable. T1 leaves it in place untouched.
- **shadcn/ui + Tailwind v4** — already installed; `/ta/{ticker}/page.tsx` and components reuse the v1.0 design system (Card, Button, Skeleton, Tooltip, etc.).

### Established Patterns (constrain T1 implementation)
- **`server-only` boundary** — yahoo-finance2 and any future onnxruntime-node import MUST be behind `import 'server-only'` to prevent client-bundle inclusion. lightweight-charts is a client-side lib and is allowed in `'use client'` components.
- **Zod validation at every boundary** — v1.0 pattern (`/api/stock/[ticker]`); apply to `/api/ta/analysis/[ticker]` and `/api/ta/search` route params + responses.
- **Server-Component-by-default** — `/ta/[ticker]/page.tsx` is an RSC that fetches cached analysis from Supabase + passes to a Client Component chart wrapper. Same pattern as v1.0 `/doc/[documentId]/page.tsx`.
- **Migration-driven schema** — Supabase migrations in `supabase/migrations/`; T1 adds migrations for `ohlcv_cache` and `ticker_metadata` (schema per ARCHITECTURE.md §3).
- **Direct-function-import for cron jobs** — `/api/internal/dispatch?job=...` invokes job handlers as imported functions, NOT via `fetch()` self-call (avoids Vercel 508 INFINITE_LOOP_DETECTED). Job signature: `async (opts: { deadline: Date }) => void`.

### Integration Points (where new code connects)
- **RootLayout** — `<SiteHeader />` mounts here in T1 Wave 2. Reads `NEXT_PUBLIC_TA_ENABLED` for conditional TA link rendering (D-04).
- **`vercel.json`** — REPLACES the existing 2 cron entries (`parse-batch`, `embed-batch`) with the dispatcher pair: `/api/internal/dispatch?job=daily` at 11:00 UTC + `/api/internal/dispatch?job=weekly` for keep-alive. Exactly 2 crons at end of T1 (Hobby budget preserved).
- **`src/lib/internal-auth.ts` (NEW)** — Extracted in Wave 0; imported by existing parse-batch / embed-batch / analyze-batch routes + new dispatcher + future TA prewarm route. Triplicated `timingSafeStringEq` + `extractBearer` consolidate here.
- **Supabase RPC `match_document_chunks`** — TA pipeline does NOT call this. v1.0 documents/chunks schema stays untouched. RLS keeps it service_role-only.
- **`/api/internal/dispatch`** — Single new internal route owning all background work going forward. v1.0 `/api/internal/parse-batch` and `/api/internal/embed-batch` either stay as direct-function-imports (no longer cron-targeted) or get refactored into job handlers under `src/lib/jobs/`. Planner picks based on D-04-style risk preference.

### Creative Options Existing Architecture Enables
- Indicator-snapshot strip plain-English copy can be computed server-side at cache-write time (in `runTaRefreshOhlcv`) and stored as a column in `ohlcv_cache` (or a sibling cache table) — avoids client-side computation + matches v1.0's "expensive compute lives in cache" pattern.
- The Wave 0 `seed-and-backfill.ts` script can write to BOTH JSON-on-disk (committed) AND Supabase (via migration data-seed) — git-diff-visible list changes + idempotent DB seeding.

</code_context>

<specifics>
## Specific Ideas

- **TradingView aesthetic explicitly desired** for the candlestick chart (lightweight-charts choice was anchored to this — IDX retail investors recognize it from Stockbit/RTI embeds).
- **No half-finished UI in production** — mobile gets a clean "Best on desktop" card during T1→T4 rather than a broken responsive layout. Same ethos drives `NEXT_PUBLIC_TA_ENABLED` flag: don't expose users to incomplete TA until VERIFICATION.md is on disk.
- **Data-driven over hand-curated** — user explicitly preferred yahoo-finance2 market-cap top-100 query over a handpicked list, accepting that the seed script becomes a maintained build artifact.
- **Preserve T2 ‖ T3 parallelization** — backfill in T1 was the deliberate call to avoid serializing v2.0's critical path.

</specifics>

<deferred>
## Deferred Ideas

### Deferred to planner discretion (planner picks + documents in PLAN.md)
- **Cron migration sequencing (TA-INFRA-02):** same-deploy hard cutover vs old-routes-as-fallback for one deploy cycle vs dual-write. Planner picks based on Vercel preview verification confidence + Hobby 2-cron limit constraint.
- **ONNX hello-world smoke protocol (TA-INFRA-04):** number of cold curls, time-of-day, exact threshold for "consistently >5s INIT_DURATION". Must be specified in PLAN.md so VERIFICATION.md records the measurement.
- **Indicator-snapshot strip language tone:** direction-only ("MACD: Bullish crossover yesterday") is locked by ROADMAP success criterion #2; whether to add severity adjectives ("strong / weak") is planner's call.

### Out-of-scope for Phase 13 (belongs in later phases)
- Pattern detection + markers + Gemini streaming explanation + three-tier disclaimer framework + bilingual buy/sell sanitizer extraction → **Phase 14 (T2)**.
- XGBoost training + ONNX inference + probability widget + model-accuracy card + `pattern_outcome_log` table → **Phase 15 (T3)**. (T1 Wave 3 only deploys a hello-world dummy `.onnx` for cold-start measurement.)
- TA follow-up RAG chat + per-IP rate limiting on `/api/ta/*` + Langfuse instrumentation on TA Gemini calls + full 375px mobile polish + 30-prompt adversarial CHAT-06 red-team → **Phase 16 (T4)**.

### Not folded — pre-existing backlog
- v1.0 launch blockers R2 (analyze-batch cron), R3 (keep-alive cron), R4 (session-ownership TODO) remain in Backlog 999.6 and are NOT pulled into Phase 13. R1 closes implicitly as a TA-INFRA-02 side-effect.
- Phase 4 / 6 / 7 / 8 / 9 / 10 / 12 VERIFICATION.md paperwork debt stays deferred.

### Reviewed Todos
No matching todos surfaced (todo list is empty per `gsd-tools list-todos`).

</deferred>

---

*Phase: 13-t1-data-and-indicators*
*Milestone: v2.0 TA Module*
*Context gathered: 2026-06-06*
