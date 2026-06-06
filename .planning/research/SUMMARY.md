# Clarifin v2.0 TA Module — Research Synthesis

**Synthesized:** 2026-06-06
**Sources:** `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`
**Purpose:** Single consolidation for requirements-definer + roadmapper to consume. Original files remain authoritative on detail; this digest is the navigation layer.

---

## 1. Executive Summary

The v2.0 TA Module adds a standalone Technical Analysis surface (`/ta/{ticker}`) to the shipped Clarifin v1.0 stack as a **sibling product surface**, not an extension of the document-upload pipeline. It reuses virtually every v1.0 primitive (Next.js 15 / Vercel Hobby / Supabase / Gemini 2.5 Flash / Recharts / yahoo-finance2 / Langfuse / shadcn) and adds **two genuinely new server-side dependencies** — `technicalindicators` (pure-JS indicator math) and `onnxruntime-node` (XGBoost inference). The module ships in four phases T1→T4 (mapping to GSD phases 13→16): T1 data+indicators, T2 patterns+Gemini explanation, T3 ML probability layer, T4 polish (chat, pre-warm, observability, mobile, rate limit).

The audience is the **same person v1.0 served** — English-fluent Indonesian professional, non-finance-trained, opens IDX charts but doesn't know what they're seeing. That reshapes the feature list: most "table stakes" of trading platforms (drawing tools, custom indicators, alerts, multi-pane) are anti-features here; the differentiator is honest probabilistic framing + plain-English pattern education.

**Biggest risks (in priority order):** (1) `onnxruntime-node` cold-start cost on Vercel Fluid Compute threatening the 4s cache-miss SLA; (2) Gemini 250 RPD quota collision between v1.0 explanation/chat and v2.0 explanation/chat; (3) XGBoost probabilities shipping uncalibrated and breaking the trust contract; (4) Vercel Hobby's 2-cron limit colliding with v1.0's pending cron debt (R1-R3) plus v2.0's new needs; (5) CHAT-06 buy/sell guardrail inherited from v1.0 never adversarially tested, doubled blast radius across two new TA LLM surfaces.

---

## 2. Stack Additions

### New production dependencies

| Library | Version | Purpose | Notes |
|---|---|---|---|
| `technicalindicators` | `3.1.0` `[ASSUMED]` | RSI / MACD / Bollinger / EMA / SMA / ATR / Stochastic / OBV + candlestick pattern functions | Pure JS, no native deps. Verify all 12 seed §6.1 patterns ship in-package; gap-fill via rule-code if not. |
| `onnxruntime-node` | `1.20.x` `[ASSUMED]` | Run exported XGBoost classifier in Node.js | Native Linux x64 binary; **Node runtime only** (not Edge). Confirm `os` includes linux, `cpu` includes x64. |

### Offline training stack (developer machine ONLY — never deployed)

`xgboost 2.x` + `scikit-learn 1.4+` + `skl2onnx 1.16+` + `onnx 1.15+` + `yfinance 0.2.x` + `pandas` + `numpy`. All `[ASSUMED]`. The deliverable is a `.onnx` artifact + SHA256 + `model-version.json`. **No Python runtime ships to Vercel.**

### Reused from v1.0 (verified in codebase)

Next.js 15.5, React 19, Vercel AI SDK 4.3, `@google/genai`, `@google/generative-ai`, Recharts 3.8, yahoo-finance2 3.14, Langfuse 3.38, Supabase Postgres + pgvector, shadcn/ui, Tailwind v4, Vitest, t3-env, `server-only`. **Critical:** `server-only` import boundary protects `onnxruntime-node` from accidental client-bundle inclusion.

### Rejected (with one-line rationale)

- **`tulind`** — C++ libta-lib bindings; breaks Vercel builds like `pdf-parse` did in v1.0.
- **`onnxruntime-web`** — wrong tier (model ships to clients, leaks, prevents server caching).
- **Python inference microservice on Fly.io/Railway** — adds hosting bill; violates $0/month.
- **TradingView Lightweight Charts** — license review + 250KB bundle; Recharts ComposedChart can render candlesticks.
- **Pinecone/Qdrant/Weaviate** — pgvector sufficient; TA cache is ticker+date keyed, no vector search.
- **LangChain** — already rejected in CLAUDE.md §14; same logic for TA.
- **Redis / Upstash** — Supabase + `unstable_cache` covers seed §10.
- **Alpha Vantage / Polygon / Finnhub** — rate-limit incompatible (Alpha Vantage 25/day already rejected).
- **WebSocket feeds** — EOD-only; serverless-incompatible.

