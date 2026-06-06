# Requirements: Clarifin v2.0 TA Module

**Defined:** 2026-06-06
**Milestone:** v2.0 — TA Module
**Phases:** 13 (T1 Data & Indicators) · 14 (T2 Patterns & Explanation) · 15 (T3 ML Probability) · 16 (T4 Polish)
**Audience:** Same as v1.0 — English-fluent Indonesian professional, non-finance-trained, opens IDX charts but doesn't know what they're seeing. Investors, not day-traders.
**Core constraint:** Probabilistic framing only — no directional buy/sell language anywhere. EOD data only. $0/month budget.

All REQ-IDs use `TA-` prefix to distinguish from archived v1.0 IDs.

## v2.0 Requirements

### Data Ingestion (TA-INGEST · TA-DATA)

- [x] **TA-INGEST-01**: System fetches and caches IDX-listed OHLCV data via yahoo-finance2 for `.JK` tickers with response validation (reject bars where `high < low`, `close < 0`, `volume < 0`, or single-bar return >50%); IDX trading calendar enforced (no expected bars on Indonesian holidays); data gaps surfaced in UI rather than silently interpolated
- [x] **TA-DATA-01**: A one-off backfill script populates 5yr+ historical OHLCV for top-100 IDX tickers (prerequisite for T3 ML training data)

### Ticker Identification (TA-TICKER)

- [x] **TA-TICKER-01**: User can search by ticker code or company name (English or Bahasa) via debounced autocomplete; results ranked across top-N IDX tickers from `ticker_metadata` table
- [x] **TA-TICKER-02**: Ticker URLs are uppercase without `.JK` suffix (e.g., `/ta/BBCA`); lowercase redirects to uppercase

### Candlestick Chart (TA-CHART)

- [x] **TA-CHART-01**: System renders an interactive candlestick chart (OHLC bars with up/down coloring) for the selected ticker
- [x] **TA-CHART-02**: A volume subpanel renders below the price chart with bars colored by up/down day
- [x] **TA-CHART-03**: Range selector lets user switch between 1M / 3M / 6M / 1Y / 2Y preset windows
- [x] **TA-CHART-04**: Hovering a bar shows a tooltip with date and OHLCV values
- [x] **TA-CHART-05**: User can zoom and pan the chart (wheel/drag on desktop, pinch on mobile)
- [x] **TA-CHART-06**: A crosshair tracks the cursor showing the value at the hovered position
- [ ] **TA-CHART-07**: Invalid or unrecognized tickers show a friendly error; data fetch in flight shows a skeleton loader (no raw exceptions to UI)
- [x] **TA-CHART-08**: Tickers with <30 candles of history (recent IPOs) show an explicit sparse-data state with no false indicator/pattern output: "Insufficient price history to compute reliable technical indicators"
- [ ] **TA-CHART-09**: Detected patterns render as overlay markers (▲ bullish reversal, ▼ bearish reversal, ◆ continuation/neutral) at the relevant candle range
- [ ] **TA-CHART-10**: Clicking a pattern marker opens the corresponding pattern explanation card

### Indicators (TA-IND)

- [x] **TA-IND-01**: An RSI(14) subpanel renders with 30/70 reference lines
- [x] **TA-IND-02**: A MACD(12,26,9) subpanel renders with histogram visible
- [x] **TA-IND-03**: Bollinger Bands(20, 2σ) render as a togglable overlay on the price chart
- [x] **TA-IND-04**: EMA-20, EMA-50, EMA-200 render as togglable overlays on the price chart (defaults: EMA-50 and EMA-200 ON; EMA-20 OFF)
- [x] **TA-IND-05**: An indicator snapshot strip translates the most-recent values into one-line plain-English directional summaries (e.g., "MACD: Bullish crossover yesterday" not "MACD: 1.23 / 0.98 / 0.25")
- [x] **TA-IND-06**: Each indicator value surfaces a plain-English interpretation hint on hover/click
- [x] **TA-IND-07**: Overlay toggle controls render as chip selectors above the chart

### Pattern Detection (TA-PAT)

