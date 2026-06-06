# Roadmap: Clarifin

## Milestones

- ✅ **v1.0 MVP** — Phases 1–12 (shipped 2026-06-06) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 TA Module** — Phases 13–16 (T1–T4) — opened 2026-06-06

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–12) — SHIPPED 2026-06-06</summary>

- [x] Phase 1: Project Setup & Foundation (6/6 plans) — completed 2026-05-06
- [x] Phase 2: PDF Upload & Storage (6/6 plans) — completed 2026-05-06
- [x] Phase 3: PDF Parsing & Chunking (6/6 plans) — completed 2026-05-08
- [x] Phase 4: Embeddings & Vector Store (5/5 plans) — completed 2026-05-08
- [x] Phase 5: Indonesian Eval Harness (2/2 plans) — completed 2026-05-17
- [x] Phase 6: AI Explanation Generation (5/5 plans) — completed 2026-05-18
- [x] Phase 7: Citation UI & PDF Viewer (3/3 plans) — completed 2026-05-19
- [x] Phase 8: AI Score & Drill-Down (4/4 plans) — shipped with HUMAN-UAT outstanding
- [x] Phase 9: Stock Data & Trend Chart (4/4 plans) — shipped without VERIFICATION.md
- [x] Phase 10: Chat Interface (5/5 plans) — shipped without VERIFICATION.md
- [x] Phase 11: Observability & Reliability (4/4 plans) — completed 2026-05-24
- [x] Phase 12: Polish & Public Launch (4/4 plans) — shipped without VERIFICATION.md

**Closed with known gaps.** See [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) and Backlog 999.1–999.6 below.

</details>

### 🚧 v2.0 TA Module (Phases 13–16) — opened 2026-06-06

- [ ] **Phase 13 (T1): Data & Indicators** — OHLCV ingest, 10 indicators, ticker autocomplete, basic candlestick chart at `/ta/{ticker}`, cron dispatcher consolidation (implicitly closes v1.0 R1 as side-effect)
- [ ] **Phase 14 (T2): Patterns & Explanation** — 12 candlestick patterns + 5 chart patterns with liquidity/volume/ATR/multi-bar gates, pattern markers, streaming Gemini explanation, three-tier disclaimer framework, bilingual buy/sell sanitizer extraction
- [ ] **Phase 15 (T3): ML Probability Layer** — XGBoost trained offline on 5yr+ IDX OHLCV, ONNX inference in Node.js, calibrated probability widget (ECE-gated), pattern outcome logging, model-accuracy card
- [ ] **Phase 16 (T4): Polish** — TA follow-up RAG chat, mobile layout, per-IP rate limiting on `/api/ta/*`, Langfuse instrumentation on TA Gemini calls, 30-prompt adversarial CHAT-06 red-team

---

## Roadmap Overview — v2.0

**Goal:** Add a standalone Technical Analysis surface at `/ta/{ticker}` that detects chart patterns, computes indicators, generates probabilistic outlooks (no buy/sell calls), and explains everything in plain English — expanding Clarifin into a fundamentals + technicals product.

**Audience:** Same as v1.0 — English-fluent Indonesian professional, non-finance-trained, opens IDX charts but doesn't know what they're seeing. Investors, not day-traders.

**Granularity:** Standard (4 phases; matches seed T1–T4 design; honors VERIFICATION gate between each).

**Coverage:** 62/62 v2.0 requirements mapped.

### Process-level gates (apply across all v2.0 phases, not a phase requirement)

- **TA-INFRA-06 (VERIFICATION gating):** No T(n+1) may enter `/gsd-plan-phase` until T(n) has VERIFICATION.md on disk. This applies to all transitions: 13→14, 14→15 (note: T3 Waves 0–1 may run in PARALLEL with T2 Waves 0–2, but T3 planning still requires T1 VERIFICATION.md as the foundation gate), 15→16.

### Research questions blocking v2.0 phases

- **Q1 (IDX training-data sufficiency)** and **Q2 (XGBoost calibration method)** in `.planning/research/questions.md` MUST be resolved before Phase 15 (T3) can ship. They are surfaced in Phase 15 success criteria.
- **Q3 (Gemini quota under combined v1.0 + TA load)** MUST be resolved before Phase 16 (T4) planning begins. Resolution is measured via TA-INFRA-08 (read Phase 11 Langfuse traces for 7+ days of P95 RPD data). Surfaced in Phase 16 success criteria.

