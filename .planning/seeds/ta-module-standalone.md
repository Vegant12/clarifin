---
title: "ClarifIn TA — Technical Analysis & Market Prediction Module"
trigger_condition: "v2+ exploration only. Do not start before v1 has been live for ≥60 days AND a measurable user signal exists requesting TA. v1 explicitly excludes TA per REQUIREMENTS.md Out of Scope."
planted_date: "2026-06-06"
status: seed
priority: low
scope_conflict: true
---

# ClarifIn TA — Technical Analysis & Market Prediction Module
### Design Document · v0.1 · June 2026

> **⚠ Scope Conflict — Read First**
>
> This seed describes a feature that is **explicitly excluded** from Clarifin v1:
>
> | Source | Exclusion |
> |---|---|
> | `CLAUDE.md` § Scope discipline | "Resist scope creep toward auto-fetch, multi-stock comparison, portfolio features, or advice" |
> | `.planning/REQUIREMENTS.md` § Out of Scope | "Technical analysis indicators (RSI, MACD, candlesticks, volume profiles) — Different mental model — serves traders, not the fundamentals-curious beginner persona" |
>
> This seed exists because the design was developed during a `/gsd-explore` session as a forward-looking exercise. It is **NOT a commitment to build**. Before any planning work begins, the team must explicitly re-open the scope decision in PROJECT.md and amend REQUIREMENTS.md. The wedge ("doc → understanding for non-finance professionals") is incompatible with TA's mental model.
>
> Keep this seed as v2+ optionality. Do not promote it to a phase without an explicit scope-amendment decision.

---

A standalone module (separate from the document-upload core) that lets IDX retail investors
enter a ticker, see a candlestick chart with computed indicators, detect technical patterns,
and receive a probabilistic outlook with plain-English AI explanations.

**Four design decisions crystallised during exploration** (see `.planning/notes/ta-module-design-decisions.md`):
- Standalone (not tied to document upload sessions)
- Probabilistic output only — no directional buy/sell calls
- End-of-day data (yahoo-finance2, free, IDX `.JK` tickers)
- Rule-based pattern detection + gradient boosting (ONNX) + Gemini explanation

---

## 1. Product Requirements

### Target User
Urban Indonesian professional, 25–45, trades IDX stocks occasionally, uses charting tools
but can't interpret what they're seeing. English-fluent, non-finance-trained.

**Persona mismatch warning:** This is a DIFFERENT user from the Clarifin v1 persona ("the fundamentals-curious beginner who can't read a balance sheet"). TA users are traders, not investors. Shipping both products under the same brand creates a positioning conflict.

### Core User Stories

| # | Story | Acceptance Criteria |
|---|---|---|
| U1 | Enter ticker, see candlestick chart with indicators | Renders < 1.5s (cached), < 4s (fresh) |
| U2 | See detected patterns with plain-English names | Markers on chart, hover tooltips |
| U3 | Understand historical probabilities for this pattern | Distribution shown with sample size + date range |
| U4 | Read plain-English AI explanation of the full picture | Gemini streaming, no unexplained jargon |
| U5 | Ask follow-up questions | Chat input over pattern/indicator context |
| U6 | Trust this is analysis, not advice | Disclaimer always visible, non-dismissible |

### Hard Non-Requirements (v1 of this module)
- No buy/sell/hold language anywhere
- No price targets, stop-losses, position-sizing
- No portfolio tracking or watchlists
- No alerts or push notifications
- No real-time data (EOD only)
- No multi-stock comparison

### Compliance Framework
1. **Keyword block**: scan output for `buy`, `sell`, `invest`, `recommend`, `will rise`, `will fall`
2. **Probabilistic framing**: all predictions as `P(outcome | pattern, context)`, never certainties
3. **Mandatory disclaimer**: appended to every AI response; visible at page level without scroll

This compliance framework mirrors and reuses the post-processing filter already in place
for `CHAT-06` (Phase 10 chat hard-block on buy/sell language) — see Phase 10 SUMMARY.

---

## 2. Technical Architecture

```
Browser (Next.js App Router + Recharts + useChat)
  ↕ HTTPS
API Layer (Vercel serverless)
  /api/ta/analysis/{ticker}
  /api/ta/search
  /api/ta/chat (streaming)
  ↓
┌──────────────────┬────────────────────┬──────────────────────┐
│  Cache Layer     │  Indicator Engine  │  Pattern Detection   │
│  Next.js cache   │  (technicalindica- │  Candlestick rules + │
│  + Supabase DB   │   tors npm)        │  Chart peak/trough   │
└──────────────────┴────────────────────┤                      │
                                        │  ONNX Inference      │
                                        │  (gradient boosting) │
                                        └──────────────────────┘
                                                ↓
                                        LLM Explanation
                                        (Gemini 2.5 Flash)
                                                ↓
                                        Supabase Postgres
```

