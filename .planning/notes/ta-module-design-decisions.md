---
title: "TA Module — Core Design Decisions"
date: "2026-06-06"
context: "Emerged from /gsd-explore session designing the Technical Analysis & Market Prediction module"
related: ".planning/seeds/ta-module-standalone.md"
---

# TA Module — Core Design Decisions

Four decisions were made during initial design exploration. They are recorded here so
they are not relitigated when (if) implementation begins.

> **Note:** The TA module is currently **out of scope** for Clarifin v1 per `CLAUDE.md`
> and `.planning/REQUIREMENTS.md`. These decisions apply ONLY if the team explicitly
> amends the scope decision in a future milestone. See seed for full context.

---

## Decision 1: Standalone Module (Not Document-Tied)

**Decision:** The TA module is a separate product surface at `/ta/{ticker}`, independent
of document upload sessions.

**Rationale:** The document upload feature answers "what does this filing mean?" — a
backward-looking question about a specific report. Technical analysis answers "what is the
chart doing right now?" — a different job, a different user moment. Coupling them would
create a confusing hybrid that does neither well.

**Implication:** This is a v2+ feature. Do not start building it until v1 (document analysis)
is stable and shipping. The full design is in `.planning/seeds/ta-module-standalone.md`.

---

## Decision 2: Probabilistic Output Only — No Directional Calls

**Decision:** All AI predictions expressed as probability distributions
(e.g., "Bullish: 42% / Neutral: 35% / Bearish: 23% — 10-day horizon").
No language like "bullish signal", "technical outlook: buy", or "price will rise."

**Rationale:**
1. **Compliance:** CLAUDE.md hard constraint — product must NOT make buy/sell recommendations.
2. **Honesty:** Technical analysis has limited predictive power (expected model accuracy: 45–55%).
   Presenting probabilities forces the UI to communicate uncertainty correctly.
3. **Trust:** Users who see "42% bullish, 33% random baseline" understand the model's
   actual utility. Users who see "BULLISH SIGNAL" may over-rely on it.

**Implementation:** Output sanitization pass on all LLM output (keyword scan for `buy`,
`sell`, `recommend`, `will rise`, etc.) + system prompt enforcement + disclaimer framework.
**Reuse Phase 10 CHAT-06 post-processing filter** — same forbidden-phrase list.

---

## Decision 3: End-of-Day Data Only

**Decision:** All price data sourced from yahoo-finance2 as EOD (end-of-day) OHLCV.
No real-time, no 15-minute delayed quotes.

**Rationale:**
1. **Budget:** No free real-time IDX data source exists. The project has a $0/month budget.
2. **Architecture simplicity:** EOD data means no WebSocket infrastructure, no polling,
   no real-time compute. Analysis runs once per day per ticker (nightly batch for top 50).
3. **Audience fit:** The target user is not a day trader. They are a periodic investor
   checking a stock before deciding. EOD data is sufficient for this use case.

**Implication:** Cache OHLCV data in `ohlcv_cache` table (Supabase). Nightly Vercel cron
(18:00 WIB) fetches new candles and invalidates analysis cache.

---

## Decision 4: LLM-Explained Patterns + Classical ML (ONNX) — No Deep Learning

**Decision:** Two-layer AI pipeline:
- **Layer 1:** Rule-based pattern detection (candlestick rules + peak/trough chart patterns)
  → probability distribution from ONNX-serialized gradient boosting model (trained offline)
- **Layer 2:** Gemini 2.5 Flash generates plain-English explanation of detected patterns

**Rationale:**
- **No Python runtime in production:** ONNX serialization means the trained model runs
  via `onnxruntime-node` — no Python server needed on Vercel.
- **Training is free:** Gradient boosting trains on a laptop using 5yr IDX OHLCV history.
  One-time effort; model is a static binary artifact.
- **Deep learning ruled out:** LSTM/transformer models require GPU compute for training,
  significant IDX-specific data, and ongoing retraining — incompatible with $0/month budget.
- **LLM for explanation, not prediction:** Gemini is used to translate technical output
  into plain English — the core ClarifIn value prop. It does not generate the probabilities
  (that would be uncontrolled and hard to calibrate).

**Open questions before Phase T3 (ML model) starts** — see `.planning/research/questions.md`:
1. Is 5yr OHLCV from yahoo-finance2 sufficient for training across top 100 IDX stocks?
2. Is Platt scaling sufficient for calibrating XGBoost probabilities on this data?