### Verification checklist (for next agent before pinning versions)

```bash
npm view technicalindicators version
npm view onnxruntime-node version
npm view onnxruntime-node os    # MUST include linux
npm view onnxruntime-node cpu   # MUST include x64
npm view onnxruntime-node dist.unpackedSize  # cold-start budget input
# Pattern coverage:
pnpm dlx tarball technicalindicators | tar -tzv | grep -i candle
# Python compat triplet:
pip index versions xgboost skl2onnx onnx
```

---

## 3. Feature Shortlist (table-stakes by category)

Complexity: **S** <1d, **M** 2–4d, **C** 1–2w. Phase = T1/T2/T3/T4.

### CHART

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-CHART-01 | Candlestick rendering (OHLC bars, up/down color) | M | T1 | Chart-lib decision (deferred to T1 phase-research) |
| TS-CHART-02 | Volume subpanel (bars colored by up/down day) | S | T1 | — |
| TS-CHART-03 | Range selector: 1M/3M/6M/1Y/2Y preset | S | T1 | — |
| TS-CHART-04 | Hover tooltip: date + OHLCV | S | T1 | — |
| TS-CHART-05 | Zoom + pan (wheel/drag desktop, pinch mobile) | M | T1 | — |
| TS-CHART-06 | Crosshair on hover | S | T1 | — |
| TS-CHART-07 | Loading skeleton + invalid-ticker error | S | T1 | Phase 9 STOCK-* error patterns |
| TS-CHART-08 | Sparse-data state (<30 candles IPOs) | S | T1 | — |
| TS-CHART-09 | Pattern markers overlaid on chart | M | T2 | — |
| TS-CHART-10 | Click marker → opens explanation card | S | T2 | — |

### INDICATOR

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-IND-01 | RSI(14) subpanel with 30/70 reference lines | S | T1 | — |
| TS-IND-02 | MACD(12,26,9) subpanel with histogram | S | T1 | — |
| TS-IND-03 | Bollinger Bands(20, 2σ) overlay toggle | S | T1 | — |
| TS-IND-04 | EMA-20 / EMA-50 / EMA-200 overlay toggles | S | T1 | — |
| TS-IND-05 | Indicator snapshot strip (one-line direction) | M | T1 | — |
| TS-IND-06 | Plain-English interpretation hint per indicator | M | T2 | v1.0 plain-English voice + PSAK glossary |
| TS-IND-07 | Overlay toggle controls (chips) | S | T1 | — |

Defaults: EMA-50 + EMA-200 ON; Bollinger + EMA-20 OFF; Volume + RSI + MACD always-on subpanels.

### PATTERN

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-PAT-01 | Detected pattern sidebar list (name, label, type icon) | M | T2 | — |
| TS-PAT-02 | Pattern marker positioned at detected candle range | M | T2 | Chart-lib choice |
| TS-PAT-03 | Explanation card: plain-English name + 1-line def + historical context | C | T2 | v1.0 explanation voice |
| TS-PAT-04 | Pattern taxonomy badge (Bull reversal / Bear / Cont / Neutral) | S | T2 | — |
| TS-PAT-05 | Historical stats row (per seed §4 `historical_stats`) | M | T2 | — |
| TS-PAT-06 | "No patterns detected" explicit empty state | S | T2 | — |
| TS-PAT-07 | Auto "small sample" caveat when N<30 IDX occurrences | S | T2 | — |

### PROBABILITY

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-PROB-01 | Three-bar widget: Bullish / Neutral / Bearish + % labels | M | T3 | — |
| TS-PROB-02 | Random-baseline (33%) reference line on each bar | M | T3 | — |
| TS-PROB-03 | Explicit horizon label ("10-day forward outlook") | S | T3 | — |
| TS-PROB-04 | Sample-size note "Based on N similar contexts on IDX (range)" | S | T3 | — |
| TS-PROB-05 | Confidence tier badge (Low / Med / High) — auto-downgrade if ECE > 0.07 | M | T3 | — |
| TS-PROB-06 | Model-accuracy card "Right N% on out-of-sample IDX 2024" | M | T3 | — |
| TS-PROB-07 | Widget-attached disclaimer ("historical frequencies, not predictions") | S | T3 | DISCLAIM-01 |