### Request Lifecycle
1. `GET /api/ta/analysis/BBCA.JK`
2. Check `ta_analysis_cache` → hit? return JSON immediately
3. Cache miss:
   - Fetch OHLCV from yahoo-finance2 (or `ohlcv_cache` if today's exists)
   - Compute all indicators (server-side, synchronous, ~50ms)
   - Run candlestick + chart pattern detection (~20ms)
   - Run ONNX model inference → probability distribution (~100ms)
   - Build LLM prompt, stream Gemini explanation
   - Cache result in Supabase (expires at next market close)
4. Return JSON; chart renders; explanation streams

---

## 3. Database Design

```sql
-- OHLCV price data cache
CREATE TABLE ohlcv_cache (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker    VARCHAR(20) NOT NULL,
  date      DATE        NOT NULL,
  open      NUMERIC(14,4),
  high      NUMERIC(14,4),
  low       NUMERIC(14,4),
  close     NUMERIC(14,4),
  adj_close NUMERIC(14,4),
  volume    BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);
CREATE INDEX idx_ohlcv_ticker_date ON ohlcv_cache(ticker, date DESC);

-- Analysis results cache (one row per ticker per analysis date)
CREATE TABLE ta_analysis_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            VARCHAR(20) NOT NULL,
  analysis_date     DATE        NOT NULL,
  indicators        JSONB       NOT NULL,
  detected_patterns JSONB       NOT NULL,
  probabilities     JSONB       NOT NULL,
  llm_explanation   TEXT,
  llm_model_version VARCHAR(50),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  UNIQUE(ticker, analysis_date)
);
CREATE INDEX idx_ta_cache_lookup ON ta_analysis_cache(ticker, analysis_date DESC);

-- Anonymous session history
CREATE TABLE ta_session_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token UUID        NOT NULL,
  ticker        VARCHAR(20) NOT NULL,
  analysis_id   UUID        REFERENCES ta_analysis_cache(id),
  viewed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern outcome log (feeds model accuracy monitoring)
CREATE TABLE pattern_outcome_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker              VARCHAR(20)  NOT NULL,
  pattern_name        VARCHAR(100) NOT NULL,
  detected_date       DATE         NOT NULL,
  context_features    JSONB        NOT NULL,
  predicted_bull_prob NUMERIC(5,4),
  predicted_bear_prob NUMERIC(5,4),
  actual_5d_return    NUMERIC(8,4),
  actual_10d_return   NUMERIC(8,4),
  actual_20d_return   NUMERIC(8,4),
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- Ticker metadata
CREATE TABLE ticker_metadata (
  ticker         VARCHAR(20) PRIMARY KEY,
  company_name   VARCHAR(255),
  sector         VARCHAR(100),
  market_cap_idr BIGINT,
  cap_category   VARCHAR(10),
  last_updated   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API Specifications

```
GET  /api/ta/analysis/{ticker}?period=1y
GET  /api/ta/indicators/{ticker}?indicator=rsi,macd&period=1y
GET  /api/ta/patterns/{ticker}
GET  /api/ta/search?q={query}&limit=10
POST /api/ta/chat  (AI SDK streaming)
```

### Analysis Response Shape

```typescript
interface TAAnalysisResponse {
  ticker: string;
  company_name: string;
  sector: string;

  ohlcv: Array<{ date: string; open: number; high: number; low: number;
                 close: number; volume: number }>;

  indicators: {
    rsi: Array<{ date: string; value: number }>;
    macd: Array<{ date: string; macd: number; signal: number; histogram: number }>;
    bollinger_bands: Array<{ date: string; upper: number; middle: number; lower: number }>;
    ema_20, ema_50, ema_200, sma_50: Array<{ date: string; value: number }>;
    atr: Array<{ date: string; value: number }>;
    stochastic: Array<{ date: string; k: number; d: number }>;
    obv: Array<{ date: string; value: number }>;
  };

  patterns: {
    candlestick: PatternResult[];
    chart: PatternResult[];
  };

  probability_outlook: {
    bullish: number;       // 0-1
    bearish: number;       // 0-1
    neutral: number;       // 0-1
    horizon_days: 10;
    confidence: 'low' | 'medium' | 'high';
    n_patterns_detected: number;
    sample_note: string;   // "Based on 47 similar contexts on IDX (2018-2024)"
  };

  explanation: {
    summary: string;
    key_observations: string[];
    pattern_explanations: Array<{ pattern_id: string; plain_english: string; historical_context: string }>;
    counter_signals: string[];
    disclaimer: string;    // always appended
  };

  meta: { data_as_of: string; generated_at: string; cache_hit: boolean; model_version: string };
}

interface PatternResult {
  id: string;
  name: string;          // "Bullish Engulfing"
  name_id: string;       // "Engulfing Bullish" (Bahasa)
  type: 'bullish_reversal' | 'bearish_reversal' | 'continuation' | 'neutral';
  confidence: number;    // 0-1 (rule-based certainty)
  candle_indices: number[];
  historical_stats: {
    idx_occurrences: number;
    bullish_resolution_rate: number;
    avg_up_magnitude_pct: number;
    avg_down_magnitude_pct: number;
    avg_resolution_days: number;
  };
}
```

---

## 5. Indicator Computation Engine

Uses `technicalindicators` npm package (Node.js, no native deps):

```typescript
// lib/ta/indicators.ts
import { RSI, MACD, BollingerBands, EMA, SMA, ATR, Stochastic, OBV }
  from 'technicalindicators';

export function computeIndicators(ohlcv: OHLCVRow[]) {
  const closes  = ohlcv.map(d => d.close);
  const highs   = ohlcv.map(d => d.high);
  const lows    = ohlcv.map(d => d.low);
  const volumes = ohlcv.map(d => d.volume);
  const dates   = ohlcv.map(d => d.date);

  return {
    rsi:            align(dates, RSI.calculate({ values: closes, period: 14 }), 14),
    macd:           align(dates, MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }), 33),
    bollinger_bands: align(dates, BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 }), 19),
    ema_20:         align(dates, EMA.calculate({ period: 20,  values: closes }), 19),
    ema_50:         align(dates, EMA.calculate({ period: 50,  values: closes }), 49),
    ema_200:        align(dates, EMA.calculate({ period: 200, values: closes }), 199),
    sma_50:         align(dates, SMA.calculate({ period: 50,  values: closes }), 49),
    atr:            align(dates, ATR.calculate({ high: highs, low: lows, close: closes, period: 14 }), 14),
    stochastic:     align(dates, Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 }), 16),
    obv:            align(dates, OBV.calculate({ close: closes, volume: volumes }), 0),
  };
}
```

---

## 6. Pattern Detection Engine

### 6.1 Candlestick Patterns (Rule-Based, 12 patterns)
- Doji, Hammer, Hanging Man, Inverted Hammer, Shooting Star
- Bullish/Bearish Engulfing
- Morning Star, Evening Star
- Three White Soldiers, Three Black Crows
- Bullish/Bearish Harami

### 6.2 Chart Patterns (Peak/Trough Analysis)
- Double Top / Double Bottom
- Head and Shoulders / Inverse H&S
- Bull Flag / Bear Flag
- Support / Resistance levels (price clustering, min 3 touches)
- Ascending / Descending Triangle

### 6.3 Pattern Confidence
Each pattern has a `base_confidence` (0–1) derived from how clearly the
rule conditions are met — not a prediction of outcome. The ONNX model
provides the outcome probability separately.

---

## 7. Statistical Model (ML) Layer

### Training (Python, offline, run once)

```python
# ml/train_pattern_classifier.py
# Collects 5yr IDX OHLCV, detects patterns, labels with 10-day forward return
# Trains XGBClassifier, exports to ONNX for Node.js inference