### v1.0 launch-blocker treatment

R1–R4 from v1.0 audit remain in Backlog 999.6 and are **not** pulled into v2.0 scope. However, **TA-INFRA-02 (cron dispatcher consolidation) at Phase 13 Wave 3 implicitly fixes R1** — the new dispatcher cron uses a single agreed auth method, so the `vercel.json` ↔ handler auth mismatch goes away as a side-effect. R2, R3, R4 remain outstanding.

### Parallelization Opportunities

| Window | Parallel Tracks | Shared State | Handoff |
|---|---|---|---|
| **T2 Waves 0–2 ‖ T3 Waves 0–1** | (A) T2: pattern detectors + Gemini streaming explanation + disclaimer framework. (B) T3 offline: Python training pipeline, feature engineering from `ohlcv_cache` export, XGBoost + Platt calibration, ONNX export, `model-version.json`. | Both tracks read `ohlcv_cache` and indicator outputs produced in Phase 13. Otherwise touch disjoint code (T2 = `src/lib/ta/patterns/*` + `src/app/api/ta/analysis/*` + UI; T3 offline = `scripts/ta/training/*` Python + `model/*.onnx` artifact). | `ta_analysis_cache.probabilities` JSONB field. T2 Wave 2 writes a **placeholder shape** (`{ bullish: null, neutral: null, bearish: null, source: "placeholder" }`). T3 Wave 2 (which runs AFTER T2 ships) replaces the placeholder with real ONNX output and adds `model_version` + `ece` fields. UI consumes the same shape throughout; null values trigger TA-INFRA-05 historical-stats fallback. |

Authority: research/ARCHITECTURE.md §7.2 and research/SUMMARY.md §5.

### Phase dependencies (sequencing)

```
Phase 13 (T1) ─┬─→ Phase 14 (T2) ──┐
               │                    ├─→ Phase 16 (T4)
               └─→ Phase 15 (T3) ───┘
                   (Waves 0–1 in parallel with T2;
                    Wave 2 sequenced after T2 ships)
```

---

## Phase Details — v2.0

### Phase 13 (T1): Data & Indicators

**Goal:** A user can navigate to `/ta/{TICKER}` for any top-100 IDX ticker and see a working interactive candlestick chart with 10 indicators rendered, populated from cached EOD OHLCV data, with the data pipeline refreshed nightly by a single consolidated dispatcher cron.

**Design seed:** `seeds/ta-module-standalone.md` describes the original TA surface design and is the design-context anchor for this phase. REQUIREMENTS.md is the authoritative spec.

**Depends on:** Nothing within v2.0 (foundation phase). Reuses v1.0 primitives: Next.js 15 App Router, Supabase Postgres, yahoo-finance2, Recharts, `server-only` boundary, Phase 12 INFRA-02 rate limiter (extended at T4), Phase 11 Langfuse singleton (extended at T4).

**Implicit v1.0 fix:** TA-INFRA-02's dispatcher consolidation replaces the existing v1.0 `parse-batch` + `embed-batch` crons with a single dispatcher. As a side-effect, this closes v1.0 launch blocker **R1** (vercel.json cron auth method mismatch) because the new dispatcher uses one agreed auth path. R2/R3/R4 remain in Backlog 999.6.

**Requirements** (15): TA-INGEST-01, TA-DATA-01, TA-TICKER-01, TA-TICKER-02, TA-CHART-01, TA-CHART-02, TA-CHART-03, TA-CHART-04, TA-CHART-05, TA-CHART-06, TA-CHART-07, TA-CHART-08, TA-IND-01, TA-IND-02, TA-IND-03, TA-IND-04, TA-IND-05, TA-IND-06, TA-IND-07, TA-INFRA-02, TA-INFRA-04, TA-UX-01

