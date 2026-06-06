# Open Research Questions

Questions that need deeper investigation before relevant phases begin.
Each entry: question, source/context, why it matters, blocking phase (if any).

---

## TA Module — Phase T3 (ML Model) Prerequisites

> Context: All three questions below relate to the TA module seeded at
> `.planning/seeds/ta-module-standalone.md`. That module is currently **out of scope**
> for v1 — these questions only become blocking if the team amends scope in v2+.

### Q1: Is 5-year yahoo-finance2 OHLCV data sufficient to train the IDX pattern classifier?

**Context:** TA module design (2026-06-06) specifies an XGBoost classifier trained on
historical IDX OHLCV data, with feature labels derived from 10-day forward returns at
±3% thresholds. The model is expected to achieve 45–55% 3-class accuracy.

**Specific sub-questions:**
- How many pattern instances can we extract from 5yr × top 100 IDX tickers × 12 candlestick patterns?
- Is N > 1,000 per (pattern, market-cap, sector) cell achievable, or will sparse cells dominate?
- What is the class balance (bullish / neutral / bearish outcomes) on IDX historical data?
- Should we use SMOTE / class weights to handle imbalance, or accept the natural distribution?
- Does the 2020–2021 COVID bull cycle dominate the dataset and bias the model? Do we need
  to extend to 2015–2024 for cycle diversity?

**Why it matters:** If training data is insufficient, the entire ONNX-based probability
output (Decision 4) becomes unreliable. Fallback is hardcoded historical stats from
academic literature, which is weaker but defensible.

**Blocks:** Phase T3 (Statistical Model Layer) of TA module

**Source:** `.planning/notes/ta-module-design-decisions.md`

---

### Q2: Which probability calibration method works best for XGBoost on IDX TA data?

**Context:** The ONNX model output drives the user-facing probability distribution.
If probabilities are not well-calibrated, "42% bullish" will not actually mean
"42% of similar setups historically resolved bullishly," which violates the trust
contract with the user.

**Specific sub-questions:**
- Is Platt scaling (sigmoid calibration) sufficient, or do we need isotonic regression?
- For a 3-class problem, should we calibrate one-vs-rest per class, or use a multinomial
  calibration approach?
- Does temperature scaling (used in deep learning) apply to gradient boosting outputs?
- How do we measure calibration quality? Expected Calibration Error (ECE) on a held-out
  IDX 2024 set?

**Why it matters:** Compliance + trust. Probabilistic framing (Decision 2) only works
if the probabilities reflect reality. Poor calibration → user trust collapse.

**Blocks:** Phase T3 (Statistical Model Layer) of TA module

**Source:** `.planning/notes/ta-module-design-decisions.md`

---

### Q3: Will Gemini 2.5 Flash 250 RPD free quota survive combined load (v1 + TA module)?

**Context:** Clarifin v1 already burns Gemini quota across Phase 6 (explanation generation)
and Phase 10 (chat). Adding a TA module would stack additional LLM calls on the same
free-tier budget. The TA design assumes aggressive caching keeps most requests off Gemini,
but the combined budget hasn't been quantified.

**Specific sub-questions:**
- What is the current Gemini RPD burn at Phase 6 + Phase 10 in production? (Read from
  Phase 11 Langfuse traces — `OBS-01` instrumentation.)
- At a hypothetical TA module launch (estimate: 100 unique tickers/day × 1 cache miss each
  = 100 LLM calls/day), do we stay within 250 RPD when stacked on existing v1 traffic?
- If follow-up chat is added (~5 messages per TA session), does that push the combined
  load over quota?
- What is the per-day burst pattern (Indonesian market hours 09:00–16:00 WIB)?
- Should TA-module follow-up chat default to Groq + Llama 3.3 70B (CLAUDE.md fallback)?
- At what combined user count do we need to budget for paid Gemini ($0.30/$2.50 per 1M tokens)?

**Why it matters:** Quota exhaustion at peak hours means explanations and chat stop
streaming for users — degrading the core v1 value prop AND the TA module simultaneously.
Need a quota-aware degradation strategy before adding TA load.

**Blocks:** Phase T4 (Polish) of TA module — caching + observability decisions. Also
relevant to current Phase 11 observability work if it surfaces quota headroom data.

**Source:** TA module design exploration, 2026-06-06
