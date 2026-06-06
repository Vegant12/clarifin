# Clarifin v2.0 TA Module — Feature Research

**Researched:** 2026-06-06
**Domain:** Technical Analysis UX for the English-fluent, non-finance-trained Indonesian retail investor
**Confidence:** MEDIUM (training-knowledge based; external retail-tool comparison was blocked — see Assumptions Log)

> **Tool-access note:** WebSearch, WebFetch, and Write were denied to the subagent in the session that produced this document. Claims about Stockbit / RTI Business / TradingView / weather-app / election-prediction UX patterns are tagged `[ASSUMED]` and derived from prior training. All such claims are itemised in the Assumptions Log so the requirements-definer can flag any that need user confirmation before they harden into REQ-IDs.

---

## Summary

The v2.0 TA module's audience is the **same person v1.0 served** (English-fluent Indonesian professional, non-finance-trained, opens IDX charts but doesn't know what they're seeing) — not a day-trader. That single fact reshapes the feature shortlist: a lot of "table stakes for TA tools" is actually anti-features for *this* audience, because it serves traders, not the fundamentals-curious-broadened-to-technicals persona that v2.0 inherits from v1.0.

The seed's section 9 layout (chart + 3-column analysis panel + chat) is structurally right. What it under-specifies is **interaction discipline**: which chart interactions earn screen real estate, how patterns become intelligible to someone who can't yet read a chart, and how probability output is framed so users don't over-read or dismiss it. This research validates the seed's 4-phase shape (T1 Indicators → T2 Patterns + Explanation → T3 ML Probability → T4 Polish) and identifies six categories of features the requirements-definer should turn into REQ-IDs: CHART, INDICATOR, PATTERN, PROBABILITY, CHAT-TA, and DISCLAIM-TA.

**Primary recommendation:** Ship a deliberately *constrained* chart UX (5 indicators on default, no custom indicator builder, no save/share, no alerts), invest heavily in plain-English pattern names + historical context cards, and treat the probability widget as the centerpiece that everything else explains — not a sidebar artifact.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Candlestick chart rendering | Browser / Client | — | SVG/canvas chart libs are client-side |
| Range selector + overlay toggles | Browser / Client | — | Pure UI state |
| OHLCV ingestion (yahoo-finance2) | API / Backend | Database (cache) | `yahoo-finance2` is server-only per CLAUDE.md |
| Indicator computation | API / Backend | — | `technicalindicators` npm runs server-side |
| Candlestick + chart pattern detection | API / Backend | — | Deterministic; cached |
| ONNX probability inference | API / Backend | — | `onnxruntime-node`; <100ms |
| Gemini explanation (streaming) | API / Backend | Browser (stream consumer) | Reuses Phase 6/10 Vercel AI SDK pattern |
| Pattern explanation cards | Browser / Client | — | Static React once data is in state |
| Follow-up chat | API / Backend | Browser (`useChat`) | Reuses Phase 10 chat infra |
| Disclaimer rendering | Browser / Client | — | Reuses Phase 12 DISCLAIM-01 |
| Rate limiting | API / Backend | — | Reuses Phase 12 INFRA-02 |
| Nightly pre-warm | Cron (Vercel) | API / Backend | Reuses Phase 12 cron pattern |

---

## 1. Table Stakes (must-haves for any usable v2.0)

Complexity: **S** (<1 day), **M** (2–4 days), **C** (1–2 weeks).

### 1.1 Candlestick Chart (CHART category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-CHART-01 | Candlestick rendering (OHLC bars, green/red coloring) | M | None (chart-lib decision) | T1 |
| TS-CHART-02 | Volume subpanel (bars colored by up/down day) | S | None | T1 |
| TS-CHART-03 | Range selector: 1M / 3M / 6M / 1Y / 2Y preset buttons | S | None | T1 |
| TS-CHART-04 | Hover tooltip: date, OHLCV values | S | None | T1 |
| TS-CHART-05 | Zoom + pan (wheel/drag desktop, pinch mobile) | M | None | T1 |
| TS-CHART-06 | Crosshair on hover (vertical + horizontal lines) | S | None | T1 |
| TS-CHART-07 | Loading skeleton + error state for invalid ticker | S | Reuses Phase 9 STOCK-* error patterns | T1 |
| TS-CHART-08 | Sparse-data state (new IPO with <30 candles) | S | None | T1 |
| TS-CHART-09 | Pattern markers overlaid on chart (▲ ▼ ◆) | M | None | T2 |
| TS-CHART-10 | Click pattern marker → opens explanation card | S | None | T2 |