**Waves** (per research/ARCHITECTURE.md §7.2):
- Wave 0: dependency install, DB migration for `ohlcv_cache` + `ticker_metadata`, extract `src/lib/internal-auth.ts`, populate `ticker_metadata` seed JSON.
- Wave 1 (parallel): `fetch-ohlcv.ts`, `upsert-ohlcv.ts`, `compute-indicators.ts`.
- Wave 2 (parallel): `/api/ta/analysis/[ticker]`, `/api/ta/search`, `/ta/[ticker]/page.tsx`, `candlestick-chart.tsx`, `indicator-subpanel.tsx`, shared `<SiteHeader />` mounted in RootLayout.
- Wave 3: dispatcher cron (`/api/internal/dispatch`), wire `runTaRefreshOhlcv`, REPLACE existing 2 v1.0 crons with daily + weekly dispatcher pair, deploy ONNX hello-world smoke (TA-INFRA-04) on Vercel preview to measure cold INIT_DURATION before T3 commits to architecture.

**Success Criteria** (what must be TRUE — observable):
1. Navigating to `/ta/BBCA` (and `/ta/TLKM`, `/ta/GOTO`) renders an interactive candlestick chart with volume subpanel, RSI(14) subpanel with 30/70 lines, MACD(12,26,9) subpanel with histogram, and the 1M/3M/6M/1Y/2Y range selector all functional within the page.
2. The header indicator-snapshot strip displays plain-English one-line summaries of the latest values (e.g., "MACD: Bullish crossover yesterday") — never raw numbers like "1.23 / 0.98 / 0.25".
3. Searching "Bank Central" or "BBCA" in the autocomplete input returns ranked results from `ticker_metadata`; selecting one routes to `/ta/BBCA` (uppercase, no `.JK`); visiting `/ta/bbca` 301s to `/ta/BBCA`.
4. Visiting a ticker with <30 candles of history shows the explicit sparse-data state ("Insufficient price history…") with no chart and no indicator panels — no NaN values rendered, no silent failures; invalid tickers show a friendly error, in-flight fetches show a skeleton.
5. Exactly 2 Vercel cron jobs exist on Hobby (dispatcher daily + dispatcher weekly), and the dispatcher invokes job handlers via direct function imports (no HTTP self-fetch); a manual `curl` to the cron auth path returns 200 with the correct secret and 401 without (R1 implicitly closed).
6. ONNX hello-world preview-deploy smoke (TA-INFRA-04) has been executed and the measured cold INIT_DURATION is recorded in VERIFICATION.md; if measured >5s consistently, T3 architecture is flagged for revisit before Phase 15 begins.

**Plans** (7 plans, 4 waves):
- [x] 13-01-PLAN.md — Wave 0: install deps + ohlcv_cache/ticker_metadata migration + internal-auth.ts extraction + red test stubs + [BLOCKING] db push
- [x] 13-02-PLAN.md — Wave 1: seed-and-backfill.ts (market-cap top-100, >=2yr filter, 5yr OHLCV backfill)
- [x] 13-03-PLAN.md — Wave 1 (TDD): fetch-ohlcv + upsert-ohlcv + compute-indicators (10 indicators, warmup-aligned)
- [x] 13-04-PLAN.md — Wave 2: /api/ta/analysis + /api/ta/search + snapshot copy + AnalysisPayload contract
- [x] 13-05-PLAN.md — Wave 2: lightweight-charts candlestick + synced subpanels + range/overlay controls + snapshot strip
- [ ] 13-06-PLAN.md — Wave 2: SiteHeader (RootLayout) + ticker-search + skeleton/error/sparse/mobile state cards
- [ ] 13-07-PLAN.md — Wave 3: /ta page wiring + dispatcher cron + vercel.json cutover + ONNX smoke (TA-INFRA-04)
**UI hint**: yes

---

### Phase 14 (T2): Patterns & Explanation

**Goal:** A user viewing `/ta/{TICKER}` sees pattern markers on the chart for detected candlestick and chart patterns, a sidebar listing the detected patterns with historical stats and plain-English explanation cards, a streaming 3-paragraph Gemini-generated narrative explanation, and a full three-tier disclaimer framework — with all directional ("buy/sell/akumulasi/jual") language stripped by a shared bilingual sanitizer.

**Depends on:** Phase 13 VERIFICATION.md on disk (TA-INFRA-06 gate). Consumes `ohlcv_cache` and indicator outputs from T1.