### EXPLAIN-TA

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-EXP-01 | Streaming 3-paragraph explanation (chart / context / risks) | C | T2 | Phase 6 streaming pattern |
| TS-EXP-02 | Inline jargon definitions (hover/click) | M | T2 | PSAK glossary pattern |
| TS-EXP-03 | Conflicting-signals callout when patterns vs indicators disagree | M | T2 | — |
| TS-EXP-04 | Page-level disclaimer appended | S | T2 | DISCLAIM-01 |
| TS-EXP-05 | LLM output sanitization (forbidden phrases stripped) | M | T2 | **Reuses Phase 10 CHAT-06 — extend bilingual** |

### CHAT-TA

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-CHT-01 | Chat input below analysis panel | S | T4 | **Reuses Phase 10 `useChat` UI** |
| TS-CHT-02 | Retrieval = patterns + indicator snapshot + recent OHLCV summary (NOT documents) | C | T4 | New retrieval; **do NOT reuse `match_document_chunks`** |
| TS-CHT-03 | Buy/sell hard-block on chat input | S | T4 | **Reuses CHAT-06 `isInvestmentAdviceQuery`** |
| TS-CHT-04 | Streaming response with trailing disclaimer | S | T4 | Phase 10 patterns |
| TS-CHT-05 | Suggested-prompts strip (education-only) | S | T4 | — |
| TS-CHT-06 | Session token reuse across TA + document chat | S | T4 | Phase 10 session pattern |

### DISCLAIM-TA

| REQ-ID | Feature | Complexity | Phase | v1.0 Dependency |
|---|---|---|---|---|
| TS-DIS-01 | Page-header banner "Educational analysis only" | S | T2 | DISCLAIM-01 |
| TS-DIS-02 | Per-output disclaimer attached to each AI block | S | T2 | DISCLAIM-01 |
| TS-DIS-03 | Always-visible full legal disclaimer below-fold | S | T2 | DISCLAIM-01 |
| TS-DIS-04 | First-time TA onboarding modal | M | T2 | Phase 12 DISCLAIM-03 pattern |

### Differentiators (positioning, not table-stakes)

- **DIFF-01..03** Plain-English + Bahasa pattern names, "how this works" expandable, glossary tooltips. (T2)
- **DIFF-04..07** Honest probabilistic framing: random baseline + sample size + accuracy card + counter-signals. (T3)
- **DIFF-08..10** Audience-aware defaults: fewer indicators on by default; raw values translated to plain English; suggested prompts default to learning. (T1/T2/T4)
- **DIFF-11..13** v1.0 reuse: shared session token, cross-surface link to fundamentals, unified disclaimer voice. (T4)

### Anti-features (DO NOT build)

Drawing tools (Fib/Gann/trendlines), custom indicator builder, save/share chart layouts, alerts, watchlists, multi-stock comparison, paper trading, level-2 order book, tick-by-tick, multi-pane layouts, heatmaps, real-time data, buy/sell verdicts, price targets, stop-loss, auto-fetch fundamentals when entering TA ticker (DIFF-12 link only — no auto-merge), TradingView premium embed, multi-LLM routing beyond Gemini → Groq fallback.

---

## 4. Architecture Decisions (six pillars from ARCHITECTURE.md)