**Chart-library decision (deferred to /gsd-research-phase for T1):** Recharts v3 (in v1.0 stack) does NOT natively render candlesticks. Options: (a) custom Recharts OHLC series, (b) `lightweight-charts` (TradingView OSS), (c) ECharts. Phase-research, not milestone-research. `[ASSUMED A8]`

### 1.2 Indicator Display (INDICATOR category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-IND-01 | RSI(14) subpanel with 30/70 reference lines | S | None | T1 |
| TS-IND-02 | MACD(12,26,9) subpanel with histogram | S | None | T1 |
| TS-IND-03 | Bollinger Bands(20, 2σ) as price overlay toggle | S | None | T1 |
| TS-IND-04 | EMA-20 / EMA-50 / EMA-200 overlay toggles | S | None | T1 |
| TS-IND-05 | Indicator snapshot strip (one-line direction per indicator) | M | None | T1 |
| TS-IND-06 | Plain-English interpretation hint per indicator | M | Reuses v1.0 plain-English voice + PSAK glossary pattern | T2 |
| TS-IND-07 | Overlay toggle controls (chips) | S | None | T1 |

**Default-on overlays:** EMA-50 + EMA-200 (trend context). **Default-off:** Bollinger Bands + EMA-20 (clutter). **Always-on subpanels:** Volume, RSI, MACD. `[ASSUMED A2/A8]`

### 1.3 Pattern Detection Presentation (PATTERN category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-PAT-01 | Detected pattern sidebar list (name, label, type icon) | M | None | T2 |
| TS-PAT-02 | Pattern marker positioned at detected candle range | M | Chart-lib choice | T2 |
| TS-PAT-03 | Explanation card: plain-English name + 1-line definition + 1-line historical context with sample size | C | Reuses v1.0 explanation voice | T2 |
| TS-PAT-04 | Pattern taxonomy badge (Bull reversal / Bear reversal / Continuation / Neutral) | S | None | T2 |
| TS-PAT-05 | Historical stats row (per seed §4 `historical_stats` shape) | M | None | T2 |
| TS-PAT-06 | Empty state: "No patterns detected" — explicit | S | None | T2 |
| TS-PAT-07 | Auto "small sample" caveat when N < 30 IDX occurrences | S | None | T2 |

### 1.4 Probability Output (PROBABILITY category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-PROB-01 | Three-bar widget: Bullish / Neutral / Bearish with percentage labels | M | None | T3 |
| TS-PROB-02 | Random-baseline (33%) reference line on each bar — shows lift over chance | M | None | T3 |
| TS-PROB-03 | Explicit horizon label ("10-day forward outlook") | S | None | T3 |
| TS-PROB-04 | Sample-size note: "Based on N similar contexts on IDX (date range)" | S | None | T3 |
| TS-PROB-05 | Confidence tier badge (Low / Med / High) | M | None | T3 |
| TS-PROB-06 | Model-accuracy card: "Right N% of the time on out-of-sample IDX 2024" — visible, not hidden | M | None | T3 |
| TS-PROB-07 | Widget-attached disclaimer ("historical frequencies, not predictions") | S | Reuses DISCLAIM-01 | T3 |

### 1.5 AI Explanation (EXPLAIN-TA category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-EXP-01 | Streaming 3-paragraph explanation (what's on chart / historical context / risks & counter-signals) | C | Reuses Phase 6 streaming pattern | T2 |
| TS-EXP-02 | Inline jargon definitions (hover/click for meaning) | M | Reuses PSAK glossary pattern from Phase 10 | T2 |
| TS-EXP-03 | Conflicting-signals callout when patterns vs indicators disagree | M | None | T2 |
| TS-EXP-04 | Always-appended page-level disclaimer | S | Reuses DISCLAIM-01 | T2 |
| TS-EXP-05 | LLM output sanitization (forbidden phrases stripped/replaced) | M | **Reuses Phase 10 CHAT-06 filter** | T2 |