**Requirements** (18): TA-CHART-09, TA-CHART-10, TA-PAT-01, TA-PAT-02, TA-PAT-03, TA-PAT-04, TA-PAT-05, TA-PAT-06, TA-PAT-07, TA-EXP-01, TA-EXP-02, TA-EXP-03, TA-EXP-04, TA-EXP-05, TA-DISCLAIM-01, TA-DISCLAIM-02, TA-DISCLAIM-03, TA-DISCLAIM-04, TA-OBS-01, TA-OBS-02, TA-INFRA-03, TA-INFRA-07 (T2 half)

**Waves** (per research/ARCHITECTURE.md §7.2):
- Wave 0: migration for `ta_analysis_cache`; `src/lib/ta/prompts.ts`; three-tier disclaimer banner; **TA-INFRA-03 extract CHAT-06 to `src/lib/safety/buy-sell-filter.ts`** and extend bilingual (EN + ID forbidden phrases per REQUIREMENTS.md TA-EXP-05). Both `/api/chat` (v1.0) and the new TA paths import the shared module.
- Wave 1 (parallel): 12 candlestick detectors (Doji, Hammer, Shooting Star, Engulfing, Harami, Morning/Evening Star, etc.) + 5 chart-pattern detectors (double top/bottom, H&S, support/resistance, flags) — all gated by TA-PAT-02 rules (volume confirmation ≥1.2× 20d avg for reversals, ATR-relative geometry, multi-bar confirmation, `volume×close ≥ Rp 500M` liquidity floor).
- Wave 2: pattern marker overlay component (TA-CHART-09/10), Gemini streaming explanation with Pattern B Langfuse instrumentation (open before `streamText`, close in `onFinish`, `flushAsync` in `finally`), extend `/api/ta/analysis/[ticker]` to invoke detection + LLM + cache write.
- Wave 3: wire `runTaPrewarmAnalysis` + `runTaEvictCache` to dispatcher; verify patterns + explanation for BBCA/TLKM/GOTO with sanitization passing; **TA-INFRA-07 HUMAN-UAT** with ≥2 non-developer Jakarta-based users within 7 days of phase code completion.

**Success Criteria** (what must be TRUE — observable):
1. Loading `/ta/BBCA` (and `/ta/TLKM`, `/ta/GOTO`) renders pattern markers (▲ bullish reversal, ▼ bearish reversal, ◆ continuation/neutral) overlaid on the candlestick chart at the correct candle ranges, and clicking any marker opens the corresponding plain-English explanation card with EN name, Bahasa Indonesia name, one-sentence definition, taxonomy badge, and historical-stats row (IDX occurrences, bullish-resolution rate, avg magnitude, avg days).
2. The first paragraph of the Gemini 3-paragraph (chart / context / risks) explanation streams to the screen within 3 seconds of cache miss; when patterns conflict with indicators, a "conflicting-signals" callout is rendered inline.
3. The shared bilingual sanitizer (TA-INFRA-03 / TA-EXP-05) strips both English (`buy`/`sell`/`invest`/`recommend`/`will rise`/etc.) and Indonesian (`beli`/`jual`/`akumulasi`/`target harga`/`rekomendasi`/`hold`) directional language from streamed LLM output; every replacement event is logged to Langfuse as a span with the pre-replacement text (TA-OBS-02), and both `/api/chat` (v1.0) and `/api/ta/analysis/[ticker]` import the same shared module.
4. The three-tier disclaimer framework is visible on every `/ta/{ticker}` page: a non-dismissible header banner ("Educational analysis only — not investment advice"), a per-output disclaimer attached within 100px of every AI block at 1080p, and an always-visible full legal disclaimer below-fold (not behind an accordion); first-time TA visitors see a 3-bullet onboarding modal that blocks interaction until acknowledged.
5. Verified low-liquidity sentinel test: ≤10 false-positive pattern markers per year on 5 curated low-liquidity IDX tickers (PITFALLS.md D1 acceptance) — confirms volume/ATR/multi-bar/liquidity gates hold.
6. TA-INFRA-07 HUMAN-UAT signed off by ≥2 non-developer Jakarta-based users within 7 days of phase code completion (UATs cover: chart legibility, pattern marker click-through, explanation readability, disclaimer prominence). Failure to complete within 7 days rolls Phase 14 back to "not closed."