1. **Isolation** — TA is a sibling surface under `/ta/{ticker}`, sharing only root layout + session token with `/doc/{id}`. New shared `<SiteHeader />` added to RootLayout for surface switching.
2. **Schema split** — Five new TA-prefixed tables (`ohlcv_cache`, `ta_analysis_cache`, `pattern_outcome_log`, `ticker_metadata`, optional `ta_session_views`). v1.0 `documents` / `chunks` / `chat_sessions` untouched. **NO redundancy with v1.0 — `stock_cache` doesn't exist** (v1.0 uses column-level `documents.stock_data JSONB`).
3. **Cron consolidation** — Replace the 2 existing crons (`parse-batch`, `embed-batch`) with a **single dispatcher cron** (`/api/internal/dispatch?job=daily` at 11:00 UTC + weekly keep-alive). Dispatcher invokes jobs as **direct function imports** to avoid Vercel 508 INFINITE_LOOP_DETECTED (parse-batch comment lines 13-22). Each job takes `{ deadline }` and self-limits.
4. **ONNX as static asset** — Model lives at `src/lib/ta/model/pattern-classifier.onnx` (NOT in `public/`). Bundled via `next.config.js outputFileTracingIncludes`. Lazy-loaded singleton (`sessionPromise` cached, not the resolved session). Falls back to Supabase Storage if model exceeds ~50MB.
5. **Two-pass cache** — Next.js `unstable_cache` (per-instance, ~5min during market hours) wraps Supabase `ta_analysis_cache` (cross-deployment, expires_at = next 11:00 UTC). `revalidateTag` invalidates after nightly pre-warm. Adds tier vs v1.0's single-tier because TA payloads are ~200KB (vs ~5KB).
6. **Reuse, not extend** — `langfuse` singleton, `guardrail`, `streamText` + `onFinish`, `INTERNAL_PARSE_SECRET` auth all transplant directly. Extract `timingSafeStringEq` + `extractBearer` into `src/lib/internal-auth.ts` (currently triplicated in parse/embed/analyze-batch routes). **Do NOT extend `chat_sessions` / `chat_messages`** — FK shape mismatch with TA; create `ta_chat_sessions` / `ta_chat_messages` instead.

---

## 5. Build Order T1 → T4

> Maps to GSD phases 13 → 16. Intra-phase parallelism shown as "Waves".

### Phase 13 / T1 — Data & Indicators (foundational, strictly sequential vs other phases)

- **Wave 0:** Install deps; DB migration for `ohlcv_cache` + `ticker_metadata`; extract `src/lib/internal-auth.ts`; populate `ticker_metadata` from checked-in seed JSON.
- **Wave 1 (parallel):** `fetch-ohlcv.ts`, `upsert-ohlcv.ts`, `compute-indicators.ts`.
- **Wave 2 (parallel):** `/api/ta/analysis/[ticker]`, `/api/ta/search`, basic `/ta/[ticker]/page.tsx`, `candlestick-chart.tsx`, `indicator-subpanel.tsx`.
- **Wave 3:** Dispatcher cron skeleton (`/api/internal/dispatch`), wire `runTaRefreshOhlcv`, **replace existing 2 crons** with daily + weekly dispatcher pair. E2E verify BBCA / TLKM / GOTO render.

### Phase 14 / T2 — Patterns & Explanation

- **Wave 0:** Migration for `ta_analysis_cache`; `src/lib/ta/prompts.ts`; three-tier disclaimer banner.
- **Wave 1 (parallel):** 12 candlestick detectors; 5 chart-pattern detectors.
- **Wave 2:** Pattern marker overlay component; Gemini streaming explanation (Pattern B Langfuse — open before streamText, close in `onFinish`); extend `/api/ta/analysis/[ticker]` to invoke detection + LLM + cache write.
- **Wave 3:** Wire `runTaPrewarmAnalysis` + `runTaEvictCache` to dispatcher. Verify patterns + explanation for BBCA/TLKM/GOTO with sanitization passing.

### Phase 15 / T3 — ML Probability Layer

**Critical opportunity: T3 Waves 0-1 run in PARALLEL with T2 Waves 0-2.** T2 and T3 share `ohlcv_cache` + indicators but otherwise touch disjoint code. Handoff is the `ta_analysis_cache.probabilities` JSONB field — T2 writes a placeholder shape, T3 replaces it with real ONNX output.

- **T3 Wave 0 (parallel with T2):** Python training pipeline; feature engineering from `ohlcv_cache` export; label generation.
- **T3 Wave 1 (parallel with T2):** XGBoost + Platt calibration; ONNX export; `model-version.json`.
- **T3 Wave 2 (after T2 ships):** `onnxruntime-node` singleton; feature encoder; `pattern_outcome_log` table + `runTaBackfillOutcomes` job; probability card + accuracy card UI.

### Phase 16 / T4 — Polish (strictly after T1+T2+T3)