### 1.6 Follow-up Chat (CHAT-TA category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-CHT-01 | Chat input below analysis panel | S | **Reuses Phase 10 `useChat` UI** | T4 |
| TS-CHT-02 | Retrieval set = detected patterns + indicator snapshot + recent OHLCV summary (NOT the document corpus) | C | New retrieval logic, Phase 10 plumbing | T4 |
| TS-CHT-03 | Buy/sell hard-block on chat input | S | **Reuses Phase 10 CHAT-06 `isInvestmentAdviceQuery`** | T4 |
| TS-CHT-04 | Streaming response with trailing disclaimer | S | Reuses Phase 10 patterns | T4 |
| TS-CHT-05 | Suggested-prompts strip (education-only: "Explain RSI", "What is a Doji?") | S | None | T4 |
| TS-CHT-06 | Session token reuse across TA + document chat | S | Reuses Phase 10 session pattern | T4 |

### 1.7 Disclaimers (DISCLAIM-TA category)

| # | Feature | Complexity | v1.0 Dependency | Phase |
|---|---------|-----------|-----------------|-------|
| TS-DIS-01 | Page-header banner "Educational analysis only" | S | Reuses DISCLAIM-01 | T2 |
| TS-DIS-02 | Per-output disclaimer attached to AI explanation | S | Reuses DISCLAIM-01 | T2 |
| TS-DIS-03 | Always-visible full legal disclaimer below-fold | S | Reuses DISCLAIM-01 | T2 |
| TS-DIS-04 | First-time TA visitor onboarding modal ("What this tool does / doesn't do") | M | Reuses Phase 12 DISCLAIM-03 onboarding pattern | T2 |

---

## 2. Differentiators (what makes Clarifin TA distinct)

Every commercial Indonesian retail-investing app *does* technicals; none of them *explains* technicals plainly. `[ASSUMED A1]`

### 2.1 Plain-English Pattern Names + Education

| # | Feature | Complexity | Why It Differentiates |
|---|---------|-----------|------------------------|
| DIFF-01 | Pattern names rendered in plain-English + Bahasa Indonesia side-by-side with 1-line "what this means" caption | M | Competitors show "Bullish Engulfing" as a label and stop; user has to Google. `[ASSUMED A1, A9]` |
| DIFF-02 | "How this pattern works" expandable with inline idealized-shape diagram | C | Closest thing to *teaching* the user to read a chart |
| DIFF-03 | Glossary tooltips on every TA term in AI output | M | Low-cost port of v1.0 PSAK glossary to TA vocabulary |

### 2.2 Honest Probabilistic Framing

| # | Feature | Complexity | Why It Differentiates |
|---|---------|-----------|------------------------|
| DIFF-04 | Probability widget shows the 33% random baseline — users see *lift over chance*, not "42% bullish!" | M | This honest framing IS the differentiator. `[ASSUMED A10]` |
| DIFF-05 | Sample-size disclosure on every probabilistic claim ("47 similar contexts since 2018") + auto small-sample caveat under N<30 | S | The trust contract |
| DIFF-06 | Model-accuracy card displayed prominently ("Right 52% on out-of-sample IDX 2024") | M | Anchors expectations honestly |
| DIFF-07 | "Counter-signals" section in AI explanation when patterns/indicators disagree | M | Truthful for noisy real charts |

### 2.3 Audience-Aware Defaults

| # | Feature | Complexity | Why It Differentiates |
|---|---------|-----------|------------------------|
| DIFF-08 | Default chart view shows fewer indicators (volume + RSI + MACD + 2 EMAs) — beginner-readable | S | Less is more for this audience. `[ASSUMED A2, A3]` |
| DIFF-09 | Indicator snapshot strip translates raw values into plain-English direction ("MACD: Bullish crossover yesterday" not "MACD: 1.23 / 0.98 / 0.25") | M | Raw values mean nothing to non-traders |
| DIFF-10 | Suggested chat prompts default to *learning* questions, not *trading* questions | S | Reinforces positioning: learning surface, not signal surface. `[ASSUMED A11]` |

### 2.4 Reuse of v1.0 Trust Infrastructure