**Plans**: TBD
**UI hint**: yes

---

### Phase 15 (T3): ML Probability Layer

**Goal:** A user viewing `/ta/{TICKER}` sees a calibrated three-bar probability widget (bullish / neutral / bearish summing to 100%) for the 10-day forward outlook — driven by an XGBoost classifier trained offline on 5yr+ IDX OHLCV and served via `onnxruntime-node` in the Vercel Node runtime — with a prominent model-accuracy card, random-baseline references, sample-size note, and confidence tier that auto-downgrades when calibration drifts. If model accuracy <45% on held-out 2024 data, the widget falls back to a "historical stats only" card with no ONNX output.

**Depends on:** Phase 13 VERIFICATION.md on disk; Phase 14 ships its `ta_analysis_cache.probabilities` placeholder shape (T3 Waves 0–1 may run in PARALLEL with T2 Waves 0–2; T3 Wave 2 sequences after T2 ships).

**Blocking research questions** (MUST be resolved before this phase ships):
- **Q1** — IDX training data sufficiency (5yr × top 100 × 12 patterns; N>1000 per cell; class balance; cycle diversity). Determines whether the ONNX path is viable at all vs. immediate fallback to TA-INFRA-05 historical-stats card.
- **Q2** — XGBoost calibration method (Platt vs. isotonic vs. multinomial vs. temperature scaling; ECE target on held-out IDX 2024). Determines whether widget probabilities mean what they say.

**Requirements** (8): TA-PROB-01, TA-PROB-02, TA-PROB-03, TA-PROB-04, TA-PROB-05, TA-PROB-06, TA-PROB-07, TA-INFRA-05

**Waves** (per research/ARCHITECTURE.md §7.2):
- **Wave 0 (parallel with T2):** Python training pipeline; feature engineering from `ohlcv_cache` export; label generation (10-day forward returns at ±3% thresholds); walk-forward CV to prevent leakage (PITFALLS.md D5); 2015–2024 corpus for cycle diversity (D6).
- **Wave 1 (parallel with T2):** XGBoost training + Platt (or Q2-determined) calibration; ONNX export with documented opset; `model-version.json` with SHA256 hash; held-out 2024 accuracy + per-class ECE measurement.
- **Wave 2 (after T2 ships, sequential):** `onnxruntime-node` lazy-loaded singleton at `src/lib/ta/model/`; feature encoder; `pattern_outcome_log` table + `runTaBackfillOutcomes` job wired to dispatcher; probability widget + accuracy card UI; replace `ta_analysis_cache.probabilities` placeholder with real ONNX output + `model_version` + `ece` fields.

**Success Criteria** (what must be TRUE — observable):
1. Q1 (training data sufficiency) and Q2 (calibration method + ECE target) in `research/questions.md` are documented as RESOLVED (with concrete findings written into the file) before Phase 15 enters verification; the chosen calibration method is referenced in `model-version.json`.
2. The three-bar probability widget on `/ta/BBCA` renders bullish / neutral / bearish percentages summing to 100%, each bar showing a 33% random-baseline reference marker, with explicit "10-day forward outlook" horizon label and "Based on N similar historical contexts on IDX (date range)" sample-size note visible — and a widget-attached "historical frequencies, not predictions" disclaimer.
3. A prominently-placed (not tooltip-hidden) model-accuracy card displays "Right N% of the time on out-of-sample IDX 2024 (n=...)"; the confidence tier badge (Low / Med / High) is derived from per-class ECE such that any class with ECE >0.07 forces an automatic UI downgrade from `high` → `low`.
4. **Ship/no-ship gate (TA-INFRA-05):** If held-out 2024 accuracy <45%, the UI gracefully falls back to a "historical stats only" probability card with no ONNX output — verified by toggling the model-accuracy floor flag in a smoke test; the UI supports both shapes (ONNX present / ONNX absent) without code change.
5. The ONNX preview-deploy smoke test (CI `pnpm test:onnx-smoke`) asserts a probability triplet sums to 1 ±epsilon on a cold `curl` to `/api/ta/analysis/BBCA`; cold INIT_DURATION measured at <5s (or TA-INFRA-04 fallback architecture in effect from T1 measurement); model artifact is bundled via `next.config.js outputFileTracingIncludes` and never overwritten in place (rotation by filename, hash in `ta_analysis_cache.llm_model_version` or parallel column).

