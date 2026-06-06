# TA Module — Stack Research

**Researched:** 2026-06-06
**Domain:** Server-side technical analysis (indicators + pattern detection + ONNX inference) inside Next.js 15 / Vercel Hobby
**Confidence:** MEDIUM (architectural) / LOW (versions — see banner)

---

> ## ⚠ VERSION CLAIMS UNVERIFIED IN THIS RESEARCH PASS
>
> This document was written without live access to npm registry, package
> docs, or web search. Every `version: x.y.z` claim is tagged `[ASSUMED]`
> based on training-data knowledge through August 2025 and the seed's
> recommendations from June 2026. Downstream consumers — requirements-
> definer, roadmapper, and plan-phase — MUST run `npm view <pkg> version`
> to confirm before pinning in package.json or in any acceptance criterion.
>
> The **architectural analysis** below (tier ownership, cold-start cost,
> integration map, what-not-to-add) does NOT depend on patch versions and
> is the high-value content of this document. Read those sections with
> normal confidence. Read the version table with verification scheduled.

---

## Summary

The TA module adds **two genuinely new server-side dependencies** to the existing v1.0 stack: `technicalindicators` (pure-JS indicator math) and `onnxruntime-node` (native binary for XGBoost inference). Everything else — OHLCV ingestion, charting, LLM, caching, DB — is satisfied by libraries v1.0 already ships. The architectural question is not which libraries to add; it is **where `onnxruntime-node` lives in the request lifecycle on Vercel Fluid Compute**, because the native binary's cold-start unpacking cost (the .node binary plus the .onnx model file) directly threatens the seed's < 4s cache-miss target.

The Python ONNX export pipeline (`skl2onnx` + `xgboost`) is **offline training infrastructure**, not a production dependency. It must be documented as a developer-machine workflow whose output is a versioned `.onnx` artifact (committed to repo or fetched from Supabase Storage at boot). The deployed Vercel runtime never sees Python.

**Primary recommendation:** Treat `onnxruntime-node` as the load-bearing risk of the entire module. Validate cold-start latency and Fluid Compute compatibility in Phase T1 (before model work begins in T3) with a hello-world ONNX file, so T3 doesn't discover infrastructure-level blockers after weeks of training work.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| OHLCV ingestion (yahoo-finance2) | API / Backend (Vercel serverless) | DB cache (Supabase `ohlcv_cache`) | yahoo-finance2 is server-only — CORS-blocked from browser; results MUST be cached in DB since Vercel functions are stateless |
| Indicator computation (`technicalindicators`) | API / Backend | None | Pure CPU, deterministic, < 200ms target — runs inside the same API route that fetched OHLCV |
| Rule-based pattern detection (candlestick + chart) | API / Backend | None | Same trip as indicators; reuses outputs (e.g., ATR for chart-pattern volatility filters) |
| ONNX model inference (`onnxruntime-node`) | API / Backend | None | Native binary, single-region warmth, MUST live in Node.js runtime (NOT Edge runtime) |
| Offline model training (Python + XGBoost + skl2onnx) | Developer machine | None — **NEVER** ships to Vercel | One-time / periodic; produces a `.onnx` artifact only |
| `.onnx` model artifact storage | Repo (`/models/pattern-clf-vYYYYMMDD.onnx`) or Supabase Storage | None | Repo simpler if model < 50 MB; Supabase if larger or rotated frequently |
| Gemini explanation | API / Backend (`@google/genai` via Vercel AI SDK) | Langfuse trace | Reuses v1.0 streaming infrastructure verbatim |
| Candlestick rendering | Browser | None | Recharts v3 (already in stack); OHLC composed from `<ComposedChart>` |
| Chart pattern overlays | Browser | None | SVG markers driven by pattern indices returned from API |
| Result caching | DB (`ta_analysis_cache`) | Next.js `unstable_cache` | Two-tier as in seed §10; Vercel instance cache is best-effort, Supabase is source of truth |
| Pre-warm cron | Vercel Cron → API route | DB write | Reuses v1.0 cron mechanics (see R1 cron auth gotcha — applies here too) |

---

## Standard Stack