- [ ] **TA-PAT-01**: A sidebar lists all patterns detected in the current view with name, taxonomy label, and type icon
- [ ] **TA-PAT-02**: Pattern detection requires volume confirmation (≥1.2× 20-day average for reversal patterns), ATR-relative geometry (not absolute % thresholds), AND multi-bar confirmation (N+1 close confirms an N-bar pattern); pattern detection is skipped on bars where `volume × close < Rp 500M` (liquidity floor)
- [ ] **TA-PAT-03**: Each detected pattern surfaces an explanation card with plain-English name, Bahasa Indonesia name, one-sentence definition, and one-sentence historical context
- [ ] **TA-PAT-04**: Each pattern carries a taxonomy badge: Bullish Reversal / Bearish Reversal / Continuation / Neutral
- [ ] **TA-PAT-05**: Each pattern card shows a historical-stats row: IDX occurrences, bullish-resolution rate, average up/down magnitude, average resolution days
- [ ] **TA-PAT-06**: When no patterns are detected for the visible range, the sidebar shows an explicit empty state (not blank space)
- [ ] **TA-PAT-07**: When a pattern's IDX historical occurrences are <30, a small-sample caveat is auto-attached to the explanation card

### Probability Output (TA-PROB)

- [ ] **TA-PROB-01**: A three-bar probability widget renders bullish / neutral / bearish percentages summing to 100%
- [ ] **TA-PROB-02**: Each bar shows a random-baseline (33%) reference marker so users see lift over chance, not raw confidence
- [ ] **TA-PROB-03**: An explicit horizon label is visible: "10-day forward outlook"
- [ ] **TA-PROB-04**: A sample-size note is visible: "Based on N similar historical contexts on IDX (date range)"
- [ ] **TA-PROB-05**: A confidence tier badge (Low / Med / High) renders; if per-class ECE >0.07, the UI auto-downgrades `high` → `low` programmatically
- [ ] **TA-PROB-06**: A model-accuracy card displays prominently: "Right N% of the time on out-of-sample IDX 2024 (n=...)" — must be visible, not hidden in a tooltip
- [ ] **TA-PROB-07**: A widget-attached disclaimer reads "historical frequencies, not predictions"

### AI Explanation (TA-EXP)

- [ ] **TA-EXP-01**: A streaming 3-paragraph plain-English explanation is generated per ticker via Gemini: (a) what's on the chart, (b) historical context for the detected patterns, (c) risks and counter-signals; first paragraph streams within 3 seconds
- [ ] **TA-EXP-02**: Hovering or tapping any TA term in the explanation shows its plain-English definition (reuses Phase 10 PSAK glossary pattern)
- [ ] **TA-EXP-03**: When detected patterns conflict with current indicator readings, a "conflicting-signals" callout is rendered in the explanation
- [ ] **TA-EXP-04**: Every AI explanation has a per-output disclaimer appended ("This is educational pattern analysis, not financial advice…")
- [ ] **TA-EXP-05**: LLM output is post-processed by the shared bilingual buy/sell sanitizer (EN: `buy`/`sell`/`invest`/`recommend`/`will rise`/etc.; ID: `beli`/`jual`/`akumulasi`/`target harga`/`rekomendasi`/`hold`); replacement events logged to Langfuse

### Follow-up Chat (TA-CHAT)

- [ ] **TA-CHAT-01**: User can ask follow-up questions in a chat input below the analysis panel (reuses Phase 10 `useChat` UI)
- [ ] **TA-CHAT-02**: Chat retrieval set is the structured TA context (detected patterns + indicator snapshot + last-20-day OHLCV summary) — NOT v1.0 document chunks; `match_document_chunks` MUST NOT be called from TA chat
- [ ] **TA-CHAT-03**: Buy/sell language in user input is hard-blocked by the same `isInvestmentAdviceQuery` guardrail used by Phase 10 CHAT-06 (extracted to shared bilingual module per TA-INFRA-03)
- [ ] **TA-CHAT-04**: Chat responses stream progressively with a trailing disclaimer
- [ ] **TA-CHAT-05**: At session start, a suggested-prompts strip renders 3–5 education-only prompts (e.g., "What does RSI mean here?", "What is a Doji?"); no directional prompts ("Should I buy?")
- [ ] **TA-CHAT-06**: The v1.0 session token is reused for TA sessions; chat history persists in new `ta_chat_sessions` / `ta_chat_messages` tables for 7 days

### Disclaimers (TA-DISCLAIM)