**Plans**: TBD
**UI hint**: yes

---

### Phase 16 (T4): Polish

**Goal:** A user finishing the chart/pattern/probability analysis can ask follow-up questions in a TA-context-grounded RAG chat that never touches v1.0 document chunks, the experience renders cleanly on a 375px mobile viewport, public `/api/ta/*` routes are per-IP rate-limited, Langfuse instrumentation is live on every TA Gemini call, and a 30-prompt bilingual adversarial red-team has confirmed the buy/sell guardrail holds across both v1.0 chat and v2.0 TA chat.

**Depends on:** Phase 13, 14, 15 all VERIFICATION.md on disk. **T4 planning is BLOCKED on Q3 resolution.**

**Blocking research question** (MUST be resolved before planning begins, via TA-INFRA-08):
- **Q3** — Read Phase 11 Langfuse traces for 7+ days of live data and compute P95 Gemini daily RPD. If P95 >150, T4 MUST default TA chat to Groq + Llama 3.3 70B fallback. If P95 >200, T4 MUST also add stale-while-revalidate caching to TA explanation. These conditional behaviors must be planned into the phase before execution.

**Requirements** (10): TA-CHAT-01, TA-CHAT-02, TA-CHAT-03, TA-CHAT-04, TA-CHAT-05, TA-CHAT-06, TA-INFRA-01, TA-INFRA-08, TA-UX-02, TA-INFRA-07 (T4 half)

**Waves** (per research/ARCHITECTURE.md §7.2):
- **Wave 0 (prerequisite):** TA-INFRA-08 Langfuse P95 RPD measurement is collected and documented; conditional fallback behavior (Groq default, SWR cache) is decided BEFORE plan-phase begins.
- Wave 1: migrations for `ta_chat_sessions`, `ta_chat_messages`, `ta_session_views`; `/api/ta/chat` route (mirrors `/api/chat`); TA chat panel; `retrieveTaContext` helper (structured: patterns + indicator snapshot + last-20-day OHLCV summary — explicitly NOT `match_document_chunks`); model-version surfacing in widget.
- Wave 2: mobile layout (375px overflow-free); TA-INFRA-01 per-IP daily rate limiter wired to all `/api/ta/*` routes via Phase 12 INFRA-02 shared limiter; Langfuse instrumentation on TA chat (Pattern B with `trace.name = "ta-chat"`); final disclaimer adjacency review.
- Wave 3: 30-prompt bilingual (EN+ID) adversarial red-team on the shared CHAT-06 guardrail (closes both v2.0 TA-CHAT-03 and v1.0 CHAT-06 untested debt); E2E smoke on top 50 tickers; **TA-INFRA-07 HUMAN-UAT** on TA chat with ≥2 non-developer Jakarta-based users within 7 days.

**Success Criteria** (what must be TRUE — observable):
1. Q3 (Gemini quota) is documented as RESOLVED in `research/questions.md` with concrete P95 RPD numbers from Phase 11 Langfuse traces, and the resulting routing decision (Groq default if >150 / SWR cache if >200) is implemented and verifiable in code.
2. A user on `/ta/BBCA` types "What does RSI mean here?" or "What is a Doji?" into the chat input and receives a streaming response grounded in TA context (patterns + indicator snapshot + last-20-day OHLCV summary), with a trailing disclaimer; a network trace confirms `match_document_chunks` is NEVER called from any TA chat code path; the v1.0 session token persists chat history across reload for 7 days in `ta_chat_sessions` / `ta_chat_messages`.
3. A user typing "Should I buy BBCA?" or "Apakah saya harus beli BBCA?" or "akumulasi BBCA" in TA chat receives the hard-block deflection at zero LLM cost from the shared bilingual `src/lib/safety/buy-sell-filter.ts` (verified by 30-prompt red-team passing for BOTH `/api/chat` and `/api/ta/chat`); a suggested-prompts strip renders 3–5 education-only prompts at session start, none of which are directional.
4. The entire `/ta/{ticker}` surface renders on a 375px mobile viewport without horizontal overflow or unusable UI; the surface-switching shared `<SiteHeader />` (mounted in T1) toggles between Upload Document and TA Analysis on both desktop and mobile.
5. All public `/api/ta/*` routes (search, analysis, chat) enforce per-IP daily rate limiting via the Phase 12 INFRA-02 shared limiter (verified by burst test exceeding the limit and observing 429s); every TA Gemini call is traced through the v1.0 Langfuse singleton with `trace.name = "ta-explanation"` or `"ta-chat"` (Pattern B with `flushAsync` in `finally`).
6. TA-INFRA-07 HUMAN-UAT signed off by ≥2 non-developer Jakarta-based users within 7 days of T4 code completion (UAT focus: chat usability, mobile experience, disclaimer clarity, suggested-prompt quality); failure to complete within 7 days rolls Phase 16 back to "not closed."