### New (TA-module-specific)

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `technicalindicators` | `3.1.0` `[ASSUMED]` | Compute RSI, MACD, Bollinger, EMA, SMA, ATR, Stochastic, OBV in pure JS | Only widely-used pure-JS TA library with all 10 seed-required indicators in one package; named in seed §5 |
| `onnxruntime-node` | `1.20.x` `[ASSUMED — confirm range]` | Run exported XGBoost classifier in Node.js without Python | Only realistic option for "trained-in-Python, served-in-Node" without a separate inference service |

### Existing (reused — confirmed in v1.0)

| Library | Version | Purpose | Status |
|---|---|---|---|
| Next.js | `15.x` `[ASSUMED — v1.0 baseline]` | App Router, server actions, route handlers | Already shipped |
| `yahoo-finance2` | `3.14.x` `[ASSUMED — v1.0 baseline]` | OHLCV historical data via `.JK` tickers | Already shipped (Phase 9) |
| Recharts | `v3` `[ASSUMED — v1.0 baseline]` | Candlestick chart, indicator subpanels | Already shipped |
| `@google/genai` | per v1.0 | Gemini 2.5 Flash streaming | Already shipped |
| Vercel AI SDK | `4.x` `[ASSUMED — v1.0 baseline]` | `streamText`, `useChat` for follow-up chat | Already shipped |
| Supabase Postgres + pgvector | per v1.0 | `ohlcv_cache`, `ta_analysis_cache`, `pattern_outcome_log` | Already shipped |
| Langfuse | per v1.0 | LLM trace, prompt versioning, eval | Already shipped (Phase 11) |
| shadcn/ui + Tailwind v4 | per v1.0 | UI primitives | Already shipped |
| Vitest | per v1.0 | Unit/integration tests | Already shipped |
| t3-env | per v1.0 | Type-safe env access | Already shipped |
| `server-only` | per v1.0 | Prevent server-only modules leaking to client | **CRITICAL for `onnxruntime-node` import boundaries** |

### Offline training (developer-machine only — NEVER deployed)

| Tool | Version | Purpose | Notes |
|---|---|---|---|
| Python | `3.11+` `[ASSUMED]` | Runtime for training pipeline | Local venv only; not in any production image |
| `xgboost` | `2.x` `[ASSUMED]` | Train `XGBClassifier` 3-class model | Match the version `skl2onnx` supports — skew here silently produces broken ONNX |
| `scikit-learn` | `1.4+` `[ASSUMED]` | Calibration (Platt / isotonic), train/test split | Required by `skl2onnx` |
| `skl2onnx` | `1.16+` `[ASSUMED — confirm XGBoost-compatible range]` | Export trained model to ONNX | **Single point of failure** — XGBoost↔skl2onnx↔onnxruntime triangle is the most common cause of ONNX silently wrong outputs |
| `onnx` | `1.15+` `[ASSUMED]` | Validate exported model file | Run `onnx.checker.check_model()` on every export; commit a SHA256 |
| `yfinance` | `0.2.x` `[ASSUMED]` | Bulk OHLCV download for training corpus | Python equivalent of `yahoo-finance2`; same fragility caveats |
| `pandas`, `numpy` | latest stable `[ASSUMED]` | Feature engineering | Standard |

**This whole stack runs on a laptop. None of it ships to Vercel. The deliverable is a `.onnx` file plus its SHA256.**

### Alternatives Considered (and rejected)