| # | Feature | Complexity | Why It Differentiates |
|---|---------|-----------|------------------------|
| DIFF-11 | Single session token shared across `/doc/*` and `/ta/*` | S | Reuses Phase 10 session-restore; coherent product across two surfaces |
| DIFF-12 | Cross-surface link: "You also analyzed `BBCA Annual Report 2023` — view fundamentals" when both exist for a ticker | M | Knits v1.0 and v2.0 without coupling at data-model level |
| DIFF-13 | Same disclaimer voice + same buy/sell guardrail across both surfaces | S | Consistent compliance posture |

---

## 3. Anti-Features (DO NOT build in v2.0)

### 3.1 Wrong-Audience Features

| Feature | Why It's an Anti-Feature |
|---------|--------------------------|
| Level-2 order book / market depth | Day-trader feature; audience holds for weeks; also requires paid feed |
| Time-and-sales / tick-by-tick | Day-trader instrument |
| Drawing tools (trendlines, Fibonacci, Gann) | Assume user already reads charts — they don't. `[ASSUMED A4]` |
| Custom indicator builder / Pine Script equivalent | Power-user feature; wrong audience |
| Indicator templates / save chart layouts | Implies repeated complex setup |
| Lesser-known indicators (DEM, RSL, Ichimoku, Vortex, KST, Aroon) | Add cognitive load without earning explanation budget; stick to seed §5 set |
| Multi-pane / multi-chart layouts | Maximalist UI |
| Heatmaps / sector rotation views | Multi-stock comparison (excluded below) |

### 3.2 Out-of-Scope Per Seed §1

| Feature | Why It's Excluded |
|---------|--------------------|
| Alerts / push notifications | Hard non-requirement; requires watchlist + persistent infra |
| Multi-stock comparison | Hard non-requirement; compounds complexity |
| Portfolio tracking / watchlists | Hard non-requirement; pulls into "portfolio management" |
| Backtesting UI | Power-user; introduces strategy-building mental model |
| Paper trading / simulated trades | Wrong mental model; product is analysis, not practice |
| Buy / sell / "should I" verdicts | Hard non-requirement; CHAT-06 already blocks |
| Price targets / stop-loss / position sizing | Hard non-requirement |
| Real-time data | Per Decision 3 (EOD only) |
| Auto-fetch fundamentals when entering a TA ticker | Standalone-module Decision 1; only a *link* between surfaces (DIFF-12), not auto-merging |

### 3.3 Budget-Excluded

| Feature | Why It's Excluded |
|---------|--------------------|
| Real-time IDX feed | Paid only |
| TradingView premium embed | Per-user licensing |
| Multi-LLM routing beyond Gemini → Groq fallback | Vendor complexity; not yet proven needed |

---

## 4. Feature-to-Phase Mapping Suggestion

Roadmap: T1 = Phase 13, T2 = Phase 14, T3 = Phase 15, T4 = Phase 16.

### Phase T1 — Data & Indicators (Phase 13)

| Category | REQ-IDs (proposed) | Notes |
|----------|--------------------|-------|
| INGEST-TA | OHLCV fetch + `ohlcv_cache` upsert | Reuses Phase 9 yahoo-finance2 client |
| TICKER-TA | Ticker autocomplete `/api/ta/search` | New; seed from IDX ticker list |
| CHART | TS-CHART-01..08 | Chart-lib decision in phase-research |
| INDICATOR | TS-IND-01..05, TS-IND-07 | Plain-English hint (TS-IND-06) defers to T2 |
| DISCLAIM-TA | TS-DIS-01, TS-DIS-03 | Bare-minimum scaffolding |

**Done when:** BBCA.JK / TLKM.JK / GOTO.JK render with candlestick + volume + RSI + MACD + EMA overlays + range selector + ticker search.

### Phase T2 — Patterns & Explanation (Phase 14)

| Category | REQ-IDs | Notes |
|----------|---------|-------|
| PATTERN | TS-PAT-01..07 + DIFF-01..03 | Rule-based per seed §6 |
| CHART | TS-CHART-09, TS-CHART-10 | Marker rendering depends on PATTERN |
| INDICATOR | TS-IND-06 | LLM-driven |
| EXPLAIN-TA | TS-EXP-01..05 | Reuses Phase 6 streaming + **Phase 10 CHAT-06 sanitization** |
| DISCLAIM-TA | TS-DIS-02, TS-DIS-04 | Per-output + onboarding modal |
| DIFF | DIFF-07 | Counter-signals in LLM prompt |