- **Wave 0:** Migrations for `ta_chat_sessions`, `ta_chat_messages`, `ta_session_views`.
- **Wave 1:** `/api/ta/chat` (mirrors `/api/chat`); TA chat panel; retrieve-ta-context helper; model-version surfacing.
- **Wave 2:** Mobile layout; rate-limiting wired to TA routes; Langfuse instrumentation on TA chat (Pattern B); final disclaimer review.
- **Wave 3:** 30-prompt adversarial red-team on CHAT-06; E2E smoke on top 50 tickers; R1 verification on dispatcher cron auth.

---

## 6. Top Risks (5 non-negotiable checkpoints + 7 open stack risks)

### Five non-negotiable phase checkpoints (PITFALLS.md primary rec)

1. **T2:** Volume + ATR + multi-bar confirmed pattern detection. Acceptance: ≤10 markers/year on 5 curated low-liquidity tickers.
2. **T3:** Calibrated XGBoost output with per-class ECE < 0.07. If higher, UI auto-downgrades `confidence: 'high'` → `'low'`.
3. **T4:** 30-prompt adversarial red-team for CHAT-06 (bilingual EN+ID). **Also closes v1.0 untested debt** — kills two birds.
4. **Before T4:** Gemini RPD budget measured from Langfuse (7+ days live data); Groq fallback wired for TA chat by default. Cross-references Q3.
5. **T3:** ONNX model bundling smoke test on Vercel preview deploy (cold-curl `/api/ta/analysis/BBCA.JK`); CI `pnpm test:onnx-smoke` asserts probability triplet sums to 1.

### Seven open stack risks

1. **`onnxruntime-node` × Vercel Fluid Compute concurrency (HIGH)** — works inconsistently under bursty load is the real risk, not "doesn't work." Mitigation: T1 deploy-and-measure with hello-world ONNX before T3 ML work begins.
2. **`technicalindicators` period-off-by-one history (MEDIUM)** — stable API but recurring warmup-alignment confusion. Mitigation: explicit alignment fixture in T1 cross-checked with pandas-ta / TradingView.
3. **yahoo-finance2 unofficial-API fragility (MEDIUM, accepted in v1.0)** — TA amplifies blast radius (needs 1y+ history per ticker). Mitigation: response validation per Pitfall D3; plan Stooq fallback at T1 design, not at incident time.
4. **Gemini quota stacking (HIGH, pre-existing as Q3)** — TA stacks on Phase 6 + 10 burn. Mitigation: Q3 must close before T4; TA chat defaults to Groq.
5. **ONNX model file rotation (MEDIUM)** — no versioning strategy. Mitigation: include model hash in `ta_analysis_cache.llm_model_version` (or parallel column); never overwrite — rotate by filename.
6. **Disclaimer-filter drift between v1 CHAT-06 and TA chat (HIGH if duplicated)** — Mitigation: extract CHAT-06 into shared `lib/safety/buy-sell-filter.ts` during T2; make it bilingual.
7. **Bundle size impact of `onnxruntime-node` (LOW-MEDIUM)** — native binary + .onnx may approach Vercel function-bundle limits. Mitigation: monitor deploy logs; fetch from Supabase Storage if needed.

**Cross-reference:** Q1 (calibration method), Q2 (calibration target ECE), Q3 (Gemini quota) in `.planning/research/questions.md` must all close before their owning phase ships.

---

## 7. Phase-to-Pitfall Ownership Matrix (verbatim from PITFALLS.md §6)