| Instead of | Could Use | Why Rejected |
|---|---|---|
| `technicalindicators` | `tulind` | C++ native bindings (libta-lib); **breaks Vercel builds** identically to how `pdf-parse` was rejected in v1.0. Same rejection rationale applies. |
| `technicalindicators` | `trading-signals` | Smaller community; uncertain whether all 10 seed indicators ship in one package; no clear win for the re-evaluation cost |
| `technicalindicators` | Hand-roll RSI/MACD | False economy. RSI has 3 valid formulations (Wilder vs simple vs Cutler), MACD signal smoothing has off-by-one warmup ambiguity, Stochastic %K/%D has variants. Hand-rolling means owning "your RSI doesn't match TradingView" bug reports. |
| Candlestick patterns from `technicalindicators` | `candlestick-convention`, custom rules | **Use `technicalindicators` built-in pattern functions first** — it ships hammer, doji, engulfing, etc. Fall back to a separate package only for missing seed §6.1 patterns. `[ASSUMED — confirm pattern coverage]` |
| `onnxruntime-node` | `onnxruntime-web` (WASM, browser) | **Wrong tier.** The model output drives the cached server response and the LLM prompt; browser inference would (a) ship the model file to every client, (b) leak the model to anyone running devtools, (c) prevent server-side caching of the probability, (d) make probability appear before the cache entry exists. |
| `onnxruntime-node` | Python inference microservice (FastAPI on Fly.io/Railway) | Adds a second hosting bill (violates $0/month), a second deploy pipeline, a network hop per request, and a second secret. ONNX-in-Node exists specifically to avoid this. |
| `onnxruntime-node` | LightGBM via `lightgbm-node` | Smaller ecosystem; XGBoost→ONNX is the well-trodden path; switching framework changes Q1/Q2 calibration research conclusions |
| `onnxruntime-node` | Pure-JS XGBoost loader (`treelite`, custom) | None production-grade for Node.js with calibrated outputs; ONNX is the standard interchange format and `onnxruntime-node` is its reference Node binding |
| Recharts candlestick | TradingView Lightweight Charts | Adds 250KB+ bundle, license review needed; Recharts `ComposedChart` with custom Bar shape renders acceptable candlesticks; staying on Recharts keeps v1.0 consistency |
| Recharts candlestick | `react-financial-charts` | Larger bundle, niche maintenance; only consider if Recharts proves inadequate after a real prototype |

### Installation

```bash
# Production deps (Vercel runtime)
pnpm add technicalindicators onnxruntime-node

# Offline training (developer machine only — DO NOT commit to package.json)
python -m venv .venv-train && source .venv-train/bin/activate
pip install xgboost scikit-learn skl2onnx onnx yfinance pandas numpy
```

---

## Architecture Patterns

### Integration Map — Where Each New Dep Touches v1.0 Modules

| New dep | Touches existing module | Surface area |
|---|---|---|
| `technicalindicators` | None (greenfield) | `lib/ta/indicators.ts` — new file, server-only |
| `onnxruntime-node` | None directly; **conflicts with `server-only` boundary if mis-imported** | `lib/ta/model/inference.ts` — MUST start with `import 'server-only'` |
| `yahoo-finance2` (existing) | Phase 9 stock-data fetcher | Add OHLCV history call alongside existing quote/ratio calls; consider shared rate-limiter |
| Recharts (existing) | Phase 9 trend chart | Add `<ComposedChart>` with candle shape; new component, doesn't modify existing |
| `@google/genai` (existing) | Phase 6 explanation, Phase 10 chat | New system prompt only; **reuse Phase 10 CHAT-06 post-processing filter verbatim** (seed §8, decision-doc §2) |
| Supabase (existing) | Phase 4 vector schema, Phase 9 stock cache | New tables only (`ohlcv_cache`, `ta_analysis_cache`, `ta_session_views`, `pattern_outcome_log`, `ticker_metadata`); zero changes to existing |
| Vercel Cron (existing) | Phase 12 nightly batches | New cron entry; **inherits the R1 cron auth method mismatch** — fix R1 before or as part of T4 |
| Langfuse (existing) | Phase 11 OBS-01 | Add `trace_id` per TA analysis; tag with `module=ta` for separable dashboards |

### Where Things Sit in Next.js 15 App Router

```
src/
├── app/
│   ├── ta/
│   │   ├── [ticker]/page.tsx          ← Server Component, fetches initial analysis
│   │   └── layout.tsx
│   └── api/ta/
│       ├── analysis/[ticker]/route.ts ← Node runtime (NOT edge)
│       ├── search/route.ts            ← Edge-safe (no onnx, no native deps)
│       ├── patterns/[ticker]/route.ts
│       └── chat/route.ts              ← Streaming, Node runtime
├── lib/ta/
│   ├── indicators.ts                  ← server-only; technicalindicators wrapper
│   ├── patterns/
│   │   ├── candlestick.ts             ← server-only; rule-based detectors
│   │   └── chart.ts                   ← server-only; peak/trough analysis
│   ├── model/
│   │   ├── inference.ts               ← server-only; ort wrapper
│   │   └── session.ts                 ← lazy-init InferenceSession singleton
│   ├── data/
│   │   ├── ohlcv.ts                   ← yahoo-finance2 + ohlcv_cache R/W
│   │   └── tickers.ts                 ← IDX ticker validation regex
│   ├── cache.ts                       ← ta_analysis_cache R/W
│   └── prompts.ts                     ← Gemini system prompts (versioned)
├── components/ta/
│   ├── candlestick-chart.tsx          ← Recharts client component
│   ├── indicator-panel.tsx
│   ├── pattern-marker.tsx
│   └── probability-bar.tsx
└── models/
    └── pattern-clf-vYYYYMMDD.onnx     ← committed artifact (if < 50 MB)
                                          OR pulled from Supabase Storage at boot
```