**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Setup & Foundation | v1.0 | 6/6 | Complete | 2026-05-06 |
| 2. PDF Upload & Storage | v1.0 | 6/6 | Complete | 2026-05-06 |
| 3. PDF Parsing & Chunking | v1.0 | 6/6 | Complete | 2026-05-08 |
| 4. Embeddings & Vector Store | v1.0 | 5/5 | Complete (human-verify deferred) | 2026-05-08 |
| 5. Indonesian Eval Harness | v1.0 | 2/2 | Complete | 2026-05-17 |
| 6. AI Explanation Generation | v1.0 | 5/5 | Complete (no VERIFICATION.md) | 2026-05-18 |
| 7. Citation UI & PDF Viewer | v1.0 | 3/3 | Complete (no VERIFICATION.md) | 2026-05-19 |
| 8. AI Score & Drill-Down | v1.0 | 4/4 | Complete (HUMAN-UAT deferred) | 2026-05-19 |
| 9. Stock Data & Trend Chart | v1.0 | 4/4 | Complete (no VERIFICATION.md) | 2026-05-22 |
| 10. Chat Interface | v1.0 | 5/5 | Complete (no VERIFICATION.md) | 2026-05-24 |
| 11. Observability & Reliability | v1.0 | 4/4 | Complete | 2026-05-24 |
| 12. Polish & Public Launch | v1.0 | 4/4 | Complete (no VERIFICATION.md) | 2026-05-24 |
| 13. T1 Data & Indicators | v2.0 | 5/7 | In Progress|  |
| 14. T2 Patterns & Explanation | v2.0 | 0/TBD | Not started (gated on Phase 13 VERIFICATION.md) | — |
| 15. T3 ML Probability Layer | v2.0 | 0/TBD | Not started (gated on Phase 13 VERIFICATION.md + Q1 + Q2; Waves 0–1 may parallelize with T2) | — |
| 16. T4 Polish | v2.0 | 0/TBD | Not started (gated on Phases 13–15 VERIFICATION.md + Q3) | — |

---

## Backlog

Deferred work that should be resolved before the next public release.
Numbering follows the `999.x` convention for deferred-from-main-roadmap entries.

### Phase 999.1: Follow-up — Phase 8 HUMAN-UAT incomplete (BACKLOG)

**Goal:** Complete the pending human-UAT for Phase 8 (AI Score & Drill-Down).
**Source phase:** 8
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**Pending tests:**
- [ ] Score card renders correctly on a real document (`milestones/v1.0-phases/08-ai-score-drill-down/08-HUMAN-UAT.md` if archived; otherwise `.planning/phases/08-ai-score-drill-down/08-HUMAN-UAT.md`)
- [ ] Null score fallback visible
- [ ] All remaining tests in `08-HUMAN-UAT.md` (currently `status: partial`, `[awaiting human testing]` since 2026-05-19)
**Why deferred:** Verification report status is `human_needed` — auditor cannot exercise interactive accordion / PDF scroll callbacks in headless mode. Force-advanced without human confirmation.
**Risk:** Score card may have visual/interaction defects not caught by automated checks.

### Phase 999.2: Follow-up — Phase 9 verification never run (BACKLOG)

