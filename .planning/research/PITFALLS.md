# TA Module v2.0 — Pitfalls Research

**Domain:** Adding standalone Technical Analysis surface (`/ta/{ticker}`) to existing Clarifin v1.0 stack
**Researched:** 2026-06-06
**Confidence:** MEDIUM-HIGH (most claims grounded in v1.0 audit + seed + design notes; library-version specifics tagged `[ASSUMED]` because in-session web search and Context7 were unavailable)
**Scope note:** WebSearch was denied this session. Library-bug specifics and registry version claims are tagged `[ASSUMED]` and should be re-verified by the planner via `npm view` / GitHub issues / Vercel docs before becoming acceptance criteria. The architectural and integration pitfalls (Gemini quota, ONNX-on-Vercel, OJK framing, v1.0-lesson patterns) are grounded in the in-repo artifacts read for this research and carry higher confidence.

---

## Summary

The v2.0 TA module reuses almost the entire v1.0 stack (Next.js 15 / Vercel Hobby / Supabase Postgres + pgvector / Gemini 2.5 Flash / yahoo-finance2 / Recharts / Langfuse) and stacks four new capabilities on top: OHLCV ingest, rule-based pattern detection, ONNX classifier inference, and a second LLM explanation/chat surface. The pitfalls cluster into five families:

1. **Detection noise** — IDX mid-cap illiquidity guarantees the rule-based candlestick detector will fire on noise unless it's gated by volume, multi-bar confirmation, and ATR-relative geometry.
2. **Probability honesty** — XGBoost is uncalibrated by default and the compliance story depends on probabilities meaning what they say. Skipping calibration breaks Decision 2 (probabilistic framing).
3. **Compute and integration drift** — `onnxruntime-node` on Vercel, `technicalindicators` correctness edge cases, and Recharts collapse at >500 bars are all real failure surfaces with known mitigations.
4. **AI safety overlap with v1.0** — CHAT-06 was the highest-risk compliance gate in v1.0 and was never adversarially tested (audit: severity critical). v2.0 inherits the same surface, doubled (explanation + chat), in a TA mental model that's easier to slip directional language into.
5. **Integration budget collisions** — Gemini 250 RPD is already partially burned by Phase 6/10. Vercel Hobby allows 2 free crons; v1.0 already needs 3 (R1–R3 launch blockers). Each constraint bites v2.0 if added naively.

**Primary recommendation:** Bake five non-negotiable checkpoints into the roadmap — (1) volume + ATR-confirmed pattern detection at T2, (2) calibrated XGBoost output with ECE measurement at T3, (3) adversarial CHAT-06-style red-team for the TA chat at T4 (also closes v1.0 debt), (4) Gemini quota budget with Groq fallback wired before T4 ships, (5) ONNX model bundling smoke test on Vercel preview at T3.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| OHLCV fetch + cache | API / Backend | DB (`ohlcv_cache`) | yahoo-finance2 is server-only (CORS); cache in Supabase |
| Indicator computation | API / Backend | — | `technicalindicators` runs server-side; result cached in `ta_analysis_cache.indicators` JSONB |
| Pattern detection (rule-based) | API / Backend | — | Pure JS; synchronous inside analysis request |
| ONNX inference | API / Backend (Node serverless) | — | `onnxruntime-node` loads `.onnx` from filesystem |
| LLM explanation | API / Backend | Browser (streaming render) | Gemini call server-side; SSE tokens via Vercel AI SDK |
| Chart rendering | Browser | — | Recharts client-side; server returns JSON |
| Disclaimer enforcement | Browser (visible) + API (sanitization) | — | Two-layer: server keyword scrub + client non-dismissible UI |
| Pattern outcome logging | API / Backend (cron) | DB (`pattern_outcome_log`) | Nightly fills `actual_*_return` from refreshed OHLCV |

---

## 1. Detection

### D1: Candlestick rules firing on noise (especially illiquid IDX mid-caps)

**What goes wrong:** Rule-based candlestick detection (doji, hammer, hanging man, engulfing) fires constantly on:
- **Illiquid mid/small-cap IDX names** (the bulk outside LQ45): low volume creates gappy bars; a stock that traded 50 lots at the same price all day registers as a perfect doji.
- **Post-suspension / post-halt resumptions:** BEI frequently halts and resumes; first bar after a suspension is gappy and looks like a reversal pattern.
- **Pre-RUPS low-volume drift:** weeks before a corporate action, volume drops and ranges compress, producing fake hammers.

**Why:** Pattern definitions (Bulkowski, Nison) assume reasonable liquidity. Applied verbatim to a stock trading <100 lots/day, every other bar matches some pattern. The detector becomes a noise machine; LLM downstream legitimizes the noise; trust collapses on the first obvious false positive.

**Mature mitigations:**
1. **Multi-bar confirmation** — require N+1 close to confirm an N-bar pattern. A bullish engulfing on day T is only "confirmed" if T+1 closes above T's high. Without this, markers appear and disappear day-by-day. `[ASSUMED]`
2. **Volume filtering** — pattern volume must be ≥ 1.2× the 20-day average for reversal patterns. `[ASSUMED]`
3. **ATR-relative geometry, not absolute percentages** — define "small body" as `body_size < 0.3 × ATR(14)`, not `< 0.1% × price`. Self-adjusts to the stock's natural volatility. `[ASSUMED]`
4. **Minimum-liquidity gate** — skip pattern detection on bars where `volume × close < Rp 500M`. Surface to user: "Pattern detection skipped — insufficient liquidity."