**Done when:** Patterns detected + explained for BBCA/TLKM/GOTO with sanitization passing.

### Phase T3 — ML Probability Layer (Phase 15)

| Category | REQ-IDs | Notes |
|----------|---------|-------|
| ML-PIPELINE | XGBoost offline training, ONNX export, startup hash check | Pre-blocked by Q1 + Q2 |
| ML-INFERENCE | `onnxruntime-node`, <100ms | Per seed §7 |
| PROBABILITY | TS-PROB-01..07 + DIFF-04..06 | Centerpiece; not sidebar |
| OUTCOME-LOG | `pattern_outcome_log` + nightly cron for `actual_*_return` | Per seed §3 |

**Done when:** Probability widget renders with random-baseline marker, sample-size, calibration metric, and model-accuracy card from out-of-sample 2024 backtest.

### Phase T4 — Polish (Phase 16)

| Category | REQ-IDs | Notes |
|----------|---------|-------|
| CHAT-TA | TS-CHT-01..06 + DIFF-10 | **Reuses Phase 10 chat infra** with new retrieval set |
| INFRA-TA | Nightly pre-warm cron for top 50 IDX tickers | Reuses Phase 12 Vercel Cron |
| INFRA-TA | Per-IP and per-session rate limiting | **Reuses Phase 12 INFRA-02** |
| OBS-TA | Langfuse instrumentation on TA endpoints | **Reuses Phase 11 OBS-01** |
| DIFF | DIFF-11, DIFF-12, DIFF-13 | v1.0 ↔ v2.0 bridges |
| RESPONSIVE | Mobile layout for `/ta/{ticker}` | Same 375px tab-fallback as v1.0 |

**Done when:** All cross-cutting concerns from v1.0 extended to TA — observability, rate-limiting, cron warmup, mobile, session continuity, follow-up chat.

---

## 5. Audience-Specific UX Notes for the Non-Finance Target User

### 5.1 The user can't read a chart yet

They opened a Stockbit chart, saw candles, and bounced. The TA module's first job is to make the chart *legible* — **constrained defaults**, **explanation-on-hover**, strict information hierarchy with plain-English captions next to every visual primitive. Justifies the anti-features list: drawing tools and custom indicators don't help a user who can't read OHLC bars yet. `[ASSUMED A3]`

### 5.2 Patterns must be intelligible, not just detected

Showing "Bullish Engulfing detected at index 142" is useless. What turns this into *understanding*:

1. Plain-English name + ID-language name (DIFF-01)
2. One-sentence definition ("two candles where today's body engulfs yesterday's")
3. Historical context ("on IDX, this pattern resolved bullishly 54% of the time across 81 occurrences since 2018")
4. Sample-size caveat auto-attached at N<30
5. Idealized inline diagram (DIFF-02) — user starts learning the shape over time

Without (3) and (4), the pattern label is theatre. With them, the user gets *honest education*.

### 5.3 Probability framing rules

Hardest UX problem in v2.0 — how to make "42% bullish" mean what it should mean. Three guardrails:

1. **Always show the random baseline** (33% for 3-class). User who sees "42%" next to "33% chance from random guessing" marker understands the model claims modest lift, not certainty. `[ASSUMED A6, A10]` — borrowed from how election-forecast UIs (FiveThirtyEight-style) and weather apps frame probability.
2. **Always show sample size** at the same visual weight as the percentage. "42% bullish based on 12 cases" should *feel different* from "42% bullish based on 412 cases."
3. **Always show model accuracy** (DIFF-06). Without it, users either over-trust ("model said 42%, vote of confidence") or dismiss ("just numbers"). With it, they recalibrate to "this model is right about half the time, so 42% means slightly tilted bullish in a noisy domain."

### 5.4 Chat is education, not signal

v1.0 chat answers "what does this filing say?" — TA chat answers "what does this chart mean / how do these indicators work?" not "should I buy this?" That is the difference between a teacher and a tipster. The suggested-prompts strip (TS-CHT-05) anchors the surface toward the teacher framing. `[ASSUMED A11]`