| # | Pitfall | T1 Data & Indicators | T2 Patterns & Explanation | T3 ML Probability | T4 Polish |
|---|---|---|---|---|---|
| D1 | Pattern false positives (illiquid IDX) | — | **OWNS** (volume/ATR/multi-bar gates, illiquid fixture test) | — | — |
| D2 | XGBoost calibration debt | — | — | **OWNS** (ECE < 0.07 per class, walk-forward CV) | — |
| D3 | OHLCV data quality | **OWNS** (sanity-check on insert, fixture vs TradingView) | — | Uses cleaned data | — |
| C1 | ONNX deployment on Vercel | — | — | **OWNS** (preview deploy smoke, opset in model card) | — |
| C2 | technicalindicators library bugs | **OWNS** (fixture vs pandas-ta) | Uses fixture | — | — |
| C3 | Recharts performance ceiling | — | **OWNS** (1y benchmark, no 5y until decimation) | — | (Decimation if needed) |
| A1 | Prompt injection / directional language | — | **OWNS** (bilingual sanitizer, system prompt balance req) | — | **OWNS** (30-prompt adversarial red-team — also closes v1.0 CHAT-06 debt) |
| A2 | Gemini quota + cron limit collision | (Read Langfuse) | (Read Langfuse) | (Read Langfuse) | **OWNS** (Groq fallback, SWR cache, cron consolidation, rate limiter) |
| A3 | OJK regulatory framing | — | **OWNS** (UI copy review, "signal"→"pattern", historical framing) | (Model accuracy card framing) | **OWNS** (external review of system prompt + copy) |
| D5 | Look-ahead / leakage in training | — | — | **OWNS** (raw close, walk-forward CV, point-in-time metadata, survivorship documented) | — |
| D6 | 2020–2021 bull-market overfit | — | — | **OWNS** (extend to 2015–2024, regime-stratified eval) | — |
| P1 | Verification paperwork debt | (VERIFICATION.md) | (VERIFICATION.md) | (VERIFICATION.md) | (VERIFICATION.md) |
| P2 | Obvious-in-hindsight launch blockers | (table migration smoke) | (DISCLAIM adjacency) | (ONNX bundle smoke) | (cron count budget, session isolation, burst test) |
| P3 | HUMAN-UAT debt | — | **OWNS** (2 Jakarta non-dev users on patterns) | — | **OWNS** (2 Jakarta non-dev users on chat) |

**Per-phase summary:** T1 owns D3 + C2 (foundational). T2 owns D1 + C3 + A1 + A3 + P3 (user-visible quality bar). T3 owns D2 + C1 + D5 + D6 (math-correctness bar). T4 owns A1 + A2 + A3 + P3 (launch-readiness bar). All phases own P1 + P2 (process).

---

## 8. Open Questions for discuss-phase

Consolidated from all 4 research files (de-duplicated):

1. **Chart library decision** (Recharts ComposedChart vs `lightweight-charts` vs ECharts). Defer to T1 phase-research; STACK favors staying on Recharts, FEATURES flags `lightweight-charts` as candidate, ARCHITECTURE accepts client-side Recharts is the pattern. Cross-check at T1 prototype.
2. **Bahasa Indonesia pattern naming convention.** Do standard ID names exist for the 12 candlestick patterns, or do Indonesian retail investors prefer borrowed English (Doji, Engulfing)? Affects DIFF-01 framing.
3. **Suggested-prompts strip content** — ticker-agnostic ("What is RSI?") vs ticker-aware ("Why is BBCA's RSI high?"). Defer to T4.
4. **Pre-warm cron target list source** — LQ45 + IDX30, market-cap-ranked, or most-viewed in v1.0 fundamentals usage? Resolve during T4. Hard-coded JSON checked into repo recommended for v2.0.
5. **Mobile interaction degradation** — candlesticks + markers at 375px or tablet-up gate? Phase-research during T1.
6. **Top-50 list source of truth.** See #4.
7. **OHLCV backfill bootstrap** — one-off script (mandatory for T3 training data) vs gradual via daily cron. Add `scripts/ta/backfill-ohlcv.ts` to T1.
8. **Cron migration sequencing** — switching to dispatcher is destructive. Plan must include same-deploy switch + verification step; keep old routes around as fallback for one deploy cycle.
9. **Onboarding modal content** — TA-specific disclaimer modal vs reuse of v1.0's generic one? Confirm at T2 discuss-phase.
10. **TA chat retrieval context shape** — indicator history, patterns, or both? Affects context window. Defer to T4.
11. **Ticker URL casing/suffix** — `/ta/BBCA` uppercase without `.JK` is the recommendation; lowercase redirects. Lock at T1.
12. **Header link visibility before T1 ships** — coming-soon `/ta` landing in T1 Wave 0, feature-flag, or soft-launch? Recommend coming-soon.

---

## 9. What the Roadmapper Must Pre-Commit

Constraints the roadmap MUST honor — these are not negotiable trade-offs at planning time:

1. **VERIFICATION.md gated between phases (P1 process pitfall).** No T(n+1) planning begins until T(n) has VERIFICATION.md on disk. The v1.0 audit is in-repo proof of what "later" produces (33/60 unsatisfied paper requirements; CHAT-06 critical compliance gate never adversarially tested).
2. **Cron budget ≤2 enforced.** Vercel Hobby allows 2 free crons; v1.0 has cron debt (R1 auth fix, R2 analyze-batch, R3 keep-alive). T4 cannot add a 3rd cron — dispatcher consolidation (Decision 3) is mandatory and must execute at T1 Wave 3.
3. **Langfuse RPD measurement before T4.** T4 planning is blocked until 7+ days of Phase 11 OBS-01 live data exists. If v1.0 P95 Gemini RPD > 150, T4 must default TA chat to Groq; if > 200, T4 must also add SWR caching to TA explanation.
4. **ONNX preview-deploy smoke before T3 commits.** T1 must deploy a hello-world TA route with a 5MB dummy `.onnx` and measure cold INIT_DURATION on Vercel. If cold-start > 5s consistently, T3's entire ONNX architecture needs revisiting (smaller model, async probability, or separate runtime). Discovering this after T3 training work is a catastrophic timeline hit.
5. **R1 (cron auth bug) closes at T1 or before.** Dispatcher cron inherits the same auth surface; un-fixed R1 means TA pre-warm silently never runs.
6. **CHAT-06 extracted to shared module at T2.** Two filters → two update sites → drift. Extract to `lib/safety/buy-sell-filter.ts` and make bilingual (EN + ID: `beli`, `jual`, `akumulasi`, `target harga`, `stop loss`, `cut loss`, `hold`, `rekomendasi`).
7. **T3 model accuracy floor — ship/no-ship gate.** If held-out 2024 accuracy < 45%, T3 falls back to historical-stats card with no ONNX probability output. UI must support this fallback shape from day one.
8. **HUMAN-UAT at T2 and T4 with 2 Jakarta non-dev users each.** Within 7 days of phase code completion or phase rolls back to "not closed."

---

## 10. Sources

### Primary research files (this synthesis)
- `.planning/research/STACK.md` — deps, ONNX cold-start, integration map, what-not-to-add, verification checklist
- `.planning/research/FEATURES.md` — 6 categories, table stakes / differentiators / anti-features, feature-to-phase, audience UX notes
- `.planning/research/ARCHITECTURE.md` — routing, schema audit, cron dispatcher, ONNX lifecycle, caching, reuse map, wave order
- `.planning/research/PITFALLS.md` — 5 families (Detection, Compute, AI Safety, Training, Process), phase ownership matrix

### Upstream inputs (verified in-repo by ARCHITECTURE)
- `.planning/PROJECT.md`, `.planning/MILESTONES.md`
- `.planning/seeds/ta-module-standalone.md`
- `.planning/notes/ta-module-design-decisions.md`
- `.planning/research/questions.md` (Q1 calibration method, Q2 ECE target, Q3 Gemini quota)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- `.planning/milestones/v1.0-phases/09-stock-data-trend-chart/09-RESEARCH.md`
- `.planning/milestones/v1.0-phases/11-observability-reliability/11-CONTEXT.md`
- `.planning/milestones/v1.0-research/PITFALLS.md`
- `CLAUDE.md` — stack constraints, budget, audience
- Codebase: `src/lib/langfuse.ts`, `src/lib/guardrail.ts`, `src/lib/stock/fetch-stock-data.ts`, `src/lib/explain/generate-explanation.ts`, `src/app/api/internal/parse-batch/route.ts`, `src/app/api/chat/route.ts`, `vercel.json`, `package.json`

### Assumptions consolidated
All version claims (`technicalindicators@3.1.0`, `onnxruntime-node@1.20.x`, Python stack triplet, Vercel Hobby 2-cron limit, Hobby 250MB function-bundle limit, ONNX cold-start range 500-3000ms, IDX 16:00 WIB close + 2hr yahoo-finance2 lag) are tagged `[ASSUMED]` and require verification before pinning. Architectural claims (tier ownership, integration points, cold-start qualitative risk, OJK framing precedent) carry higher confidence.

---

## RESEARCH COMPLETE
