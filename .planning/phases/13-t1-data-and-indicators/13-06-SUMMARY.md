---
phase: 13-t1-data-and-indicators
plan: 06
subsystem: ui, components, ta
tags: [site-header, ticker-search, skeleton, error-card, sparse-data, mobile-card, env-flag, shadcn, layout]

requires:
  - phase: 13-t1-data-and-indicators (plan 04)
    provides: GET /api/ta/search — ticker autocomplete endpoint consumed by TickerSearch

provides:
  - SiteHeader: global sticky header with conditional TA Analysis link (TA-UX-01, D-04)
  - NEXT_PUBLIC_TA_ENABLED: env flag in env.ts gates TA link discoverability
  - TickerSearch: debounced autocomplete routing to /ta/{TICKER} (TA-TICKER-01)
  - TAPageSkeleton: loading state with role=status + aria-busy (TA-CHART-07)
  - TAErrorCard: invalid ticker + fetch-error states with variant prop (TA-CHART-07)
  - SparseDataCard: <30 candles state for recently listed tickers (TA-CHART-08)
  - MobileInfoCard: <640px "best on desktop" info card (D-05)

affects: [13-07]

tech-stack:
  added:
    - cmdk (via shadcn command) — shadcn Command/CommandInput/CommandList primitives for TickerSearch
    - shadcn skeleton — Skeleton primitive for TAPageSkeleton
  patterns:
    - NEXT_PUBLIC_ env var added as z.string().optional() — compared as === "true" not boolean coercion
    - SiteHeader reads process.env.NEXT_PUBLIC_TA_ENABLED at module-init time (tree-shaken when unset)
    - TickerSearch: useEffect([query]) with setTimeout(300ms) + clearTimeout cleanup (T-13-23)
    - TickerSearch: router.push('/ta/' + result.ticker) uses API-returned uppercase ticker only (T-13-22)
    - TAErrorCard: variant prop pattern for not-found vs fetch-error — single component, two copy sets
    - SiteHeader mounted above SessionProvider in RootLayout — avoids hydration issues (UI-SPEC note)
    - MobileInfoCard caller-gated: component has no visibility classes; caller wraps block sm:hidden

key-files:
  created:
    - src/components/site-header.tsx
    - src/components/ta/ticker-search.tsx
    - src/components/ta/ta-page-skeleton.tsx
    - src/components/ta/ta-error-card.tsx
    - src/components/ta/sparse-data-card.tsx
    - src/components/ta/mobile-info-card.tsx
    - src/components/ui/command.tsx (installed via shadcn)
    - src/components/ui/skeleton.tsx (installed via shadcn)
  modified:
    - src/lib/env.ts (added NEXT_PUBLIC_TA_ENABLED to client schema + runtimeEnv)
    - src/app/layout.tsx (SiteHeader mounted above SessionProvider)

key-decisions:
  - "NEXT_PUBLIC_TA_ENABLED stored as z.string().optional() in env.ts — NEXT_PUBLIC_ vars are strings; compared === 'true' not coerced to boolean"
  - "SiteHeader mounted above SessionProvider in layout.tsx — follows UI-SPEC note and avoids hydration mismatches"
  - "TAErrorCard uses variant prop for not-found vs fetch-error — single component, two copy sets, avoids duplication"
  - "MobileInfoCard has no visibility classes — caller applies block sm:hidden so component is testable in isolation"
  - "TickerSearch uses shouldFilter={false} on Command — filtering is server-side via /api/ta/search, not client-side cmdk matching"

duration: ~4min
completed: 2026-06-06
---

# Phase 13 Plan 06: Navigation + UI State Cards Summary

**Global SiteHeader with conditional TA link (env-gated), debounced TickerSearch autocomplete routing to /ta/{TICKER}, and four page-state cards (skeleton, error, sparse-data, mobile) with verbatim locked copy — ready for Plan 07 composition.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-06T15:48:13Z
- **Completed:** 2026-06-06T15:52:40Z
- **Tasks:** 3/3 complete
- **Files created:** 8 new files (6 components + 2 shadcn primitives)
- **Files modified:** 2 (env.ts, layout.tsx)

## Accomplishments

### Task 1: SiteHeader + env flag + RootLayout mount

- `src/lib/env.ts`: Added `NEXT_PUBLIC_TA_ENABLED: z.string().optional()` to client schema and `process.env.NEXT_PUBLIC_TA_ENABLED` to runtimeEnv map.
- `src/components/site-header.tsx` (`"use client"`): `<header role="banner">` sticky h-12 bg-secondary border-b. Left "Clarifin" wordmark → `/`. Right nav: "Upload Document" Button + "TA Analysis" Button gated on `process.env.NEXT_PUBLIC_TA_ENABLED === "true"`. Active state on `/ta/*` via `usePathname()`: text-primary + underline. On <640px: `LineChart` icon-only with `aria-label="TA Analysis"` (text label hidden via `hidden sm:inline` / `sm:hidden`).
- `src/app/layout.tsx`: `<SiteHeader />` mounted above `<SessionProvider>` in body.
- Installed shadcn `command` and `skeleton` primitives (needed for Tasks 2–3).
- `pnpm build` passes.

### Task 2: TickerSearch debounced autocomplete