**Critical retrieval difference vs Phase 10:**
- **Phase 10 retrieval:** Top-K chunks from uploaded PDF embedded into pgvector
- **TA chat retrieval:** Detected patterns (list + metadata) + indicator snapshot (current values + interpretations) + summary of recent N candles (e.g., last 20 days OHLCV compressed)

There is no embedding store for TA — the context is small, structured, and rebuilt fresh per session. **Do NOT reuse `match_document_chunks`** — only reuse `useChat` UI and the CHAT-06 guardrail.

### 5.5 Disclaimers carry the compliance contract

Three-tier framework + onboarding modal:
1. Page-header banner — always visible
2. Per-output disclaimer — attached to every AI block (explanation, probability widget, pattern card, chat response)
3. Below-fold full legal disclaimer — present, scannable, not behind an accordion (v1.0 deliberate choice in Phase 12)
4. TS-DIS-04 first-time onboarding modal — 3-bullet "what this tool does / doesn't do" intercept before user sees a single chart marker. `[ASSUMED A12]`

### 5.6 The WhatsApp screenshot test

If a screenshot of a Clarifin TA page were shared on WhatsApp / Telegram (very common Indonesian retail-investor distribution channel `[ASSUMED A5]`), would a reader mistake it for advice? If yes, the framing has failed. This is the single user-test question that should govern every PROBABILITY and EXPLAIN-TA decision.

---

## 6. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Candlestick rendering | Custom SVG OHLC bars | `lightweight-charts` (TradingView OSS) or `react-financial-charts` | Crosshair, zoom, pan, dynamic axis have subtle bugs. `[ASSUMED A8]` |
| Indicator math | Reimplement RSI/MACD/BB | `technicalindicators` npm (already chosen in seed) | Edge cases tested |
| Candlestick pattern detection | Custom rules for all 12 patterns | `technicalindicators` pattern functions where available; rule-code only what isn't covered | `[ASSUMED A7]` — library coverage may be incomplete |
| Ticker autocomplete | Custom fuzzy match | In-memory Fuse.js index over ~800 IDX tickers | Fits in memory; no DB query |
| Probability calibration | Hand-tune sigmoid output | sklearn `CalibratedClassifierCV` with Platt scaling | Q2 flags this; tested calibration matters for trust |
| Buy/sell guardrail | Re-implement keyword check | **Reuse Phase 10 CHAT-06** | Same filter, no divergence |
| Disclaimer rendering | Custom modal/banner | **Reuse Phase 12 DISCLAIM-01 / DISCLAIM-03** | Single source for legal language |

**Key insight:** A huge fraction of v2.0 is *reuse* of v1.0 components, not new construction. Treating that reuse as the first-class plan structure (rather than rebuilding parallel disclaimer / chat / observability for TA) is the highest-leverage architectural posture.

---

## 7. Common Pitfalls

### Pitfall 1: Treating TA like a separate product instead of a sibling surface
**What goes wrong:** Plans build parallel disclaimer / chat / observability / rate-limiting for TA, doubling v1.0 footprint and creating drift.
**Avoid:** Make REUSE explicit in REQ-IDs — every TA REQ with a v1.0 counterpart references it (e.g., "TS-CHT-03 reuses Phase 10 CHAT-06").

### Pitfall 2: Maximalist chart UX
**What goes wrong:** "But TradingView shows X" leads to drawing tools, custom indicators, multi-pane. Product becomes "TradingView with explanations" — a worse TradingView.
**Avoid:** Anchor every chart-UX decision to the "Can't read a chart yet" persona. If the feature assumes chart fluency, defer it.

### Pitfall 3: Probability widget that reads as a verdict
**What goes wrong:** "Bullish: 42%" rendered without baseline + sample size + model accuracy reads exactly like "BUY signal."
**Avoid:** Treat random baseline + sample size + model accuracy as *required* visual peers to the percentage bar, not secondary annotations.

### Pitfall 4: TA chat retrieval wholesale reuses document-RAG plumbing
**What goes wrong:** Phase 10 RAG retrieves chunks from embedded documents. TA chat has *no document* — it has structured pattern/indicator state. Forcing this into embed-retrieve wastes Gemini quota on embedding TA snapshots that never need vector search.
**Avoid:** TA chat retrieval is **prompt assembly from structured context**, not embed-search. Reuse `useChat` UI + CHAT-06; do NOT reuse `match_document_chunks`.