from xgboost import XGBClassifier
from skl2onnx import convert_sklearn

FEATURES = [
  "rsi_bucket",      # 0=oversold, 1=neutral, 2=overbought
  "trend_ema50",     # 1=above, 0=below
  "trend_ema200",    # 1=above, 0=below
  "volume_ratio",    # price_volume / 20d_avg_volume (capped at 5x)
  "atr_pct",         # ATR as % of price (volatility)
  "cap_category",    # 0=small, 1=mid, 2=large
  "sector_encoded",  # one-hot encoded sector
  "pattern_encoded", # one-hot encoded pattern name
]

LABELS = {0: "bearish", 1: "neutral", 2: "bullish"}  # 10-day horizon, ±3% threshold
```

### Production Inference (Node.js, ONNX)

```typescript
// lib/ta/model/inference.ts
import * as ort from 'onnxruntime-node';

export async function predictPatternOutcome(features: number[]): Promise<{
  bullish: number; neutral: number; bearish: number;
}> {
  const session = await getSession(); // lazy-loaded singleton
  const tensor  = new ort.Tensor('float32', Float32Array.from(features), [1, features.length]);
  const results = await session.run({ float_input: tensor });
  const probs   = results['probabilities'].data as Float32Array;
  return { bearish: probs[0], neutral: probs[1], bullish: probs[2] };
}
```

### Expected Model Performance
| Metric | Expected Range | Note |
|---|---|---|
| 3-class accuracy | 45–55% | Random baseline is 33%; TA is inherently noisy |
| Bullish precision | 50–60% | Higher on high-confidence pattern detections |
| Calibration | Well-calibrated | Apply Platt scaling — probabilities must be reliable |

**Display model accuracy in the UI.** Users deserve to know the historical accuracy
of the model generating the numbers they're reading.

---

## 8. LLM Explanation Layer

```typescript
const SYSTEM = `
You are a financial education assistant for ClarifIn, helping Indonesian retail investors
understand technical chart patterns.

STRICT RULES:
1. NEVER use: "buy", "sell", "invest", "should", "will", "recommend", "price target"
2. Frame historically: "historically", "in similar cases", "X% of the time"
3. Explain every term used — no unexplained jargon
4. Three paragraphs: (a) what you see, (b) historical context with probs, (c) risks/caveats
5. Acknowledge conflicting signals explicitly
6. Note if N < 30 occurrences: small sample caveat
7. End with exactly: "This is educational pattern analysis, not financial advice.
   Always consult a licensed financial advisor before making investment decisions."
`;
```

### Output Sanitization
```typescript
const FORBIDDEN = ['buy','sell','invest','should purchase','i recommend',
                   'price target','stop loss','take profit','will rise','will fall'];

