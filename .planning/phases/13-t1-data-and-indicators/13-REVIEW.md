---
phase: 13-t1-data-and-indicators
reviewed: 2026-06-07T10:00:00Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - next.config.ts
  - package.json
  - scripts/ta/seed-and-backfill.ts
  - src/app/api/internal/analyze-batch/route.ts
  - src/app/api/internal/dispatch/route.ts
  - src/app/api/internal/embed-batch/route.ts
  - src/app/api/internal/parse-batch/route.ts
  - src/app/api/ta/analysis/[ticker]/route.ts
  - src/app/api/ta/onnx-smoke/route.ts
  - src/app/api/ta/search/route.ts
  - src/app/layout.tsx
  - src/app/ta/[ticker]/page.tsx
  - src/app/ta/page.tsx
  - src/app/ta/ta-chart-shell.tsx
  - src/components/site-header.tsx
  - src/components/ta/candlestick-chart.tsx
  - src/components/ta/chart-types.ts
  - src/components/ta/indicator-snapshot-strip.tsx
  - src/components/ta/indicator-subpanel.tsx
  - src/components/ta/indicator-tooltip.tsx
  - src/components/ta/mobile-info-card.tsx
  - src/components/ta/overlay-toggles.tsx
  - src/components/ta/range-selector.tsx
  - src/components/ta/sparse-data-card.tsx
  - src/components/ta/ta-error-card.tsx
  - src/components/ta/ta-page-skeleton.tsx
  - src/components/ta/ticker-search.tsx
  - src/db/database.types.ts
  - src/lib/env.ts
  - src/lib/internal-auth.ts
  - src/lib/ta/analysis-schema.ts
  - src/lib/ta/compute-indicators.ts
  - src/lib/ta/fetch-ohlcv.ts
  - src/lib/ta/indicator-schema.ts
  - src/lib/ta/jobs/refresh-ohlcv.ts
  - src/lib/ta/ohlcv-schema.ts
  - src/lib/ta/snapshot-copy.ts
  - src/lib/ta/ticker-route.ts
  - src/lib/ta/upsert-ohlcv.ts
  - src/lib/utils.ts
  - supabase/migrations/20260606130000_ta_t1_schema.sql
  - tests/ta/dispatcher-auth.test.ts
  - tests/ta/indicator-snapshot.test.ts
  - tests/ta/indicators.fixture.test.ts
  - tests/ta/ohlcv-uniqueness.test.ts
  - tests/ta/ohlcv-validation.test.ts
  - tests/ta/sparse-data.test.ts
  - tests/ta/ticker-routing.test.ts
  - vercel.json
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-07T10:00:00Z
**Depth:** standard
**Files Reviewed:** 48
**Status:** issues_found

## Summary

Phase 13 delivers the T1 data and indicators layer: OHLCV ingest, technical indicator computation, the TA analysis API route, a candlestick chart shell with subpanels, a ticker autocomplete search, and the full set of unit tests. The architecture is solid — timing-safe auth, idempotent upserts, Zod validation at trust boundaries, and explicit sparse-data gating are all implemented correctly.

Five warnings and four info items were found. No critical (security or crash-path) issues exist. The most impactful finding is a behavioral divergence between the seed script and the production `fetchOHLCV` path when an invalid bar is encountered: the seed script advances `prevClose` over rejected bars while `fetchOhlcv` resets it to `null`, meaning the two can accept or reject different sets of bars from the same raw data. The remaining warnings involve a missing env-schema declaration, an incomplete RSI scale constraint, an absent tooltip close mechanism, and a subtle subpanel sync-registration race.

---

## Warnings

### WR-01: `isValidBar` divergence between seed script and production ingest path

**File:** `scripts/ta/seed-and-backfill.ts:284-302` vs `src/lib/ta/fetch-ohlcv.ts:106-129`

**Issue:** The two `isValidBar` callers disagree on what to set `prevClose` to after a rejected bar.

- **`fetch-ohlcv.ts` (production):** resets `prevClose = null` after a rejected bar so the subsequent bar skips the >50% return check (line 127).
- **`seed-and-backfill.ts`:** advances `prevClose = b.close` (line 287) even for rejected bars — a rejected bar's close becomes the baseline for the next bar's check.

Consequence: for a sequence `[valid, invalid, candidate]`, the production path skips the return-filter for `candidate` (prevClose is null), but the seed path does filter `candidate` against the invalid bar's close. This means the seed can reject bars that production would accept (or vice versa), producing different valid sets for the same ticker — the very thing the shared export of `isValidBar` was meant to prevent (the comment on line 67 in the seed script says "keep in sync with fetch-ohlcv.ts").

**Fix:** The seed script should mirror production behavior exactly. Replace lines 284-289 in `seed-and-backfill.ts`:

```typescript
// Current (diverges from production):
if (!isValidBar(b, prevClose)) {
  rejectedCount++;
  prevClose = b.close;   // wrong — production resets to null
  continue;
}

// Correct (matches production fetch-ohlcv.ts):
if (!isValidBar(b, prevClose)) {
  rejectedCount++;
  prevClose = null;       // reset — skip >50% check for the bar after an invalid one
  continue;
}
```

---

### WR-02: `NEXT_PUBLIC_BASE_URL` used but not declared in `env.ts`

**File:** `src/app/ta/[ticker]/page.tsx:43`

**Issue:** The `getBaseUrl()` helper reads `process.env.NEXT_PUBLIC_BASE_URL` directly at line 43, bypassing the `env.ts` Zod schema. This breaks the project's "single source of truth for env vars" principle and means the variable is never validated or documented. Any typo in `.env.local` (e.g., `NEXT_PUBLIC_BASE_URL=not-a-url`) silently falls through to `http://localhost:3000` in production.

```typescript
// line 40-44 in src/app/ta/[ticker]/page.tsx
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"; // unvalidated
}
```

**Fix:** Add the variable to the client schema in `src/lib/env.ts` and read `env.NEXT_PUBLIC_BASE_URL` in the page, or replace the raw read with the already-present `CLARIFIN_APP_URL`:

```typescript
// In getBaseUrl() — use validated CLARIFIN_APP_URL from env.ts:
import { env } from "@/lib/env";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return env.CLARIFIN_APP_URL ?? "http://localhost:3000";
}
```

---

### WR-03: RSI subpanel `autoScale: false` sets no explicit visible price range

**File:** `src/components/ta/indicator-subpanel.tsx:150-153`

**Issue:** The RSI panel disables auto-scaling with `autoScale: false` but never calls `setVisiblePriceRange({ minValue: 0, maxValue: 100 })`. With `autoScale: false` and no explicit range, the lightweight-charts price scale defaults to an internally derived range that may clip RSI values near 0 or 100 (e.g., a strong trend that holds RSI at 80+ will appear as a flat line at the top of the panel with no margin).

```typescript
// line 150-153 — autoScale off but no range set:
chart.priceScale("right").applyOptions({
  autoScale: false,
  scaleMargins: { top: 0.05, bottom: 0.05 },
});
```

**Fix:** Add an explicit visible price range after creating the RSI series:

```typescript
chart.priceScale("right").applyOptions({
  autoScale: false,
  scaleMargins: { top: 0.05, bottom: 0.05 },
});

// Set fixed 0-100 range for RSI
rsiSeries.applyOptions({
  autoscaleInfoProvider: () => ({
    priceRange: { minValue: 0, maxValue: 100 },
    margins: { above: 5, below: 5 },
  }),
});
```

---

### WR-04: Subpanel sync subscriptions wired via `setTimeout(0)` may miss initial range

**File:** `src/components/ta/candlestick-chart.tsx:250-258`

**Issue:** The subpanel-to-main time-sync subscriptions are deferred via `setTimeout(0)` to wait for `subpanelCharts.current` to be populated. However, if a subpanel's `useEffect` fires in the same synchronous batch as the main chart's `useEffect` (which React may do during commit), the subpanels will call `onChartReady` before the `setTimeout` fires, and all three subscriptions will be set up correctly. But if the browser delays any subpanel render (e.g., due to paint prioritization), `subpanelCharts.current` may still be empty when the `setTimeout` fires, and those subpanels will not subscribe for time-sync until the next re-render.

This is an intermittent bug: the chart will look correct on most renders but subpanels may not scroll in sync on cold load in slow environments. The issue is logged in `13-PATTERNS.md` as "Pitfall 1" but the fix (the `setTimeout`) only partially addresses it.

**Fix:** Track ready state explicitly via a count and subscribe inside `onChartReady` once all three subpanels report ready:

```typescript
// Instead of setTimeout, subscribe inside handleSubpanelReady
const handleSubpanelReady = useCallback((chart: IChartApi) => {
  subpanelCharts.current.push(chart);
  // Wire both directions immediately when each subpanel is ready
  chart
    .timeScale()
    .subscribeVisibleTimeRangeChange(() =>
      syncFrom(chart, [mainChart.current, ...subpanelCharts.current])
    );
}, []);
```

Note: `mainChart` would need to be lifted into a ref for this to work. This is a non-trivial refactor; the existing `setTimeout(0)` approach is a pragmatic workaround that works in practice.

---

### WR-05: `TickerSearch` tooltip / dropdown has no explicit close-on-outside-click

**File:** `src/components/ta/ticker-search.tsx:43-44, 83`

**Issue:** The `open` state is set to `true` on `onFocus` (line 83) but there is no `onBlur` handler or click-outside handler to close the dropdown. Once the Command panel opens, it only closes when `handleSelect` is called (on item click). Pressing Escape, clicking outside the component, or tabbing away does not set `open` to `false`. The `isExpanded` computation on line 43 gates rendering of the `CommandList`, but the `open` flag itself never returns to `false` without a selection.