### Pitfall 5: Pattern markers with no education path
**What goes wrong:** Marker shown, pattern named, no explanation accessible. User sees "Bullish Engulfing" and gains nothing.
**Avoid:** Every detected pattern marker has a 1-click path to (a) what the pattern is, (b) historical resolution stats, (c) sample-size caveat. No marker without explanation.

### Pitfall 6: Gemini quota compounding (Q3)
**What goes wrong:** TA explanation + TA chat stack on existing v1.0 load, hit 250 RPD at peak hours, both surfaces degrade.
**Avoid:** Quantify Phase 11 observability data BEFORE shipping T2. Plan Groq/Llama 3.3 fallback for TA chat by default; reserve Gemini for explanation generation.

### Pitfall 7: New IPO / low-data tickers
**What goes wrong:** Ticker with <30 candles → indicators mostly NaN, no patterns, empty probability widget. Without explicit handling, page looks broken.
**Avoid:** TS-CHART-08 — explicit sparse-data state: "This stock has too little price history (N trading days) to compute reliable technical indicators."

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stockbit / RTI Business / TradingView present pattern names without inline definitions | DIFF-01 | Differentiator framing weakens if competitors already do plain-English education |
| A2 | Default TradingView layout is dense/maximalist for beginners | DIFF-08, §5.1 | Post-2024 redesigns may have changed this |
| A3 | "Constrained chart UX" is what the audience wants vs maximalist | §5.1, anti-features | UX assumption — validate with user testing post-T1 |
| A4 | Drawing tools (trendlines, Fib) are anti-features for this audience | §3.1 | If audience grew into chart fluency over v1.0 usage, this could change |
| A5 | WhatsApp/Telegram screenshot-sharing is common Indonesian retail-investor distribution | §5.6 | If untrue, "screenshot test" framing for compliance is less load-bearing |
| A6 | Weather / election-prediction UIs are the right precedent for probability framing | §5.3 | Plausible but not directly verified for Indonesian audiences |
| A7 | `technicalindicators` npm covers the 12 candlestick patterns in seed §6.1 | Don't Hand-Roll | If library coverage incomplete, more rule-code needed; affects T2 effort estimate |
| A8 | `lightweight-charts` is the right chart-library default | §1.1, Don't Hand-Roll | Phase-research will revisit |
| A9 | Bahasa Indonesia pattern names are well-defined / standardized for the 12 candlestick patterns | DIFF-01 | If names aren't standardized in ID retail vocabulary, "side-by-side" framing needs adjustment |
| A10 | Random baseline + sample size + model accuracy together prevent over-trust | §5.3 | Behavioral-design claim is plausible but untested with this audience |
| A11 | Suggested-prompts strip nudges users away from buy/sell questions | DIFF-10, §5.4 | If users still ask directional questions, CHAT-06 still catches them — but the nudge value is assumed |
| A12 | First-time onboarding modal effectively re-anchors expectations | TS-DIS-04 | Phase 12 DISCLAIM-03 shipped this pattern for v1.0; assumed to transfer |

**If any A-tagged claim is overturned during /gsd-discuss-phase, the affected REQ-IDs need to be revisited.** Most assumptions sit in the differentiator section — failure weakens positioning but doesn't block shipping.

---

## Open Questions (for /gsd-discuss-phase)

1. **Chart library decision** (Recharts extension vs `lightweight-charts` vs ECharts). Defer to T1 phase-research.
2. **Bahasa Indonesia pattern naming convention.** Do standard ID names exist for the 12 candlestick patterns, or do Indonesian retail investors prefer borrowed-English ("Doji", "Engulfing")? Surface during /gsd-discuss-phase.
3. **Suggested-prompts strip content seed** — ticker-agnostic ("What is RSI?") vs ticker-aware ("Why is BBCA's RSI high?"). Defer to T4 planning.
4. **Pre-warm cron target list source of truth** — LQ45 + IDX30, market-cap-ranked, or most-viewed in v1.0 fundamentals usage? Resolve during T4 planning.
5. **Mobile interaction degradation** — candlestick + pattern markers at 375px or tablet-up gate? Phase-research during T1.

---

## RESEARCH COMPLETE