export function sanitizeLLMOutput(text: string): string {
  // Reuse Phase 10 chat post-processing filter (CHAT-06) — same forbidden-phrase list.
  // Log violations to Langfuse (Phase 11 OBS-01) for prompt tuning.
  return text
    .replace(/\b(will rise|will increase)\b/gi, 'has historically trended upward in similar patterns')
    .replace(/\b(buy|purchase)\b/gi, 'accumulate (historically)');
}
```

---

## 9. UI/UX Layout (`/ta/{ticker}`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  NAV: [ClarifIn] [Upload Document] [TA Analysis (active)]          │
├─────────────────────────────────────────────────────────────────────┤
│  🔍 Search IDX ticker...                                            │
├─────────────────────────────────────────────────────────────────────┤
│  ⚠ DISCLAIMER: Educational analysis only. Not investment advice.   │
├─────────────────────────────────────────────────────────────────────┤
│  Company Name · TICKER.JK · Sector · Cap category                  │
│  Last EOD: Rp X,XXX  (±X%)  · Data as of: {date}                  │
├─────────────────────────────────────────────────────────────────────┤
│  CHART PANEL                                                        │
│  [1M][3M][6M][1Y][2Y]  Overlays: [EMA20][EMA50][BB][S/R]          │
│  Candlestick chart with pattern markers (▲▼◆)                      │
│  Volume + OBV subpanel                                              │
│  MACD subpanel                                                      │
│  RSI subpanel                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  AI ANALYSIS (3-column)                                             │
│  | Detected Patterns    | Probability Dist.    | AI Explanation    |│
│  | ▲ Bull Engulfing     | Bullish: 42% ████    | Streaming text    |│
│  | ◆ Doji               | Neutral:  35% ███    | from Gemini       |│
│  | ◆ S/R Level          | Bearish:  23% ██     |                   |│
│  |                      | 10-day · 47 cases    |                   |│
├─────────────────────────────────────────────────────────────────────┤
│  INDICATOR SNAPSHOT                                                 │
│  RSI: 62.4 Neutral  MACD: Bullish  BB: Upper  EMA200: +8.3%       │
├─────────────────────────────────────────────────────────────────────┤
│  FOLLOW-UP CHAT                                                     │
│  [Input field] Suggestions: [Explain RSI] [What is a Doji?]        │
├─────────────────────────────────────────────────────────────────────┤
│  ⚠ FULL LEGAL DISCLAIMER (always visible, below fold)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Caching Strategy

```typescript
// Level 1: Next.js in-memory (per deployment instance)
export const getAnalysisCached = unstable_cache(
  async (ticker) => fetchAndComputeFull(ticker),
  ['ta-analysis'],
  { revalidate: isMarketHours() ? 300 : 86400, tags: [`ta-${ticker}`] }
);