- [ ] **TA-DISCLAIM-01**: A non-dismissible page-header banner reads "Educational analysis only — not investment advice" above all TA content
- [ ] **TA-DISCLAIM-02**: A per-output disclaimer is attached to every AI block (explanation, probability widget, pattern card, chat response), rendered within 100px of the high-risk number at 1080p
- [ ] **TA-DISCLAIM-03**: A full legal disclaimer is always visible below-fold (not behind an accordion) on every `/ta/{ticker}` page
- [ ] **TA-DISCLAIM-04**: First-time TA visitors see an onboarding modal with three bullets: what this tool does, what it does not do, and the no-advice disclaimer — before any TA content is interactable

### Infrastructure & Engineering Hygiene (TA-INFRA — the 8 locked roadmapper constraints)

- [ ] **TA-INFRA-01**: All public `/api/ta/*` routes enforce per-IP daily rate limiting (reuses Phase 12 INFRA-02 limiter; failure to reuse is a verification finding)
- [x] **TA-INFRA-02**: All Vercel cron jobs (existing v1.0 + new v2.0) are consolidated under a **single dispatcher cron** to stay within the Hobby 2-cron limit; the dispatcher invokes job handlers as direct function imports (not HTTP self-fetch — see `parse-batch/route.ts:13-22` 508 INFINITE_LOOP_DETECTED warning); each job accepts `{ deadline }` and self-limits within the 60s function budget
- [ ] **TA-INFRA-03**: The Phase 10 CHAT-06 `isInvestmentAdviceQuery` guardrail is extracted from `src/lib/guardrail.ts` to a shared `src/lib/safety/buy-sell-filter.ts` and extended bilingual (EN + Indonesian forbidden phrases); both v1.0 `/api/chat` and v2.0 `/api/ta/chat` import the same shared module
- [ ] **TA-INFRA-04**: A Vercel preview-deploy ONNX smoke test runs before T3 commits to the ONNX architecture: deploy a hello-world TA route loading a 5MB dummy `.onnx`, measure cold INIT_DURATION via Vercel function logs; if cold-start >5s consistently, T3 architecture is revisited (smaller model, async probability, or separate runtime)
- [ ] **TA-INFRA-05**: T3 ships with a model-accuracy floor: if held-out 2024 accuracy <45%, T3 falls back to a "historical stats only" probability card (no ONNX output); the UI must support this fallback shape from day one
- [ ] **TA-INFRA-06**: Each phase produces VERIFICATION.md before the next phase begins planning; T(n+1) cannot enter `/gsd-plan-phase` until T(n) has VERIFICATION.md on disk
- [ ] **TA-INFRA-07**: HUMAN-UAT runs at T2 (patterns + explanation) and T4 (chat) with at least 2 non-developer Jakarta-based users, completed within 7 days of phase code completion; failure to complete UAT rolls the phase back to "not closed"
- [ ] **TA-INFRA-08**: Before T4 planning begins, Langfuse Phase 11 OBS-01 traces are read to compute P95 Gemini daily RPD; if P95 >150, T4 must default TA chat to Groq + Llama 3.3 fallback; if P95 >200, T4 must also add stale-while-revalidate caching to TA explanation

### Observability (TA-OBS)

- [ ] **TA-OBS-01**: Every TA Gemini call (explanation generation, chat) is traced through the existing v1.0 Langfuse singleton with `trace.name = "ta-explanation"` / `"ta-chat"` (Pattern B — open before `streamText`, close in `onFinish`); `flushAsync` in `finally` is mandatory
- [ ] **TA-OBS-02**: Buy/sell sanitizer replacement events log to Langfuse as spans with the original (pre-replacement) output for prompt tuning

### UX & Responsive (TA-UX)

- [ ] **TA-UX-01**: A shared site header is mounted in `RootLayout` exposing surface switching between `Upload Document` (v1.0 `/`) and `TA Analysis` (v2.0 `/ta`)
- [ ] **TA-UX-02**: All `/ta/{ticker}` content renders on a 375px mobile viewport without horizontal overflow or unusable UI elements

## v2.1+ Requirements (Deferred — not in v2.0)

Acknowledged but explicitly deferred. Tracked here so they don't get lost.