**Warning signs:** >30 markers in a 1-year chart (healthy = 5–15); same ticker shows different patterns on every reload (unstable, unconfirmed); mid-caps show denser marker clouds than LQ45; markers on near-zero-volume bars.

**Prevention check:** T2 acceptance — on 5 curated small-cap `.JK` tickers (20-day avg volume < Rp 500M), detector must produce ≤10 markers/ticker/year. Exceeding = liquidity filter off or ATR threshold too loose.

**Phase:** **T2**

---

### D2: XGBoost probabilities are uncalibrated by default

**What goes wrong:** `XGBClassifier.predict_proba` returns numbers in [0,1] summing to 1, but they are **not reliability-calibrated**. A model outputting "0.42 bullish" on held-out data may resolve bullishly only 28% or 51% of the time. `[VERIFIED: well-established XGBoost/sklearn property — uses tree leaves + softmax over margins; sklearn calibration docs confirm.]` This violates Decision 2 and makes the UI claim "Based on N similar contexts" untrue.

**Why:** Default training pipelines skip calibration silently. Three-class problems have a multinomial-vs-OvR choice that's easy to miss. Calibration requires a held-out set distinct from both training and final test set — three-way splits are uncommon outside research code.

**Standard mitigation:**
1. **Train/calibrate/test 3-way split** (70/15/15). Calibration set must not overlap training.
2. **Dominant 2026 practice for 3-class XGBoost:**
   - **Sigmoid (Platt)** for moderate calibration sets (1K–10K): `sklearn.calibration.CalibratedClassifierCV(method='sigmoid')` fits 3 logistic heads over raw margins, then renormalizes. `[ASSUMED]`
   - **Isotonic** for large calibration sets (>10K): non-parametric, more flexible, overfits on small data. `[ASSUMED]`
   - **Temperature scaling** (deep-learning standard, works for XGBoost too): single scalar T fit by minimizing NLL on calibration set. Cheap and effective for multiclass. `[ASSUMED]`
3. **Measure with Expected Calibration Error (ECE)** — bin into 10 buckets, compute |predicted - empirical|, weight by bucket size. Report ECE per class separately. Target: ECE < 0.05 per class on held-out 2024.

**Common multinomial mistakes:**
- Calibrating one-vs-rest and forgetting to renormalize — probs won't sum to 1. Users see "Bullish 38% / Neutral 41% / Bearish 35%" = 114%.
- Calibrating on the training set ("we used cross-val so it's fine") — leakage; calibrated output looks great on the calibration set, fails in production.
- Relying only on Brier score — Brier mixes calibration with refinement (sharpness). Use reliability diagrams + per-class ECE as primary, Brier as secondary.

