---
phase: 12
plan: "02"
subsystem: onboarding
tags: [modal, localStorage, disclaimer, first-visit, DISCLAIM-03]
dependency_graph:
  requires: []
  provides:
    - onboarding-modal (first-time visitor modal with AI disclaimer)
    - onboarding-client (localStorage flag utility)
    - shadcn dialog primitive
  affects:
    - src/app/layout.tsx (OnboardingModal mounted at app root)
tech_stack:
  added:
    - "@radix-ui/react-dialog (via shadcn dialog CLI install)"
  patterns:
    - SSR-safe localStorage guard (typeof window === 'undefined')
    - useEffect-deferred open state to avoid hydration mismatch
    - shadcn Dialog with portal rendering
key_files:
  created:
    - src/components/ui/dialog.tsx
    - src/lib/onboarding-client.ts
    - src/lib/__tests__/onboarding-client.test.ts
    - src/components/onboarding-modal.tsx
  modified:
    - src/app/layout.tsx
decisions:
  - "open state starts as false; useEffect sets true — avoids SSR hydration mismatch vs defaultOpen={true}"
  - "OnboardingModal is a sibling of SessionProvider in layout.tsx body — fires on all routes including /doc/[id] deep links"
  - "onOpenChange handler calls handleDismiss on both Escape/X close and explicit button click — both paths set localStorage flag"
metrics:
  duration_minutes: 2
  completed_date: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 12 Plan 02: Onboarding Modal (DISCLAIM-03) Summary

**One-liner:** First-time visitor modal with plain-English product description, upload guidance, and AI disclaimer — backed by a localStorage flag so returning visitors skip it.

## What Was Built

### shadcn Dialog install
Command: `pnpm dlx shadcn@latest add dialog --yes`
Output: Created `src/components/ui/dialog.tsx` — radix-ui Dialog primitives following project's new-york style and `@/components/ui` alias.

### localStorage Utility — `src/lib/onboarding-client.ts`
- `ONBOARDING_SEEN_KEY = "clarifin_onboarding_seen"`
- `getOnboardingSeen()`: returns `boolean`; SSR-guarded with `typeof window === "undefined"` check
- `setOnboardingSeen()`: writes `"1"` to localStorage; no-op on server
- Follows exact shape of `src/lib/session-client.ts` (project analog)

### Test File — `src/lib/__tests__/onboarding-client.test.ts`
Vitest jsdom environment. 3 tests, all passing:
1. "returns false when localStorage key is absent" — PASS
2. "returns true after setOnboardingSeen is called" — PASS
3. "stores '1' as the value for the key" — PASS

### OnboardingModal Component — `src/components/onboarding-modal.tsx`
Client component. Three content sections:
1. **What Clarifin does:** "Upload a financial PDF from an IDX-listed company and get a plain-English explanation of its financial health — written for investors who don't speak finance."
2. **What to upload:** "IDX annual reports (laporan tahunan), quarterly filings, balance sheets, income statements, or cash flow statements. PDF format only."
3. **AI disclaimer:** "Clarifin generates AI analysis, not financial advice. Information may be inaccurate; verify all figures against the source PDF before making decisions."

Dismiss button: "I understand, let me continue"

data-testid attributes:
- `data-testid="onboarding-modal"` on `DialogContent`
- `data-testid="onboarding-dismiss-btn"` on dismiss `Button`

### layout.tsx Mount
```tsx
import { OnboardingModal } from "@/components/onboarding-modal";
// Inside <body>:
<SessionProvider>{children}</SessionProvider>
<OnboardingModal />
```
Mount location: line 4 (import), line 30 (usage) of `src/app/layout.tsx`.

## Verification Results

- TypeScript: `pnpm tsc --noEmit` — zero errors from this plan's files (2 pre-existing errors in `session-restore.test.ts`, unrelated to this plan)
- Tests: 3/3 onboarding-client tests pass; overall test suite has same pre-existing failures as before this plan (no regressions introduced)
- `grep -n "OnboardingModal" src/app/layout.tsx` confirms import and mount

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all modal content sections are wired with static text as intended.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check

- [x] src/components/ui/dialog.tsx exists
- [x] src/lib/onboarding-client.ts exists
- [x] src/lib/__tests__/onboarding-client.test.ts exists
- [x] src/components/onboarding-modal.tsx exists
- [x] src/app/layout.tsx mounts OnboardingModal
- [x] Task 1 commit 482b0ad exists
- [x] Task 2 commit 52cd5b5 exists

## Self-Check: PASSED