- `src/components/ta/ticker-search.tsx` (`"use client"`): shadcn `Command` + `CommandInput` + `CommandList`. `shouldFilter={false}` — filtering is server-side.
- State: `query` (string), `results` (TickerResult[]), `loading` (bool).
- Debounce: `useEffect([query])` with `setTimeout(300ms)`; cleanup calls `clearTimeout(timer)` (T-13-23).
- Result row (min-h-[40px]): `[TICKER]` font-mono font-semibold + `name_en` text-muted-foreground.
- On select: `router.push('/ta/' + result.ticker)` — ticker is uppercase from API (T-13-22).
- Empty state: "No IDX tickers matching '{query}'" (verbatim from UI-SPEC).
- Locked placeholder: "Search IDX tickers or company names…" (verbatim from UI-SPEC).
- No chart or server module imports — pure client + fetch.

### Task 3: State cards — skeleton, error, sparse, mobile

**TAPageSkeleton** (`ta-page-skeleton.tsx`): Three Skeleton blocks — h-8 (search), h-[600px] (chart area), h-16 (indicator strip). `role="status"` `aria-label="Loading chart data…"` `aria-busy="true"`.

**TAErrorCard** (`ta-error-card.tsx`): Props `{ ticker, variant }`. Two variants:
- `"not-found"` (default): "Ticker not found" heading + locked body + "Search again" CTA → `/ta`
- `"fetch-error"`: "Could not load chart data" heading + locked body + "Try again" CTA → `/ta`
- `AlertCircle` icon `text-destructive`; centered `max-w-md mx-auto mt-16`.

**SparseDataCard** (`sparse-data-card.tsx`): Props `{ ticker }`. "Insufficient price history" heading. Locked body with ticker interpolation: "Technical indicators need at least 30 trading days…". `BarChart2` icon `text-muted-foreground`. No chart rendered.

**MobileInfoCard** (`mobile-info-card.tsx`): `Monitor` icon. "TA Analysis works best on desktop" heading. Full locked body from UI-SPEC line 310. "Upload a document instead" CTA → `/`. Caller applies `block sm:hidden`.

## Task Commits

1. `2c9a0f0` — feat(13-06): SiteHeader + NEXT_PUBLIC_TA_ENABLED env flag + RootLayout mount
2. `84720da` — feat(13-06): TickerSearch debounced autocomplete component
3. `2eb27c5` — feat(13-06): four TA page state cards — skeleton, error, sparse, mobile

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn command and skeleton not installed**
- **Found during:** Task 1 pre-work (TickerSearch requires Command; skeleton required for TAPageSkeleton)
- **Issue:** `src/components/ui/command.tsx` and `src/components/ui/skeleton.tsx` did not exist; plan assumed they were available.
- **Fix:** Ran `pnpm dlx shadcn@latest add command skeleton --yes` before creating components. Committed as part of Task 1 commit.
- **Files created:** src/components/ui/command.tsx, src/components/ui/skeleton.tsx
- **Commit:** 2c9a0f0

**2. [Rule 2 - Missing critical functionality] TickerSearch: shouldFilter={false} on Command**
- **Found during:** Task 2 implementation
- **Issue:** shadcn Command uses client-side filtering by default (cmdk matches against `value` prop). Since filtering is server-side via /api/ta/search, client-side re-filtering would hide results whose cmdk-generated value doesn't match the query string.
- **Fix:** Added `shouldFilter={false}` to `<Command>` — disables cmdk filtering, displays all server-returned results.
- **Files modified:** src/components/ta/ticker-search.tsx
- **Commit:** 84720da

## Known Stubs

None — all components are fully implemented with real API calls and routing. The TA Analysis nav link is intentionally hidden when `NEXT_PUBLIC_TA_ENABLED` is unset (by design per D-04, not a stub).

## Threat Surface Scan

No new trust boundaries beyond those in the Plan's threat model:
- T-13-21 (TA surface exposure in prod): mitigated — TA link gated on `NEXT_PUBLIC_TA_ENABLED === "true"`.
- T-13-22 (open redirect via search result): mitigated — `router.push('/ta/' + result.ticker)` uses only API-returned uppercase ticker.
- T-13-23 (DoS via keystroke flooding): mitigated — 300ms debounce + min-length 1 + limit=8.
- T-13-24 (XSS via ticker/company name): mitigated — React escapes all interpolated text; no dangerouslySetInnerHTML.

All four threat dispositions from the plan's threat register are mitigated.

## Self-Check: PASSED

```
FOUND: src/components/site-header.tsx (role=banner, NEXT_PUBLIC_TA_ENABLED, SiteHeader export)
FOUND: src/components/ta/ticker-search.tsx (/api/ta/search, setTimeout, push, placeholder)
FOUND: src/components/ta/ta-page-skeleton.tsx (role=status, aria-busy, Skeleton blocks)
FOUND: src/components/ta/ta-error-card.tsx (Ticker not found, ticker prop)
FOUND: src/components/ta/sparse-data-card.tsx (Insufficient price history, ticker prop)
FOUND: src/components/ta/mobile-info-card.tsx (works best on desktop, Upload a document instead)
FOUND: src/lib/env.ts (NEXT_PUBLIC_TA_ENABLED in client schema + runtimeEnv)
FOUND: src/app/layout.tsx (SiteHeader above SessionProvider)
FOUND: 2c9a0f0 (Task 1 commit)
FOUND: 84720da (Task 2 commit)
FOUND: 2eb27c5 (Task 3 commit)
BUILD: PASS (pnpm build exits 0 with SKIP_ENV_VALIDATION=true)
TYPECHECK: only pre-existing session-restore.test.ts errors (confirmed pre-existing via git stash check)
```