**Warning signs:** Predicted probability histogram is bimodal at 0.0/1.0 (XGBoost's natural tendency); on held-out 2024, bucket "predicted 40–50% bullish" resolves at <30% or >60%; probabilities don't sum to 1 in production.

**Prevention check:** T3 acceptance — ship per-class reliability diagrams + ECE per class as notebook artifact in phase summary. Pass: ECE < 0.07 per class (relaxed from 0.05 since IDX sample sizes will be small for some sector × cap cells). If ECE > 0.07, UI must downgrade `confidence: 'high'` to `'low'` programmatically.

**Phase:** **T3** (this is question Q2 in `.planning/research/questions.md`)

---

### D3: OHLCV data quality on `.JK` tickers — adj-close ambiguity, gaps, survivorship

**What goes wrong:** yahoo-finance2 returns `open`, `high`, `low`, `close`, `adjClose`. Three failure modes specific to IDX:

1. **Adjusted-vs-raw confusion in indicator inputs** — `adjClose` retroactively adjusts for splits AND dividends. If RSI is computed on `adjClose` but candlesticks render on raw `close`, RSI diverges from what the user sees on any post-dividend bar. Bug shows as "RSI is 35 but the chart looks healthy."
2. **Split events for `.JK` tickers inconsistently populated** — yahoo-finance2 is an unofficial scraper; corporate actions for non-US exchanges are inconsistently returned. IDX splits/reverse-splits can show up as a huge gap in `close` with no corresponding `adjClose` adjustment, or vice versa. `[ASSUMED]`
3. **Mid-cap thin coverage** — small caps and recently-listed IDX names have sparse history; in-series gaps propagate as `null`/`NaN` into indicator calculations.
4. **IDX holiday calendar mismatch** — IDX observes Indonesian holidays (Eid, Nyepi) that yahoo-finance2's US-centric handling may not skip cleanly. A "missing bar" might be a holiday, not a data error.

**Data-cleaning pipeline:**
1. **Decide once: indicators use `adjClose`, candles render `close`** — document and never mix. Cross-check by computing RSI on both for no-corporate-action stocks (BBCA, TLKM in normal periods).
2. **Drop-or-interpolate decision per gap** — gaps ≤ 2 sessions: forward-fill. Gaps > 2 sessions: drop, surface banner "Data gap detected." Never silently interpolate weeks.
3. **Sanity-check on insert** — reject any bar where `high < low`, `close < 0`, `volume < 0`, or `close` >50% from prior close (likely uncorrected split). Log to Langfuse for review.
4. **Use IDX trading calendar** — hardcoded `idx_holidays.json` (~15/year). Only expect bars on IDX trading days.
5. **Survivorship awareness in training** — yahoo-finance2 only returns currently-listed tickers. Delisted IDX companies are gone from history. A model trained on "all IDX tickers as of 2026" omits failures and overestimates bullish-resolution rate. See D5 for training-specific mitigation.

**Warning signs:** RSI on chart doesn't match the same code recomputed from displayed OHLCV; 1-year chart shows <220 bars for an LQ45 stock (~245 IDX trading days expected); any single-bar return >30% with no news catalyst (uncorrected split); `pattern_outcome_log.actual_10d_return` NULL for non-trivial fraction of rows.

**Prevention check:** T1 acceptance — pick 3 known-corporate-action IDX tickers (a recent split, a high-dividend payer, a suspension survivor). Verify (a) split consistent across `close`/`adjClose`, (b) dividend gap doesn't break RSI, (c) suspension gap is detected and surfaced not silently interpolated. Cross-check 5 OHLCV bars/ticker against TradingView.

**Phase:** **T1** (foundational — T2 patterns and T3 ML both consume `ohlcv_cache`)

---

## 2. Compute

### C1: `onnxruntime-node` deployment failures on Vercel

**What goes wrong:** `onnxruntime-node` ships native binaries. Common Vercel deploy failures, in likelihood order:

1. **Model file (`.onnx`) not bundled into deployment.** Vercel's Next.js builder includes files referenced via `import` or static paths; a model loaded by runtime path (`fs.readFileSync('models/xgb_pattern_v1.onnx')`) is invisible to the bundler. Cold-start tries to read, gets ENOENT, crashes. `[ASSUMED]`
   - **Fix:** declare model path in `next.config.js` `outputFileTracingIncludes`.
2. **Wrong platform binary** — local dev on macOS arm64 pulls macos arm64 `.node`; Vercel build is linux x64. If someone commits `node_modules`, wrong binary ships. `[ASSUMED]`
   - **Fix:** never commit `node_modules`; let Vercel run fresh install.
3. **Function bundle size limit** — Vercel Hobby is ~250 MB unzipped (binary + model). XGBoost ONNX export for ~500 trees and a few dozen features is usually <5 MB. Flag if model grows. `[ASSUMED]`
4. **Region cold start variance** — `onnxruntime-node` loads ~30 MB native code on cold start. First request to a cold function in non-default region adds 1–3s. `[ASSUMED]`

**Python ↔ Node version compatibility:**
- `skl2onnx` exports ONNX with a specific opset version (e.g., opset 17 in 2025-era versions).
- `onnxruntime-node` supports opsets up to a max determined by its version.
- Mismatch produces "Unsupported opset version" runtime error.
- `[ASSUMED]` — pin both versions in code, document opset in model card, smoke-test in CI.

**What breaks first:** the model-file-not-bundled bug. Works locally (file on disk), fails in production. Catches teams at first deploy.

**Warning signs:** `/api/ta/analysis/{ticker}` returns 500 only on first request after deploy (cold start), succeeds on retry; Vercel logs: `ENOENT` referencing model path; ONNX opset error on every request (not intermittent — means trainer/runtime mismatch).

**Prevention check:** T3 acceptance — (1) deploy to a Vercel preview branch with model file, curl-hit `/api/ta/analysis/BBCA.JK` from cold. If 500 on first request, bundling is wrong. (2) CI step: `pnpm test:onnx-smoke` runs single inference against bundled model, asserts probability triplet sums to 1. (3) Document opset in `ml/MODEL_CARD.md`. Pin `onnxruntime-node` minor version in `package.json`.

**Phase:** **T3**

---

### C2: `technicalindicators` npm subtle correctness bugs

**What goes wrong:** `technicalindicators` is the de facto Node TA library with a history of subtle bugs producing values close-to-right but not quite. Patterns to watch `[ASSUMED]`:

1. **Off-by-one on `MACD.signal` length** — signal line needs `slowPeriod + signalPeriod - 1` warmup bars. Some versions return signal arrays one element shorter/longer than histogram, breaking alignment. The seed's `align()` helper accounts for this with explicit offsets — offsets must match the library version.
2. **`NaN` propagation on insufficient input** — feeding `RSI.calculate({ period: 14 })` an array <14 is undefined: some versions throw, some return `[]`, some return `[NaN, …]`. Seed code does no length check.
3. **Stochastic K and D length mismatch** — D is SMA of K, returned one shorter. Easy off-by-one in `align()`.
4. **OBV cumulative drift** — OBV is a running sum from the first bar. Slicing to 1-year and recomputing produces different OBV than the "true" 5-year-anchored value. Displaying "OBV" without anchor date is misleading.
5. **BollingerBands `stdDev` parameter type ambiguity** — accepts number; some users pass `"2"` and silently get string concatenation in some versions. `[ASSUMED]`

**Standard mitigation — cross-check fixture:** At T1, build a fixture file: 250-bar synthetic OHLCV with known properties (uptrend → sideways → drawdown). Compute RSI/MACD/BB/Stochastic in three places — `technicalindicators` (Node), `pandas-ta` or `ta-lib` (Python, ground truth), and a third source (TradingView visual inspection). Assert all three agree within 0.001 tolerance for every bar after warmup. Commit fixture; re-run on every dependency upgrade.

This is the single highest-ROI testing investment in T1 — once the fixture exists, library upgrades are safe.

**Warning signs:** User reports "your RSI is 58 but TradingView says 62" (formulation mismatch: Wilder vs simple); `indicators.macd.length` vs `indicators.macd_signal.length` mismatch across tickers; any `NaN` or `Infinity` in production.

**Prevention check:** T1 acceptance — `tests/indicators.fixture.test.ts` exists, contains 250-bar synthetic series, asserts RSI/MACD/BB values match committed JSON ground truth within tolerance. Re-run on every dependency PR.

**Phase:** **T1**

---

### C3: Recharts performance ceiling at >500 bars + multi-indicator overlays

**What goes wrong:** Recharts is React-component-per-data-point (SVG-based). Each `<Line>` / `<Bar>` / `<Scatter>` instantiates DOM nodes proportional to data length. The seed's mockup has candlestick (~250 bars 1y EOD) + 10 indicator series (RSI, MACD-3, BB-3, EMA20/50/200, SMA50, ATR, Stochastic-2, OBV) ≈ 15–20 line layers + up to 30 pattern markers + volume bars.

- **1y EOD (~250 bars):** fine, ~few thousand SVG nodes, snappy.
- **5y EOD (~1250 bars) with same overlays:** ~25K SVG nodes — Recharts wall. Pan/zoom janky, initial render 1.5–3s, hover/tooltip diff slow.
- **Intraday (1y hourly ~1,750; 1y 5-min ~20K):** unusable. `[ASSUMED]`

**Standard solutions (effort order):**
1. **Decimation (lowest effort)** — when >500 bars, downsample server-side using LTTB (Largest-Triangle-Three-Buckets). Visually indistinguishable, ~4× fewer points. `[ASSUMED]`
2. **Cap period selector at 2y** — seed mockup already shows `[1M][3M][6M][1Y][2Y]`. Keep it. Resist adding 5y until decimation lands.
3. **Drop indicator overlays for long periods** — at 2y, show only EMA50/EMA200 and BB; hide MACD/RSI subpanels or downsample.
4. **Switch chart library if intraday ever added** — `lightweight-charts` (TradingView OSS, canvas-based) handles 100K+ bars trivially but is imperative (not React-native) and adds integration friction. Defer unless intraday becomes a requirement (out of scope per Decision 3).

**Warning signs:** Time-to-interactive >2s for 2y view; hover tooltip lag >100ms; DevTools Performance shows long React commit phases >50ms during interaction; any user requesting 5y/intraday — that's the break point.

**Prevention check:** T2 acceptance — render 1y of BBCA with all 10 overlays, measure initial render <1.5s, hover tooltip response <50ms. T2 must explicitly **defer 5y** until decimation is added.

**Phase:** **T2** for 1–2y baseline; **T4** if decimation needed

---

## 3. AI Safety

### A1: Prompt-injection slippage of directional language in Gemini output

**What goes wrong:** The v1.0 audit flagged CHAT-06 (buy/sell hard-block) as `severity: critical` and **never adversarially tested**. The TA module reuses the same CHAT-06 forbidden-phrase filter (Decision 2) **and adds two new surfaces:** TA explanation pane + TA follow-up chat. Attack surface roughly doubles.

**Common Gemini slippage patterns:**
1. **Synonym swap** — keyword-blocked: "buy". Model outputs "accumulate," "scale into," "establish a position." Filter misses.
2. **Subjunctive directional language** — "If RSI continues falling, the price would likely test the 200-EMA support at Rp X." "Would likely test" implies a price prediction without a blocked verb.
3. **Quoted/educational deflection** — User: "Should I buy?" Model: "I cannot recommend buying. However, traders who follow this strategy typically buy when…" The "would buy" leaks through.
4. **Indonesian-language slippage** — User chats in Bahasa: "Apakah saham ini bagus dibeli sekarang?" Model responds mixed ID/EN: "Saham ini menunjukkan sinyal bullish kuat — biasanya investor mengakumulasi pada…" CHAT-06 forbidden list is English; Indonesian directional terms (`beli`, `jual`, `akumulasi`, `rekomendasi beli`) slip through unless the filter is bilingual.
5. **Pattern-based prediction language** — "Bullish engulfing pattern typically precedes a 3–5% rally over 10 days." This is a historical statistical claim (technically permissible per Decision 2 / system prompt) but reads as a price target. The line between "probabilistic framing" and "directional implication" is genuinely fuzzy.

**Why:** Keyword filters are lossy — any post-processing scrub is an adversary's playground. Gemini's training data contains immense finance content using directional language; the model's prior is to produce that style. TA mental model is intrinsically directional — patterns are called "bullish reversal," "bearish continuation." The language of TA is the problem.

**TA-specific failure patterns:** "This is a strong bullish setup" (sounds neutral, reads as buy signal); "Historically, this pattern has X% upside in 10 days" (true and probabilistic, but emphasizes upside not downside); "Risk/reward favors the upside" (directional via implication).

**Mitigations:**
1. **Bilingual forbidden-phrase list** — extend CHAT-06 filter to Indonesian (`beli`, `jual`, `akumulasi`, `target harga`, `stop loss`, `cut loss`, `hold`, `rekomendasi`). Required for both TA explanation and TA chat.
2. **System prompt mandates balanced presentation** — every pattern explanation must include both upside AND downside historical stats. The seed's `counter_signals: string[]` field exists for this — enforce non-empty.
3. **Strip 2nd-person directives** — regex out "you should," "you might want to," "consider." Replace with passive constructions.
4. **Adversarial red-team non-negotiable** — port v1.0 CHAT-06 backlog into T4 as required deliverable. Run a fixed corpus of 30 adversarial prompts (8 patterns above × 3–4 framings) against the chat endpoint. Pass: zero forbidden-phrase outputs post-sanitization. Failures added to forbidden list and re-tested.
5. **Langfuse violation logging** — every sanitizer hit (replacement) logged as span with original output. Lets us tune the system prompt to reduce collisions.

**Warning signs:** Sanitizer replacing >5% of LLM outputs in production (system prompt failing); user screenshots TA chat saying "should I buy" — bad framing reaching the wild; any Indonesian-language output that wasn't sanitized.

**Prevention check:** T4 acceptance — `tests/ta-red-team.spec.ts` exists with ≥30 adversarial prompts, runs against chat endpoint, asserts 0 forbidden-phrase leaks. **This test also closes the v1.0 CHAT-06 adversarial debt** — kills two birds.

**Phase:** **T2** for system prompt + sanitizer (explanation); **T4** for chat surface red-team

---

### A2: Gemini 250 RPD quota exhaustion under combined v1.0 + TA load

**What goes wrong:** v1.0 already burns Gemini quota in Phase 6 (explanation), Phase 8 (score), Phase 10 (chat). Phase 11 added OBS-01 Langfuse instrumentation, so the actual burn **can be measured** — question Q3 in `.planning/research/questions.md`, currently unanswered.

Naive TA budget from seed: 100 unique tickers/day × 1 cache miss = 100 LLM calls/day for TA explanation. Add follow-up chat at ~5 messages × 20 sessions/day = 100 more. **TA addition: ~200 RPD on top of v1.0.** If v1.0 averages 80 RPD today, combined = 280 RPD — over 250 free cap.

The cap manifests as `429 RESOURCE_EXHAUSTED` mid-stream. Vercel AI SDK passes these to the browser as broken responses. Without graceful fallback, v1.0 product silently degrades during Indonesian trading-window hours (09:00–16:00 WIB = 02:00–09:00 UTC = mid-Pacific-day; quota resets at midnight Pacific so peak Indonesian load and quota reset interact awkwardly).

**Compounding risk:** v1.0 Phase 11 also caps concurrency at INFRA-03 (≤2). TA spikes queue behind v1.0 traffic and inflate latency for both.

**Graceful degradation patterns:**
1. **Read current burn from Langfuse before T4 design** — Phase 11 OBS-01 gives per-day Gemini count. Compute v1.0 P50 and P95 daily burn. **Prerequisite data for T4 chat decisions.**
2. **Cache stale-while-revalidate for TA explanation** — `ta_analysis_cache.expires_at` is next market close, but on cache miss after market close we can serve the previous EOD with a "Last updated: yesterday's close" banner while regenerating in background. Avoids forcing user-facing LLM calls during crunches.
3. **Groq + Llama 3.3 70B fallback (already in stack per CLAUDE.md)** — switch TA chat (T4) to Groq by default; reserve Gemini for TA explanation (T2) where Bahasa quality matters more. Groq has 1000 RPD free.
4. **Per-IP rate limit on TA endpoints** — reuse Phase 12 INFRA-02 limiter (still unverified per audit — closes that debt too).
5. **Pre-warm only at off-peak** — seed mentions nightly pre-warm cron for top 50 tickers. Schedule after midnight Pacific (07:00 WIB) so quota reset gives 250 fresh, pre-warm consumes 50, leaves 200 for users.
6. **Quota-aware degradation banner** — when Gemini 429s, show: "AI explanation temporarily unavailable due to high demand. Indicators and patterns still loaded. Try again in an hour." Don't pretend everything is fine.

**Cron limit collision (Vercel Hobby = 2 free crons):** v1.0 already has cron debt (R2 `analyze-batch`, R3 `keep-alive` — both NOT registered per audit). Adding TA pre-warm = 3rd cron. **Vercel Hobby allows only 2.** v1.0 must fix R1–R3 first; TA pre-warm must share a cron with one of v1.0's (combine keep-alive + TA pre-warm into one nightly endpoint that does both sequentially), or pay for Pro.

**Warning signs:** Langfuse daily Gemini count approaching 200 in Phase 11 traces; 429s in Vercel logs from `/api/chat` or `/api/ta/chat`; user reports of streaming explanations cutting off mid-sentence; TA endpoints showing higher P95 than v1.0 endpoints (queue contention).

**Prevention check:** **Before T4 planning begins** — read Langfuse, compute current Gemini RPD P95. If P95 > 150, T4 must default TA chat to Groq. If P95 > 200, T4 must also include SWR caching. If we don't have this data, **block T4** until Phase 11 has 7+ days of live traffic. Also: collapse cron strategy to ≤2 total before T4.

**Phase:** **T4** — but read Langfuse during T1/T2 to plan ahead

---

### A3: OJK regulatory edge cases — language patterns that trigger compliance issues

**What goes wrong:** v1.0 PITFALLS Pitfall 6 covered the broad OJK frame. v2.0 TA-specific high-risk patterns:

1. **Probability + horizon = implicit recommendation.** "Bullish: 42% over 10 days" is technically probabilistic, but reads as "high chance of going up = buy." OJK could argue this is decision-influencing content delivered for compensation (even free — the line is fuzzy).
2. **"Historical pattern" framing legitimizes pattern-trading as advice.** "This pattern historically resolved bullishly 58% of the time" frames TA as a working strategy. With TA's 45–55% expected accuracy (per seed), framing it confidently is misleading.
3. **Per-ticker pages create personalized-advice ambiguity.** `/ta/BBCA.JK` is generic content. The moment chat is added and the user asks "should I buy BBCA," even a deflection that includes the ticker name strengthens an OJK case for personalized advice.
4. **The model accuracy card** — if we show "Model accuracy: 52%" prominently, we're admitting predictions are barely better than chance, which is honest but could be cited if OJK ever asks why we publish predictions at all.

**Stockbit / RTI / Ajaib industry framing pattern** `[ASSUMED]`:
- Stockbit's "Insight" tab calls outputs "Analisis," never "Rekomendasi," even though community thesis posts make explicit calls.
- RTI shows "Sinyal Teknis" with inline "bukan rekomendasi" (not a recommendation).
- Ajaib frames AI features as "Pertimbangan" (consideration) and routes final decisions to "konsultasi dengan financial advisor."
- All three use "edukasi" (education) prominently in AI-feature framing.

**Safe language patterns:**
- "Pattern X is historically observed before…" (passive, descriptive) — safe.
- "In Y% of past occurrences, the price moved up/down Z%…" (historical, third-person) — safe.
- "Some traders interpret this pattern as…" (community attribution) — safe.

**Unsafe language patterns:**
- "Bullish signal" / "Bearish signal" — directional, even as a noun.
- "Expected return" — predictive, expectation language.
- "Probability of profit" — financial-product language with regulatory baggage.
- Any verb in 2nd-person directive.

**Mitigations:**
1. **Replace "signal" with "pattern" everywhere in UI copy.** Words shape mental models more than disclaimers.
2. **Frame probabilities as historical, not predictive.** "Bullish: 42%" → "Bullish outcome in 42% of similar historical cases (N=47, 2018–2024)." Uglier but defensible.
3. **Mandatory three-tier disclaimer** (seed design) — must include "educational" / "edukasi" prominently.
4. **Pre-launch legal sanity check** — for the cost of a one-hour consult, an Indonesian lawyer specializing in OJK reviews TA module UI copy + system prompt. Highest-ROI legal investment. Skipping because "we're free-tier" is exactly the pattern that lights up later.

**Warning signs:** "signal" appears in user-facing copy; model accuracy card displays without "experimental/educational" caveat; screenshot of TA page lands in retail-investing Telegram framed as buy/sell tool; user feedback "Stockbit recommended X based on Clarifin."

**Prevention check:** T2 acceptance — UI copy review pass against checklist: zero "signal," "expected return," "should," "recommend," or 2nd-person directive. T4 acceptance — external review of system prompt + UI copy by someone with OJK exposure.

**Phase:** **T2** (copy + prompt review); **T4** (external review)

---

## 4. Training

### D5: Look-ahead bias and data leakage in training data

**What goes wrong:** XGBoost classifier (T3) trained offline on 5yr IDX OHLCV with 10-day-forward-return labels. Common leakage:

1. **Adjusted close in features without point-in-time adjustment of labels.** `adjClose` *as of today* incorporates all past splits/dividends with hindsight. A dividend announced AFTER day T with ex-date in next 10 days will retroactively adjust `adjClose[T]`, leaking future-known info into the input feature. `[ASSUMED]`
   - **Fix:** use raw `close` for both features and labels, or carefully point-in-time-adjust (much harder).
2. **Sector encoding as of today, not at bar date.** Sector reclassifications happen (rare on IDX but real). Joining `ticker_metadata.sector` (today's value) to a 2020 bar leaks today's classification into 2020 training data.
3. **Market cap category as of today.** A 2020 small-cap that's a 2026 large-cap appears in training as large-cap. `cap_category` leaks.
4. **Label derived from data the model also sees.** If `rsi_bucket` at T is computed including day-T close, and label is 10-day forward return starting day T, no leakage. But if you mistakenly use day-T+1 RSI as feature ("RSI just after pattern"), you've leaked one day of future return.
5. **Survivorship bias** (D3 again) — delisted tickers absent from training. Model trained on survivors over-predicts bullish outcomes because bearish-resolved-to-zero cases are gone.

**General principle:** for every feature, ask — *could a trader have computed this exact value at the close of bar T, with only information available on bar T?* If no, the feature leaks.

**Standard mitigation:**
1. **Use raw close, not adjusted close, in both features and labels.** Document loudly in model card.
2. **Snapshot all metadata at bar date.** Build `ticker_metadata_history` table or use `created_at <= bar_date` join.
3. **Walk-forward cross-validation, not random k-fold.** Train on 2018–2022, validate on 2023, test on 2024. Random splits leak future info via temporal autocorrelation in returns.
4. **Include delisted tickers in training data.** Paid IDX historical archive if necessary; loss of survivorship correction is huge (5–15pp shift in bullish rate). At minimum, document the caveat in model card and UI's "Model accuracy: X%" card.
5. **Backtest sanity check:** average predicted bullish probability across the calibration set should approximately match empirical 10-day bullish rate in that period. If model predicts 50% average but period was 35%, something is leaking.

**Warning signs:** Calibration set ECE looks great but model "feels too good" — held-out 2024 accuracy suspiciously high (>60%); average predicted bullish probability ≠ empirical rate; predictions for delisted tickers (manually re-tested on archived data) are wrong directionally.

**Prevention check:** T3 acceptance — model card lists every feature with "point-in-time-safe?" checkbox. Walk-forward CV is the splitting strategy of record. Survivorship status documented (acknowledged limitation if delisted tickers not included). Empirical-vs-predicted-bullish-rate sanity test passes within 5pp.

**Phase:** **T3**

---

### D6: 2020–2021 bull-market dominance in training data

**What goes wrong:** Seed explicitly flags: "Model overfit to 2020–2021 bull market — Use 2015–2024 data; report out-of-sample accuracy." Indonesian retail-trading explosion + COVID-bounce rally inflated bullish outcomes for IDX in that window. A model trained on 5 years ending 2025 has ~40% of bars from this bull-dominated regime.

The model learns "RSI > 70 → still bullish" (true 2020–2021 momentum) which is broadly false in mean-reverting regimes (2018, 2022–2023).

**Mitigation:**
1. **Extend training window to 2015–2024 if available** — 9 years includes 2018 bear and 2022 drawdown. yahoo-finance2 may not have reliable IDX data that far back for all tickers; small caps sparse. Accept partial coverage for older bars.
2. **Regime stratification in evaluation** — report accuracy separately for bull (2020–2021), bear (2022), sideways (2018, 2023). If model is 60% in bull and 35% in bear, it's not a 50% accurate model — it's a regime-dependent gambler.
3. **Feature engineering for regime awareness** — include `market_regime` feature derived from IHSG (JCI) trend; e.g., `IHSG_above_200d_MA`. Lets model condition on regime.

**Phase:** **T3**

---

## 5. Process (Lessons from v1.0 audit applied to v2.0)

### P1: Verification paperwork debt — "code shipped, paperwork didn't" pattern

**What v1.0 showed:** 33/60 v1.0 requirements were "unsatisfied" on paper but the integration checker found almost everything wired in shipped code. **The verification debt was paperwork, not code.** Phases 6, 7, 9, 10, 12 — the highest-stakes user-visible surfaces — shipped without VERIFICATION.md. CHAT-06 (the most compliance-critical requirement) shipped and was never adversarially tested.

**Why:** Building forward feels productive; writing verification after the fact feels like overhead. Phase transitions skip verification under time pressure. No enforcement mechanism beyond the audit.

**v2.0 application — each TA phase must produce VERIFICATION.md before the next starts:**
- **T1 verifies:** indicator fixture test passes, OHLCV sanity-check on 3 corporate-action tickers passes
- **T2 verifies:** pattern marker count ≤10/year on illiquid set, UI copy contains zero "signal" instances, prompt sanitizer passes 10-prompt smoke
- **T3 verifies:** ONNX smoke test green in Vercel preview, ECE < 0.07 per class, model card documents survivorship + point-in-time decisions
- **T4 verifies:** 30-prompt adversarial red-team passes, Langfuse Gemini RPD measured + within budget, rate limiter tested under burst

**Prevention check:** Roadmap MUST gate T(n+1) planning on T(n) VERIFICATION.md existing on disk. No verbal "we'll do it later." The v1.0 audit is in-repo proof of what "later" produces.

**Phase:** Process-level — all phases

---

### P2: "Obvious in hindsight" launch blockers

**v1.0 pattern:** R1 (cron auth mismatch), R2 (no cron for `analyze-batch`), R3 (no cron for `keep-alive`), R4 (session ownership TODO). All four are <30-minute code fixes; all four launch-critical; all four caught only by audit, not by phase verification. **They cross phase boundaries** — cron auth is half `vercel.json` (infra) + half handler code (Phase 2). Session ownership is in `/doc/[id]/page.tsx` (Phase 7 UI) but a Phase 12 security concern. Single-phase verification can't catch cross-phase contracts.

**v2.0 equivalents likely to bite (predict the audit):**

| Predicted v2.0 launch blocker | Why it slips | Mitigation |
|---|---|---|
| **Vercel cron limit (2 free) exceeded** — v1.0 needs 2, T4 wants 1 = 3 total | Cross-phase: v1.0 paperwork debt (R2/R3) + T4 new cron. Each phase says "the other will handle it." | Roadmap pre-commits cron budget. If 3 needed, consolidate at T4 (combine keep-alive + TA pre-warm). |
| **ONNX model not in production bundle** | Cross-tier: Python trainer produces `.onnx`; Node runtime consumes; deploy pipeline must include. Easy to forget when tiers developed separately. | T3 acceptance includes Vercel preview deploy smoke. |
| **Bilingual forbidden-phrase list missing** — Indonesian `beli`/`jual`/`akumulasi` not in CHAT-06 list | v1.0 CHAT-06 was English-only; TA inherits. Nobody owns "make filter bilingual." | T2 explicitly extends CHAT-06 filter, re-tests v1.0 chat + new TA chat with bilingual prompts. |
| **`ohlcv_cache` unique index missing** | New table, single-phase responsibility (T1) — likely remembered. But `UNIQUE(ticker, date)` constraint is a common omission producing silent duplicate rows. | T1 migration includes unique constraint and smoke test inserts same row twice to verify rejection. |
| **`pattern_outcome_log.actual_*_return` never populated** | T3 ships schema. T4 owns the cron. Cron easily deferred. Without it, "model accuracy" in UI becomes stale. | T4 ships populate-cron with backfill query for NULL rows. |
| **Session ownership in TA viewing** | v1.0 R4 leaked signed PDF URLs. TA equivalent: chat history at `ta_session_views` keyed on `session_token`. If anyone with another's token can view chat — leak. | T4 acceptance: session-isolation test (User A creates chat, User B attempts view → 403). |
| **Disclaimer not adjacent to specific high-risk numbers** | v1.0 DISCLAIM-01 was "adjacent to score." TA equivalent: probability panel needs inline disclaimer next to "Bullish: 42%." Easy to put page-top banner and call it done; OJK risk if disclaimer scrolls out of view. | T2 acceptance: visible disclaimer within 100px of probability panel at 1080p. |
| **Gemini quota collision detected only at peak load** | v1.0 untested. T4 will likely dev-test with 1 user. Production Indonesian market hours surfaces it. | T4 synthetic burst test: 30 req/min for 5 min, assert <5% 429 rate or graceful Groq fallback. |

**Prevention check:** Roadmap includes an explicit **pre-launch audit pass** between T4 completion and public launch, modeled on the v1.0 audit. Specifically looks for cross-phase contracts. Budget 2–4 hours.

**Phase:** Process-level — roadmap design

---

### P3: HUMAN-UAT debt accumulates and ages out

**v1.0 pattern:** Phase 8 HUMAN-UAT started 2026-05-19, still partial at v1.0 close (18 days stale). Interactive UAT tests are "ready" but require human time at a moment when the human is moving forward.

**v2.0 application:** T2 (patterns + explanation) and T4 (chat) both have heavy interactive content benefiting from real-user observation:
- T2: does a non-finance user understand "Bullish Engulfing" from the tooltip without external explanation?
- T4: does a Stockbit user perceive the AI explanation as actionable advice or as analysis?

If these UAT tests aren't run, the wedge — "plain-English explanation that builds trust" — is unverified.

**Prevention check:** T2 and T4 each include a 1-hour UAT slot with 2 non-developer Jakarta-based users (recruited informally). UAT must complete within 7 days of phase code completion; otherwise the phase rolls back to "not closed" status.

**Phase:** Process-level — T2 and T4 acceptance

---

## 6. Pitfall-to-Phase Mapping

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

**Per-phase summary:**
- **T1 owns:** D3 (OHLCV cleaning), C2 (indicator fixture). Foundational — every downstream phase trusts T1's outputs.
- **T2 owns:** D1 (pattern noise), C3 (Recharts perf), A1 (sanitizer + system prompt), A3 (UI copy review), P3 (UAT round 1). User-visible quality bar set here.
- **T3 owns:** D2 (calibration), C1 (ONNX deploy), D5 (training leakage), D6 (regime overfit). Math-correctness bar.
- **T4 owns:** A1 (red-team), A2 (quota + cron + rate limiting), A3 (external review), P3 (UAT round 2). Launch-readiness bar.
- **All phases own:** P1 (verification paperwork) + P2 (predict the audit) — process.

---

## Open Questions Requiring Other Inputs

- Langfuse traffic data (need 7+ days of v1.0 live) before T4 planning
- Trivial-model Vercel-preview ONNX smoke (before T3 commits to ONNX)
- IDX delisted-ticker historical OHLCV availability (for D5 survivorship)
- v1.0 CHAT-06 code inspection (English-only or bilingual?) — `src/app/api/chat/route.ts:116`

---

## Sources

### Primary (HIGH confidence — in-repo artifacts)
- `.planning/PROJECT.md`
- `.planning/seeds/ta-module-standalone.md`
- `.planning/notes/ta-module-design-decisions.md`
- `.planning/research/questions.md`
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- `.planning/milestones/v1.0-research/PITFALLS.md`
- `CLAUDE.md`

### Secondary (training-knowledge-based, tagged `[ASSUMED]`)
- General XGBoost calibration practice (sklearn docs)
- General `technicalindicators` library bug-class patterns
- General Recharts performance characteristics
- General `onnxruntime-node` Vercel deploy gotchas
- General OJK regulatory framing (Indonesian retail-investing industry observations)

---

## RESEARCH COMPLETE