**Goal:** Run `/gsd-verify-work 9` to produce `09-VERIFICATION.md` for Stock Data & Trend Chart.
**Source phase:** 9
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**State on disk:** 4/4 plans implemented, 4 SUMMARY.md files present, no VERIFICATION.md, no UAT.
**Why deferred:** Force-advanced without verification gate.
**Risk:** Goal-backward verification has not confirmed delivery of TICKER-01/02, STOCK-01..05, CHART-01/02 requirements.

### Phase 999.3: Follow-up — Phase 10 verification never run (BACKLOG)

**Goal:** Run `/gsd-verify-work 10` to produce `10-VERIFICATION.md` for Chat Interface.
**Source phase:** 10
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**State on disk:** 5/5 plans implemented, 5 SUMMARY.md files present, no VERIFICATION.md.
**Why deferred:** Force-advanced without verification gate.
**Risk:** Goal-backward verification has not confirmed delivery of CHAT-01..06 requirements. CHAT-06 (buy/sell hard-block) is compliance-critical. The integration checker confirmed code-level wiring of CHAT-06 (`/api/chat/route.ts:116` pre-LLM guardrail) — adversarial UAT still pending.

### Phase 999.4: Follow-up — Phase 12 verification never run (BACKLOG)

**Goal:** Run `/gsd-verify-work 12` to produce `12-VERIFICATION.md` for Polish & Public Launch.
**Source phase:** 12
**Deferred at:** 2026-06-06 during /gsd-next force-advance
**State on disk:** 4/4 plans implemented, 4 SUMMARY.md files present, no VERIFICATION.md.
**Why deferred:** Force-advanced without verification gate.
**Risk:** Goal-backward verification has not confirmed DISCLAIM-01/03, UX-03, INFRA-02 delivery. Public-launch readiness is unverified.

### Phase 999.5: Sync STATE.md and ROADMAP table with disk reality (BACKLOG)

**Goal:** Reconcile `.planning/STATE.md` and `.planning/ROADMAP.md` against actual phase-directory contents and the audited reality.
**Source phase:** N/A (cross-cutting bookkeeping)
**Deferred at:** 2026-06-06
**Drift observed pre-archive:**
- STATE.md `total_phases` auto-set to 17 by `gsd-tools milestone complete` (counted backlog entries as phases — actual milestone is 12)
- STATE.md `current_phase` and `Phase Progress` table reflect mid-May reality
- ROADMAP Progress table (now archived) misrepresented Phases 5–9 as "Not started / Planned · 0 plans" while shipped
**Why deferred:** Surfaced during /gsd-next completeness scan and milestone close. Not blocking but causes future /gsd-next routing errors.
**Risk:** Future GSD sessions read stale phase state.

### Phase 999.6: Fix v1.0 code-level launch blockers (R1–R4) (BACKLOG)

**Goal:** Address the four critical code-level issues surfaced by `gsd-integration-checker` during the v1.0 audit.
**Source phase:** v1.0 audit (`milestones/v1.0-MILESTONE-AUDIT.md`)
**Deferred at:** 2026-06-06 milestone close
**Items:**
- **R1:** `vercel.json` cron auth method mismatch — handlers accept `?secret=`, crons hit bare path → 401. *(Note: implicitly closed as a side-effect of v2.0 Phase 13 TA-INFRA-02 dispatcher consolidation, since the new dispatcher uses one agreed auth path. Confirm during Phase 13 verification.)*
- **R2:** No cron registered for `/api/internal/analyze-batch` — soft-fail in `analyze-document-batch.ts:273` never auto-resumes
- **R3:** No cron registered for `/api/cron/keep-alive` — Supabase free-tier inactivity pause risk
- **R4:** Session-ownership TODO in `src/app/doc/[documentId]/page.tsx:84` — anyone with documentId reads explanation + signed PDF URL
**Why deferred:** Force-closed v1.0 with these unresolved. v2.0 takes them as side-effects only for R1; R2–R4 remain open after v2.0.
**Risk:** R1+R2 cause silent pipeline stalls under retry. R4 is a privacy gap that contradicts the implicit security contract of anonymous browser-keyed v1.
**Estimated effort:** 2–4 hours total.

---

*Roadmap last reorganized: 2026-06-06 at v1.0 milestone close*
*v2.0 TA Module phases (13–16) appended: 2026-06-06*