- **TA-FUTURE-01**: 5y chart range with server-side LTTB decimation (currently capped at 2y)
- **TA-FUTURE-02**: Recently-viewed tickers strip on `/ta` landing (requires `ta_session_views` table)
- **TA-FUTURE-03**: Cross-surface link card — "You also analyzed `BBCA Annual Report 2023` — view fundamentals" when both surfaces have content for a ticker (DIFF-12 in research)
- **TA-FUTURE-04**: "How this pattern works" expandable with idealized-shape diagram (DIFF-02; defer for design effort)
- **TA-FUTURE-05**: Intraday chart granularity (1h / 15m / 5m) — requires real-time data feed, out of $0 budget
- **TA-FUTURE-06**: Survivorship correction in ML training via paid IDX historical archive (D5 mitigation; currently documented as known limitation)
- **TA-FUTURE-07**: Regime-stratified model accuracy reporting in UI (bull / bear / sideways breakdown; D6 mitigation surface, only model-card-level for v2.0)
- **TA-FUTURE-08**: Stooq fallback OHLCV data source if yahoo-finance2 breaks (planned design, code only ships on incident)

## Out of Scope (v2.0 AND v2.1+)

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Buy / sell / "should I" verdicts | Hard non-requirement — CHAT-06 blocks this; same regulatory line as v1.0 |
| Price targets, stop-loss, take-profit, position-sizing | Trading-tool features; not analysis |
| Real-time IDX market data | Requires paid feed; EOD-only is sufficient for the audience |
| Alerts / push notifications / email digests | Requires persistent infra and watchlist; pulls into "portfolio management" |
| Multi-stock comparison / sector rotation views | Compounds complexity; out of scope per seed §1 |
| Portfolio tracking / watchlists | Out of scope — product is "ticker → understanding," not portfolio management |
| Backtesting UI / strategy builder | Power-user feature; wrong audience |
| Paper trading / simulated trades | Wrong mental model — product is analysis, not practice |
| Drawing tools (trendlines, Fibonacci, Gann) | Assume the user can already read a chart — they cannot; serves traders, not the v1.0 persona |
| Custom indicator builder / Pine Script equivalent | Power-user feature; wrong audience |
| Indicator templates / save chart layouts | Implies repeated complex setup |
| Lesser-known indicators (Ichimoku, Vortex, KST, Aroon, DEM, RSL) | Add cognitive load without earning the explanation budget; stick to the seed §5 set |
| Multi-pane / multi-chart layouts | Maximalist UI |
| Level-2 order book / time-and-sales | Day-trader features; requires paid feeds |
| Heatmaps / sector rotation | Multi-stock comparison territory |
| Auto-fetch fundamentals when entering a TA ticker | Surfaces remain isolated; only a *link* between them (DIFF-12 / TA-FUTURE-03), not auto-merging |
| TradingView premium embed | Per-user licensing — incompatible with anonymous v1.0 session model and free budget |
| Coverage of non-IDX exchanges (NYSE, SGX, ASX) | IDX-only focus is the wedge |
| Multi-LLM routing beyond Gemini → Groq fallback | Vendor complexity; not yet proven needed |

## Traceability