// Level 2: Supabase ta_analysis_cache (persistent, cross-deployment)
// expires_at set to next market close (17:00 WIB)

// Vercel Cron: "0 11 * * 1-5" → 18:00 WIB Mon-Fri
// Invalidate + pre-warm top 50 IDX tickers nightly
```

---

## 11. Security

| Threat | Mitigation |
|---|---|
| Invalid ticker | Regex: `/^[A-Z]{1,6}(\.JK)?$/` |
| Prompt injection via chat | Sanitize input; system prompt immutable |
| Advice generation by LLM | Keyword scan + sanitize; log violations |
| Excessive LLM usage | 10 req/min per session; 100 req/day; cache |
| Model file tampering | Hash check at startup |

---

## 12. Performance Targets

| Metric | Target |
|---|---|
| Chart load (cache hit) | < 1.5s |
| Chart load (cache miss) | < 4s |
| Indicator computation | < 200ms |
| ONNX inference | < 100ms |
| LLM first token | < 1.5s |
| LLM full response | < 8s (streamed) |

---

## 13. New Dependencies

```bash
pnpm add technicalindicators     # indicator computation
pnpm add onnxruntime-node        # ONNX model inference
# recharts, yahoo-finance2, @ai-sdk/google already in stack
```

Python (offline training only):
```
xgboost scikit-learn skl2onnx onnx yfinance pandas numpy
```

---

## 14. Development Phases

If this module ever becomes a roadmap item, it would slot in as a new milestone post-v1
(e.g., milestone `v2.0-ta`). Phase numbering below is module-internal (T-prefixed) to avoid
confusion with the main Clarifin roadmap.

### Phase T1 — Data & Indicators (2–3 weeks)
- [ ] `ohlcv_cache` table + yahoo-finance2 fetch + daily upsert
- [ ] Indicator computation engine
- [ ] `/api/ta/search` (ticker autocomplete)
- [ ] `/api/ta/analysis/{ticker}` (OHLCV + indicators)
- [ ] Basic chart UI: candlestick + volume + RSI + MACD
- [ ] Done: BBCA.JK renders with working indicators

### Phase T2 — Patterns & Explanation (2–3 weeks)
- [ ] Candlestick pattern detection (12 patterns)
- [ ] Chart pattern detection (double top/bottom, H&S, S/R, flags)
- [ ] Pattern markers on chart with tooltips
- [ ] Gemini streaming explanation
- [ ] Three-tier disclaimer framework
- [ ] Cache layer (Next.js + Supabase)
- [ ] Done: Patterns + explanation for BBCA, TLKM, GOTO

### Phase T3 — ML Model (3–4 weeks)
- [ ] Collect 5yr IDX training data (Python, offline)
- [ ] Feature engineering + labeling
- [ ] Train XGBClassifier + Platt calibration
- [ ] ONNX export + Node.js inference integration
- [ ] Probability distribution UI component
- [ ] `pattern_outcome_log` + cron to fill actual returns
- [ ] Model accuracy card in UI
- [ ] Done: Probability distribution renders with correct framing

### Phase T4 — Polish (1–2 weeks)
- [ ] Follow-up chat (RAG over pattern/indicator context)
- [ ] Nightly pre-warm cron (top 50 IDX tickers)
- [ ] Langfuse observability (reuses Phase 11 OBS-01 instrumentation)
- [ ] Mobile layout
- [ ] Rate limiting middleware (reuses Phase 12 INFRA-02 per-IP limiter)

---

## 15. Key Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Scope conflict with Clarifin v1 wedge | **Certain** | Explicit milestone decision required before any planning |
| Yahoo Finance blocks batch scraping | Medium | 1–2s delays; aggressive cache; fallback to Stooq |
| Gemini 250 RPD quota exhaustion (compounded with Phase 6/10 burn) | **High** | See `.planning/research/questions.md` Q3 — needs quantification before any TA work |
| Insufficient IDX training data for ONNX model | High | Fall back to hardcoded historical stats; be transparent about N |
| LLM generates advice despite system prompt | Low | Reuse Phase 10 CHAT-06 post-processing filter |
| Vercel 60s timeout on cold analysis | Low | Pre-warm top 50 tickers nightly; stream response |
| Model overfit to 2020–2021 bull market | High | Use 2015–2024 data; report out-of-sample accuracy |

---

## Related Artifacts

- `.planning/notes/ta-module-design-decisions.md` — the four locked design decisions
- `.planning/research/questions.md` — Q1/Q2/Q3 open research questions blocking phase T3 + T4