In practice, `cmdk`'s `Command` component handles Escape internally to clear the input value, which causes `query.length < 1` and hides the `CommandList` — so the visual result is correct. However, `aria-expanded` on the input remains `true` after Escape if the query was already empty, which is an accessibility contract violation (screen readers announce the listbox as expanded when it is visually hidden).

**Fix:** Add a reset on blur or use `cmdk`'s built-in `onEscapeKeyDown` prop, or observe when `query` drops to zero and reset `open`:

```typescript
useEffect(() => {
  if (query.length === 0) {
    setOpen(false);
  }
}, [query]);
```

---

## Info

### IN-01: `ohlcv_cache` and `ticker_metadata` RLS enabled with no permissive policies

**File:** `supabase/migrations/20260606130000_ta_t1_schema.sql:45-46`

**Issue:** Both tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) but the migration defines no `CREATE POLICY` statements. In Supabase, enabling RLS with no policies defaults to deny-all for every role including `service_role` unless the Supabase project uses the older `SECURITY DEFINER` bypass. The `supabaseAdmin` client (which uses `service_role`) bypasses RLS by default in Supabase's implementation, so this is not a runtime bug — but it is a documentation gap. Any future query using the anon key would silently return zero rows.

**Fix:** Add an explicit comment confirming the service-role bypass is intentional, or add a restrictive `USING (false)` policy with a comment explaining that service_role access is via Supabase's built-in bypass. This prevents confusion for future maintainers:

```sql
-- Service-role access bypasses RLS (Supabase default behaviour).
-- No anon or authenticated policies are intentionally defined for these tables.
-- All reads are via supabaseAdmin (service_role key) from server-side routes only.
```

---

### IN-02: `import` statement at the bottom of an RSC page file

**File:** `src/app/ta/[ticker]/page.tsx:136`

**Issue:** The `import { TickerSearch }` statement appears at line 136 — after the `export default` function and an inline helper function. While TypeScript/ES modules hoist all `import` statements at runtime, placing `import` after function declarations is unusual and violates the convention of grouping all imports at the top of a module. Static analysis tools may report this as a warning depending on configuration.

**Fix:** Move the `import { TickerSearch }` to the top-of-file import block (lines 16-23), alongside the other component imports. The comment about avoiding top-level "use client" imports is correct but the import can still be at the top — the concern was about `"use client"` propagation, not import ordering.

---

### IN-03: Duplicate `isValidBar` logic in seed script instead of importing from `fetch-ohlcv`

**File:** `scripts/ta/seed-and-backfill.ts:80-93`

**Issue:** The seed script defines its own `isValidBar` function that is a partial copy of the exported `isValidBar` from `src/lib/ta/fetch-ohlcv.ts`. The script comment on line 67 says "keep in sync with fetch-ohlcv.ts" but this is a manual sync obligation. Beyond the behavioral divergence documented in WR-01, the duplication will silently diverge again if `fetch-ohlcv.ts`'s rules change in T2/T3.

**Fix:** Import `isValidBar` directly from `@/lib/ta/fetch-ohlcv`. The seed script already uses `tsx` which resolves TypeScript path aliases:

```typescript
import { isValidBar } from "@/lib/ta/fetch-ohlcv";
```

Then delete lines 70-93 (the `RawBar` interface and local `isValidBar`). Adapt the caller at line 284 to use the shared type, noting that `fetch-ohlcv.ts`'s `isValidBar` accepts `{ high, low, close, volume }` so the `RawBar` fields align.

---

### IN-04: `dispatch/route.ts` sweep loops break after one document even when `result.done` is false

**File:** `src/app/api/internal/dispatch/route.ts:70-78`

**Issue:** Inside `runParseSweep` (and the embed/analyze equivalents), when `result.done` is `false` (the document is still processing), the loop hits `break` at line 77 and stops processing. The `continue` at line 72 only runs when `result.done === true`. This means each sweep processes exactly one document per dispatcher invocation, regardless of how much deadline budget remains. With a 55-second budget, the dispatcher could handle multiple documents but intentionally does not.

This is documented as "stop after one doc per invocation to respect deadline" but the `MAX_ITER = 20` loop condition is then misleading — it can never iterate more than twice (one pick + break). The `iterations` counter increments but the loop body always exits via `break` or `continue` before `iterations` reaches 2 for a partial document.

This is a logic inconsistency, not a crash bug, but worth noting for future maintainers who expect `MAX_ITER` to bound actual iterations.

**Fix:** Either remove `MAX_ITER` and the `iterations` counter if the intent is always to process one doc per call, or restructure the loop to actually iterate documents while deadline permits.

---

_Reviewed: 2026-06-07T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