**Runtime declaration on every TA API route:**

```typescript
export const runtime = 'nodejs';        // NOT 'edge' — onnxruntime-node is native
export const maxDuration = 60;          // Vercel Hobby cap; stream early
export const dynamic = 'force-dynamic'; // never statically render a price-bearing route
```

Forgetting `runtime = 'nodejs'` is the most common Vercel mistake when adding native deps.

### Pattern: ONNX Session as Lazy Singleton

```typescript
// lib/ta/model/session.ts
import 'server-only';
import * as ort from 'onnxruntime-node';
import path from 'node:path';

let sessionPromise: Promise<ort.InferenceSession> | null = null;

export function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    const modelPath = path.join(process.cwd(), 'models', 'pattern-clf-v20260606.onnx');
    sessionPromise = ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
    });
  }
  return sessionPromise;
}
```

**Why singleton:** `InferenceSession.create()` is the expensive call. It MUST happen at most once per Lambda instance. The promise pattern ensures concurrent first requests don't race.

**Why `cwd()`:** Vercel sets cwd to the deployment root; `__dirname` is unreliable across bundlers.

### Pattern: Streaming Around Slow ONNX

If the first request to a cold Lambda hits the model-load path, ONNX init stalls the response. Mitigations:

1. **Pre-warm cron** (seed §14 Phase T4) — hit `/api/ta/analysis/BBCA.JK` for top-50 tickers nightly.
2. **Stream the LLM response first**, update probability widget when ONNX returns — UI complexity cost.
3. **Skip ONNX on first cache-miss**, return rule-based patterns only with "probability loading…" placeholder — UI affordance cost.

Mitigation 1 is cheapest and aligned with seed §14; pursue first.

### Anti-Patterns to Avoid

- **`onnxruntime-web` on the server.** Wrong tier; throws away the perf advantage and adds bundle weight.
- **Bundling the .onnx file via `import`.** Some bundlers inline binary assets. Read with `fs`/`path`; keep it out of the JS bundle.
- **Loading ONNX in a route file's module scope.** Triggers load on every cold start regardless of usage. Lazy via singleton getter only.
- **Edge runtime for any TA route that calls inference.** No Node `fs`, no native modules, small bundle ceiling.
- **Running Python in production to call XGBoost.** Explicitly ruled out by Decision 4 and the v1.0 budget.
- **`tulind` or any TA-Lib wrapper.** Same build failure mode as `pdf-parse` in v1.0. Pure-JS or nothing.
- **Importing `onnxruntime-node` in a client component.** App Router will try to bundle it. `import 'server-only'` at the top of every file that touches it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Technical indicators | Custom RSI/MACD/Bollinger | `technicalindicators` | Multiple valid formulations exist; users will compare to TradingView/Stockbit |
| Candlestick rules | Custom doji/hammer detectors | `technicalindicators` built-ins (verify) → fallback only for gaps | Edge cases have decades of convention; reinventing creates bug surface |
| Peak/trough detection | Naive local-max scan | `technicalindicators` helpers if present, OR a small Zigzag built on ATR | Noise-tolerant peak detection is non-trivial; ATR-scaled thresholds are standard |
| Gradient boosting in JS | Hand-port XGBoost trees | ONNX export + `onnxruntime-node` | Tree-encoding has hundreds of subtle invariants; ONNX is the interchange standard |
| Probability calibration | DIY Platt scaling in JS | Calibrate in Python (`CalibratedClassifierCV`), bake into exported ONNX graph | Calibration coefficients must travel with the model |
| OHLCV ingestion | Direct HTTP scraping of Yahoo | `yahoo-finance2` (already in stack) | Already solved in v1.0; reuse client + cache pattern |
| Buy/sell filter | New filter | **Reuse Phase 10 CHAT-06 filter verbatim** | Seed §8 and decision-doc §2 both say this; building two filters creates drift |
| Cron auth | Custom header check | Reuse v1.0 pattern (fix R1 first) | Inheriting R1's bug is a known risk |
| Ticker validation | Loose regex | `/^[A-Z]{1,6}(\.JK)?$/` (seed §11) | Already specified; enforce centrally in `lib/ta/data/tickers.ts` |