Every v2.0 requirement is mapped to exactly one phase (Phases 13–16). Coverage: **62/62**.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TA-INGEST-01 | Phase 13 (T1) | Complete |
| TA-DATA-01 | Phase 13 (T1) | Complete |
| TA-TICKER-01 | Phase 13 (T1) | Complete |
| TA-TICKER-02 | Phase 13 (T1) | Complete |
| TA-CHART-01 | Phase 13 (T1) | Complete |
| TA-CHART-02 | Phase 13 (T1) | Complete |
| TA-CHART-03 | Phase 13 (T1) | Complete |
| TA-CHART-04 | Phase 13 (T1) | Complete |
| TA-CHART-05 | Phase 13 (T1) | Complete |
| TA-CHART-06 | Phase 13 (T1) | Complete |
| TA-CHART-07 | Phase 13 (T1) | Pending |
| TA-CHART-08 | Phase 13 (T1) | Complete |
| TA-CHART-09 | Phase 14 (T2) | Pending |
| TA-CHART-10 | Phase 14 (T2) | Pending |
| TA-IND-01 | Phase 13 (T1) | Complete |
| TA-IND-02 | Phase 13 (T1) | Complete |
| TA-IND-03 | Phase 13 (T1) | Complete |
| TA-IND-04 | Phase 13 (T1) | Complete |
| TA-IND-05 | Phase 13 (T1) | Complete |
| TA-IND-06 | Phase 13 (T1) | Complete |
| TA-IND-07 | Phase 13 (T1) | Complete |
| TA-PAT-01 | Phase 14 (T2) | Pending |
| TA-PAT-02 | Phase 14 (T2) | Pending |
| TA-PAT-03 | Phase 14 (T2) | Pending |
| TA-PAT-04 | Phase 14 (T2) | Pending |
| TA-PAT-05 | Phase 14 (T2) | Pending |
| TA-PAT-06 | Phase 14 (T2) | Pending |
| TA-PAT-07 | Phase 14 (T2) | Pending |
| TA-PROB-01 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-PROB-02 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-PROB-03 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-PROB-04 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-PROB-05 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-PROB-06 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-PROB-07 | Phase 15 (T3) | Pending — blocks on Q1, Q2 |
| TA-EXP-01 | Phase 14 (T2) | Pending |
| TA-EXP-02 | Phase 14 (T2) | Pending |
| TA-EXP-03 | Phase 14 (T2) | Pending |
| TA-EXP-04 | Phase 14 (T2) | Pending |
| TA-EXP-05 | Phase 14 (T2) | Pending |
| TA-CHAT-01 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-CHAT-02 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-CHAT-03 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-CHAT-04 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-CHAT-05 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-CHAT-06 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-DISCLAIM-01 | Phase 14 (T2) | Pending |
| TA-DISCLAIM-02 | Phase 14 (T2) | Pending |
| TA-DISCLAIM-03 | Phase 14 (T2) | Pending |
| TA-DISCLAIM-04 | Phase 14 (T2) | Pending |
| TA-INFRA-01 | Phase 16 (T4) | Pending — blocks on Q3 |
| TA-INFRA-02 | Phase 13 (T1) | Pending — Wave 3; implicitly closes v1.0 R1 |
| TA-INFRA-03 | Phase 14 (T2) | Pending — Wave 0 |
| TA-INFRA-04 | Phase 13 (T1) | Pending — Wave 3 (must complete before T3 begins) |
| TA-INFRA-05 | Phase 15 (T3) | Pending — ship/no-ship gate |
| TA-INFRA-06 | Process-level (all phase transitions) | Cross-cutting — surfaced in Roadmap Overview, not a phase requirement |
| TA-INFRA-07 | Phase 14 (T2) + Phase 16 (T4) | Pending — HUMAN-UAT in both phases |
| TA-INFRA-08 | Phase 16 (T4) | Pending — Wave 0 prerequisite |
| TA-OBS-01 | Phase 14 (T2) | Pending |
| TA-OBS-02 | Phase 14 (T2) | Pending |
| TA-UX-01 | Phase 13 (T1) | Pending |
| TA-UX-02 | Phase 16 (T4) | Pending — blocks on Q3 |

**Coverage summary:**
- Phase 13 (T1): 22 requirements (12 CHART + 7 IND + 2 TICKER + 1 INGEST + 1 DATA + 1 UX + TA-INFRA-02 + TA-INFRA-04). *Counted with shared rows: TA-INFRA-02 and TA-INFRA-04 owned by T1.*
- Phase 14 (T2): 20 requirements (2 CHART markers + 7 PAT + 5 EXP + 4 DISCLAIM + 2 OBS + TA-INFRA-03 + TA-INFRA-07 T2 half).
- Phase 15 (T3): 8 requirements (7 PROB + TA-INFRA-05). Blocks on Q1, Q2.
- Phase 16 (T4): 10 requirements (6 CHAT + TA-INFRA-01 + TA-INFRA-08 + TA-UX-02 + TA-INFRA-07 T4 half). Blocks on Q3.
- Process-level (no phase): 1 requirement (TA-INFRA-06 — VERIFICATION gate, applies across all phase transitions).

Total: 62/62 mapped. TA-INFRA-07 is split across Phase 14 (T2 HUMAN-UAT) and Phase 16 (T4 HUMAN-UAT) per SUMMARY.md §9.

---
*Requirements defined: 2026-06-06 (v2.0 milestone start)*
*Traceability filled by roadmapper: 2026-06-06*
*Total v2.0 requirements: 62*
*Categories: TA-INGEST(1), TA-DATA(1), TA-TICKER(2), TA-CHART(10), TA-IND(7), TA-PAT(7), TA-PROB(7), TA-EXP(5), TA-CHAT(6), TA-DISCLAIM(4), TA-INFRA(8), TA-OBS(2), TA-UX(2)*
