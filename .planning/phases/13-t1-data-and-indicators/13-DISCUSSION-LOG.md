# Phase 13 (T1): Data & Indicators — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `13-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 13-t1-data-and-indicators
**Areas discussed:** Chart library, Ticker coverage, Rollout posture (/ta visibility + mobile baseline), OHLCV backfill scope
**Mode:** Standard interactive (no `--auto`, no `--chain`, no advisor mode)

---

## Gray Area Selection

| Option | Description | Selected |
|---|---|---|
| Chart library choice | Recharts ComposedChart vs lightweight-charts vs ECharts (research-rejected) | ✓ |
| Ticker coverage at launch | Source of the ~100-ticker seed list | ✓ |
| Rollout posture (/ta visibility + mobile baseline) | Header link timing + mobile UX during T1→T4 window | ✓ |
| OHLCV backfill scope in T1 | 5yr backfill in T1 vs deferred to Phase 15 prep | ✓ |

**User's choice:** All four (multi-select).
**Notes:** User explicitly engaged with the rollout-vs-coverage-vs-risk tradeoffs rather than punting any.

---

## 1. Chart Library

| Option | Description | Selected |
|---|---|---|
| lightweight-charts | Purpose-built OHLC, native marker API, TradingView aesthetic, ~250KB Apache-2.0, new dep | ✓ |
| Recharts ComposedChart | Reuse v1.0 dep, zero new bundle, custom Shape needed for candles, custom T2 marker overlay | |
| Defer — prototype both Wave 1 | ~2 days throwaway work, decide at end of week 1 | |

**User's choice:** lightweight-charts (Recommended).
**Notes:** Native marker API for T2 + TradingView aesthetic recognition by IDX retail investors anchored the call. Bundle cost is route-scoped, not global.

---

## 2a. Ticker Seed Source

| Option | Description | Selected |
|---|---|---|
| Handpicked LQ45 + ~55 mid-caps | All hard-coded JSON in repo; predictable, all-in-repo | |
| Market-cap top-100 from yahoo-finance2 | One-shot script queries yahoo at Wave 0; data-driven | ✓ |
| Composite (hard-coded LQ45 + query filler) | LQ45 locked + ~55 from yahoo query | |

**User's choice:** Market-cap top-100 from yahoo-finance2.
**Notes:** User preferred data-driven over hand-curated. Accepted small-cap coverage risk (mitigated by follow-up filter decision).

## 2b. Minimum-History Filter

| Option | Description | Selected |
|---|---|---|
| Filter to ≥2yr history | Drop recent IPOs; final list 85–100 tickers | ✓ |
| Filter to ≥30 candles only | Match sparse-data threshold; recent IPOs kept | |
| No filter — raw top-100 | Maximises coverage, degrades quality | |

**User's choice:** Filter to ≥2yr history (Recommended).
**Notes:** Avoids autocomplete entries that immediately hit the sparse-data state.

---

## 3a. /ta Surface Visibility

| Option | Description | Selected |
|---|---|---|
| After VERIFICATION.md lands | `NEXT_PUBLIC_TA_ENABLED` env flag, flips post-Wave 3 | ✓ |
| As soon as Wave 2 ships SiteHeader | Link visible immediately, accepts incomplete UX | |
| Coming-soon landing from Wave 0 | Visible "vapor" for ~2 weeks of T1 | |

**User's choice:** After VERIFICATION.md lands (Recommended).
**Notes:** Matches v1.0 quality bar. Preview deploys remain functional for internal testing without exposing public users to incomplete TA.

## 3b. Mobile Baseline at T1

| Option | Description | Selected |
|---|---|---|
| Desktop-only — "Best on desktop" card | <640px shows info card + v1.0 link; T4 replaces entirely | ✓ |
| Best-effort mobile (horizontal scroll) | Chart at desktop width on phones; functional but ugly | |
| Tablet-up gate (chart ≥768px, summary on phones) | Middle ground | |

**User's choice:** Desktop-only — "Best on desktop" card (Recommended).
**Notes:** Clean cut. T4 (Phase 16) owns the full mobile polish — no half-finished UI in production during T1→T4 window.

---

## 4. OHLCV Backfill Scope

| Option | Description | Selected |
|---|---|---|
| Ship 5yr backfill in T1 Wave 0/1 | Combined `seed-and-backfill.ts`; T3 unblocked at start | ✓ |
| 1yr live via cron only, defer backfill to Phase 15 prep | Smaller T1 scope; kills T2 ‖ T3 parallelization | |
| Hybrid — 2yr in T1, top up to 5yr at Phase 15 | Cleaner narrative; two scripts | |

**User's choice:** Ship 5yr backfill in T1 Wave 0/1 (Recommended).
**Notes:** Preserves ROADMAP's T2 ‖ T3 parallelization design. The seed-tickers script (D-02) and backfill combine into one Wave 0 deliverable. Yahoo gap handling required.

---

## Claude's Discretion

The following were explicitly delegated to the planner (recorded in CONTEXT.md `<decisions>` "Claude's Discretion"):
- lightweight-charts subpanel sync wiring
- Indicator-snapshot strip exact copy + severity-adjective tone
- Dispatcher cron migration sequencing strategy (same-deploy vs fallback)
- ONNX hello-world smoke (TA-INFRA-04) measurement protocol
- Wave 1 intra-wave parallelization details
- `ohlcv_cache` / `ticker_metadata` schema specifics
- `src/lib/internal-auth.ts` extraction details

## Deferred Ideas

Out-of-T1 scope, recorded in CONTEXT.md `<deferred>`:
- All Phase 14 (T2) work: patterns, Gemini explanation, three-tier disclaimer framework, TA-INFRA-03 bilingual sanitizer extraction.
- All Phase 15 (T3) work: XGBoost training, ONNX inference, probability widget. (T1 deploys only a hello-world dummy `.onnx` for cold-start measurement.)
- All Phase 16 (T4) work: TA chat, per-IP rate limiting on `/api/ta/*`, Langfuse on TA Gemini, full mobile polish, 30-prompt CHAT-06 red-team.
- v1.0 backlog R2 / R3 / R4 stay deferred (R1 closes implicitly via TA-INFRA-02).
- v1.0 VERIFICATION.md paperwork debt stays deferred.

---

*End of discussion log.*