**Key insight:** The TA module's value-add is *the explanation layer plus IDX-specific calibration*, not new indicator math, not a new ML engine, not new charting primitives. Anything that smells like reimplementing common-knowledge financial math defaults to a library.

---

## Cold-Start Cost Honesty — `onnxruntime-node` on Vercel Fluid Compute

This section is the most important risk discussion in the document.

### What happens on a cold start

1. Vercel routes the request to a Lambda instance that hasn't run this function before (or has been idle past the freeze window).
2. The Lambda mounts the deployment bundle. With `onnxruntime-node` installed, the bundle contains the `node_modules/onnxruntime-node/bin/napi-v3/<platform>/<arch>/onnxruntime_binding.node` native shared object (typically several MB) plus `libonnxruntime.so.<ver>` (tens of MB on Linux x64).
3. `require('onnxruntime-node')` resolves and `dlopen`s the .node binary. Fast once the file is on local disk, but preceded by Lambda's content-addressable bundle extraction.
4. `getSession()` reads the `.onnx` file from disk (5–50 MB typical for a small XGBoost classifier) and `InferenceSession.create()` parses it, builds the execution graph, allocates the CPU memory arena.

Steps 2–4 are the **cold-start tax**. On Vercel Hobby with `nodejs` runtime and default memory, expect this to add **somewhere between 500ms and 3000ms** to the first request `[ASSUMED — VERIFY with real measurement in Phase T1]`. Variance comes from .onnx size (linear), Lambda CPU tier (more memory = more vCPU = faster init), Fluid Compute warmth (statistical, not guaranteed), and whether the Linux x64 native binding is present.

### Why this matters for the seed's targets

| Seed §12 Target | Cold-start risk |
|---|---|
| Chart load (cache hit) < 1.5s | **Safe** — cache hit doesn't call ONNX |
| Chart load (cache miss) < 4s | **At risk** — 4s includes OHLCV fetch (~500ms) + indicators (~200ms) + ONNX init (~500–3000ms cold) + ONNX inference (~100ms) + LLM first token (~1500ms). Cold-start could eat most of the budget. |
| ONNX inference < 100ms | **Safe for warm** — inference proper is fast; the target excludes session creation |

The 4s cache-miss target depends on the ONNX session being warm. With Vercel Hobby and bursty traffic, warm cannot be assumed for non-pre-warmed tickers. **Pre-warm is not optional**; it is load-bearing for the SLA.

### Fluid Compute interaction

Fluid Compute (Vercel's concurrent-invocation evolution) is mostly good news for `onnxruntime-node`: a single warm instance serves concurrent requests against the same loaded session, amortizing init cost. The singleton pattern works because the module is evaluated once per instance. **But:** Fluid Compute is single-region by default on Hobby, and instance warmth is best-effort. The seed assumes "Vercel serverless" without distinguishing Edge / Standard Serverless / Fluid Compute — needs explicit decision in PLAN.

### What to validate in Phase T1 (before T3 ML work begins)

1. Deploy a hello-world TA route that loads a 5 MB dummy `.onnx` and runs a single inference.
2. Measure cold-start latency from a fresh deploy (Vercel function logs `INIT_DURATION`).
3. Measure warm latency under concurrent load.
4. Confirm `onnxruntime-node` installs cleanly on Vercel (Linux x64 native binding ships).

If T1 reveals cold-start consistently > 5s, the architecture needs revisiting (smaller model, different runtime, or async probability). Discovering this in T3 after weeks of training is a catastrophic timeline hit.

---

## What NOT To Add (with concrete reasons)

| Don't add | Concrete reason |
|---|---|
| `onnxruntime-web` | Server-side inference is correct (cacheable, model-private, no client weight); WASM is the wrong tier |
| `tulind` | Native C++ bindings (libta-lib) require system compilation at install — **breaks Vercel builds** identically to `pdf-parse` rejection in v1.0 (CLAUDE.md §4) |
| Any `node-gyp`-compiled TA library | Same; the rule for Vercel: if it needs a C++ compiler at `npm install`, it fails |
| `python-shell` / spawn Python in production | Violates Decision 4; Python isn't a first-class Vercel runtime for synchronous request handling; would need a separate hosted Python service ($) |
| Long-lived Python inference service on Railway/Fly | $5–10/month minimum; violates $0/month constraint; ONNX export exists to avoid this |
| LangChain | Explicitly rejected in CLAUDE.md §14; same logic applies to TA chat |
| Pinecone / Qdrant / Weaviate for TA caching | Already rejected for v1 RAG; pgvector / plain Postgres is sufficient (TA cache is keyed by ticker+date — no vector search needed) |
| TradingView Lightweight Charts | License review required; Recharts can render candlesticks via `ComposedChart`; resist tool-of-the-week |
| `react-financial-charts` | Large bundle for one chart type; adopt only if Recharts genuinely fails after prototyping |
| Alpha Vantage / Polygon / Finnhub | Free-tier rate limits incompatible with seed ticker volume (Alpha Vantage 25/day already rejected in CLAUDE.md §9) |
| WebSocket data feeds | EOD-only per Decision 3; persistent connections incompatible with serverless |
| Redis / Upstash | Supabase + `unstable_cache` covers seed §10; Redis adds vendor and $ |
| BullMQ / queue libraries | Vercel Cron + route handler is sufficient for the EOD batch pattern |
| Sentry, Datadog, etc. | Langfuse covers LLM observability; Vercel function logs cover runtime errors; resist paid observability for $0 budget |

---

## Common Pitfalls

### Pitfall 1: XGBoost ↔ skl2onnx ↔ onnxruntime version skew
**What goes wrong:** Trained model exports without error but produces silently wrong probabilities in Node — or fails to load with a cryptic opset error.
**Why:** Three-way version compatibility. XGBoost's ONNX export changes by version; `skl2onnx` supports a target opset range; `onnxruntime-node` supports a min/max opset.
**How to avoid:** Pin all three versions in the training README; treat upgrades as a deliberate migration. After every export, run inference on the **same** test input in Python (`onnxruntime` Python bindings) and Node (`onnxruntime-node`); assert outputs match to 1e-6. Bake into CI.
**Warning signs:** Python and Node probabilities differ; load throws `InvalidGraph`/`OpsetMismatch`; load succeeds but inference returns NaN.

### Pitfall 2: Vercel runtime auto-detection picks `edge`
**What goes wrong:** Route works locally; production fails with `Cannot find module 'onnxruntime-node'` or `dlopen failed`.
**Why:** Edge runtime doesn't support native modules. App Router infers runtime from imports in some configs; mixed signals confuse the picker.
**How to avoid:** Explicitly declare `export const runtime = 'nodejs'` at the top of every TA API route. Code-review block on its absence.
**Warning signs:** Local dev fine; production 500s with module-not-found on first request.

### Pitfall 3: `technicalindicators` period-off-by-one alignment
**What goes wrong:** RSI[0] aligns to date[0] in UI, but `technicalindicators` returns RSI starting from the (period)th input. Off-by-one in alignment shifts the indicator left by one day from price.
**Why:** Every indicator has a warmup period (RSI 14, MACD 33, Bollinger 19). Library returns shorter arrays than input; you must pad with `null` from the left. Seed §5 implies this via the `align()` helper — get the warmup constant wrong and the chart silently lies.
**How to avoid:** Document warmup lengths in a constants file. Unit-test alignment (last RSI pairs with last close; leading-nulls count equals warmup). Cross-check first 50 values against TradingView for one IDX ticker.
**Warning signs:** Indicator visually leads/lags price by one bar; pattern markers fire on the wrong candle.

### Pitfall 4: yahoo-finance2 silent failures on IDX `.JK`
**What goes wrong:** Some `.JK` tickers (low-volume small caps, delisted) return empty/partial/stale data without throwing.
**Why:** yahoo-finance2 is an unofficial client; Yahoo treats less-liquid foreign tickers as second-class.
**How to avoid:** Always validate: minimum bar count, last date within N business days of today, no NaN OHLCV. Treat empty/short responses as hard errors. Log to Langfuse with `data_quality_warning` tag. Document a fallback test list (BBCA, TLKM, BBRI, ASII, GOTO).
**Warning signs:** Specific tickers always have stale `data_as_of`; chart shows fewer bars than requested.

### Pitfall 5: Cron auth method mismatch propagates from v1.0 R1
**What goes wrong:** New TA pre-warm cron inherits R1 — `vercel.json` uses `?secret=` but new handler validates `Authorization: Bearer`, so cron pings return 401 and pre-warm silently never runs.
**Why:** R1 is open in PROJECT.md Active; new cron will follow existing handler pattern.
**How to avoid:** Fix R1 *before or as part of* T4. Add TA cron only after the auth method is unified.
**Warning signs:** Vercel cron logs 401s; pre-warm hit rate stays at 0; cache-miss latency stays in the cold-start band.

### Pitfall 6: ONNX file location in bundled deployment
**What goes wrong:** Local dev finds `models/pattern-clf-v20260606.onnx`; deployed Lambda throws ENOENT.
**Why:** Vercel build copies files per `next.config` + `outputFileTracing`. Files outside `app/`, `pages/`, `public/`, or traced paths may not be included.
**How to avoid:** Either put `.onnx` in `public/` (downside: publicly downloadable), or use `outputFileTracingIncludes`, or store in Supabase Storage and download at session-init. Decide in T3 PLAN, not at deploy.
**Warning signs:** Deploy succeeds; first inference fails ENOENT; works in dev only.

---

## Open Stack Risks (To Surface to Roadmapper)

1. **ONNX runtime instability under Fluid Compute (HIGH).** `onnxruntime-node` is well-supported on Linux x64 in general, but its interaction with Vercel Fluid Compute's concurrency model is not first-party-documented. Risk isn't "doesn't work" — it's "works inconsistently under bursty load." Mitigation: Phase T1 deploy-and-measure step before T3 begins.

2. **`technicalindicators` period-off-by-one history (MEDIUM).** Stable API but recurring GitHub-issue confusion about warmup periods and alignment. Risk: subtle indicator-vs-price misalignment ships unnoticed. Mitigation: explicit alignment tests in T1 acceptance; cross-check against TradingView.

3. **yahoo-finance2 unofficial-API fragility (MEDIUM, accepted in v1.0).** Known v1.0 risk; TA module amplifies blast radius because TA depends on 1+ years of history per ticker. A Yahoo schema change could break TA at scale before it breaks v1.0 stock-context. Mitigation: rigorous response validation (Pitfall 4); plan Stooq fallback (seed §15) at T1, not at incident time.

4. **Gemini quota stacking (HIGH, pre-existing as Q3).** TA stacks explanation + chat on top of v1.0's Phase 6 + Phase 10 burn. Q3 in `questions.md` unresolved. Risk: TA launch degrades v1.0 quality under shared 250 RPD cap. Mitigation: Q3 must close before T4; default TA follow-up chat to Groq fallback per CLAUDE.md §2.

5. **ONNX model file rotation (MEDIUM).** No versioning strategy for retraining/redeploying the `.onnx` artifact. Risk: model staleness; no audit trail for "which model produced this probability." Mitigation: include model filename hash in `ta_analysis_cache.llm_model_version` (or parallel column); never overwrite — always rotate by filename.

6. **Disclaimer-filter drift between v1 chat (CHAT-06) and TA chat (LOW if reused, HIGH if duplicated).** Two filters means two update sites when a new banned phrase emerges. Mitigation: extract v1 CHAT-06 filter into shared `lib/safety/buy-sell-filter.ts` during T2.

7. **Bundle size impact of `onnxruntime-node` (LOW–MEDIUM).** The native binary doesn't ship in the JS bundle but counts toward Vercel function-bundle limits. Risk: with `.onnx` included, function may approach the limit. Mitigation: monitor Vercel deploy logs; if needed, fetch `.onnx` from Supabase Storage at boot.

---

## Verification Checklist for the Next Agent

Run before pinning any version in `package.json` or in plan acceptance criteria. Flag failing or unexpected output in the requirements-definer / plan-phase response.

```bash
# === Versions ===
npm view technicalindicators version
npm view technicalindicators time --json | head -50
npm view technicalindicators dependencies
npm view technicalindicators engines

npm view onnxruntime-node version
npm view onnxruntime-node engines
npm view onnxruntime-node os                       # MUST include linux
npm view onnxruntime-node cpu                      # MUST include x64
npm view onnxruntime-node dist.unpackedSize        # informs cold-start budget
npm view onnxruntime-node time --json | head -50

# Already in v1 stack — re-confirm still current
npm view yahoo-finance2 version
npm view recharts version
npm view @google/genai version
npm view ai version
npm view next version

# === Pattern coverage ===
# Confirm technicalindicators ships the 12 seed §6.1 candlestick patterns:
#   Doji, Hammer, Hanging Man, Inverted Hammer, Shooting Star,
#   Bullish/Bearish Engulfing, Morning Star, Evening Star,
#   Three White Soldiers, Three Black Crows, Bullish/Bearish Harami
npm view technicalindicators
# Or read package: pnpm dlx tarball technicalindicators | tar -tzv | grep -i candle

# === Python training stack (dev machine only) ===
pip index versions xgboost
pip index versions skl2onnx
pip index versions scikit-learn
pip index versions onnx
pip index versions yfinance
# Cross-version compatibility check (CRITICAL):
#   xgboost X.Y + skl2onnx A.B + onnxruntime-node M.N
#   Document the tested triplet in the training README.

# === Vercel runtime compatibility ===
ls node_modules/onnxruntime-node/bin/napi-v3/linux/x64/

# === Deploy-and-measure (Phase T1 acceptance) ===
# Deploy a hello-world TA route loading a 5 MB dummy .onnx.
# Read Vercel function logs for INIT_DURATION on cold starts.
# Target: cold INIT_DURATION + first inference < 3000ms
# (leaves 1000ms for OHLCV + LLM first token within the 4s SLA).

# === yahoo-finance2 IDX sanity ===
# Confirm 5-year OHLCV works for BBCA.JK, TLKM.JK, BBRI.JK, ASII.JK, GOTO.JK.
# Confirm last bar within 3 business days of today.

# === v1 risks to revisit ===
# R1 cron auth — still open? Confirm BEFORE adding TA pre-warm cron.
# Q3 Gemini quota — still open? Block T4 chat design on resolution.
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `technicalindicators @ 3.1.0` | Standard Stack | Wrong API; check `npm view` |
| A2 | `onnxruntime-node @ 1.20.x` | Standard Stack | ABI mismatch with .onnx files; check `npm view` |
| A3 | `technicalindicators` ships all 12 seed §6.1 candlestick patterns | Alternatives | If incomplete → need supplementary package or hand-rolled detectors |
| A4 | `skl2onnx` supports current `xgboost` 2.x exports cleanly | Training stack | Exported model loads in Python but fails in Node |
| A5 | Vercel Hobby `nodejs` runtime supports `onnxruntime-node` Linux x64 | Architecture | If unsupported → entire ONNX architecture invalid; T1 must validate before T3 |
| A6 | Cold-start ONNX init of a 5–50 MB model adds 500–3000ms on Hobby | Cold-Start | Numbers could be off an order of magnitude; T1 measures actual |
| A7 | `unstable_cache` + Supabase two-tier covers seed §10 | Architecture | If Fluid Compute changes instance-cache semantics, top-level hit rate drops |
| A8 | Recharts `ComposedChart` renders acceptable candlesticks | UI | If insufficient → consider `react-financial-charts`; bundle cost re-evaluation |
| A9 | yahoo-finance2 still supports `.JK` historical OHLCV at 5yr+ | Data ingestion | If broken → falls back to Stooq (seed §15) but requires research not done here |
| A10 | Vercel cron auth bug R1 still open; TA cron will inherit | Pitfalls | If R1 closes before T4, this becomes a non-issue |
| A11 | Gemini Q3 quota question unresolved at T4 start | Open Risks | If resolved with paid tier, design changes; if resolved with caching, T4 holds |

---

## RESEARCH COMPLETE
