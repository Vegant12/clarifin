---
phase: 12
plan: "01"
slug: inline-disclaimer-labels
subsystem: ui-components
tags: [disclaimer, compliance, tdd, disclaim-01]
dependency_graph:
  requires: []
  provides: [DISCLAIM-01-explanation, DISCLAIM-01-chat]
  affects: [explanation-panel, chat-interface]
tech_stack:
  added: []
  patterns: [tdd-red-green, data-testid, jsdom-scrollIntoView-mock]
key_files:
  created:
    - src/components/chat/__tests__/chat-interface-disclaimer.test.tsx
  modified:
    - src/components/doc/explanation-panel.tsx
    - src/components/doc/explanation-panel.test.tsx
    - src/components/chat/chat-interface.tsx
    - tests/components/explanation-panel.test.tsx
decisions:
  - "Mocked scrollIntoView on HTMLElement.prototype in jsdom test to avoid TypeError from ChatInterface useEffect"
  - "Updated stale snapshot in tests/components/explanation-panel.test.tsx after adding disclaimer paragraph"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
requirements:
  - DISCLAIM-01
---

# Phase 12 Plan 01: Inline Disclaimer Labels Summary

**One-liner:** Added "AI analysis · not financial advice" inline disclaimer paragraphs to ExplanationPanel and ChatInterface, closing the two remaining DISCLAIM-01 gaps via TDD.

## What Was Built

DISCLAIM-01 required the disclaimer to appear adjacent to three locations: score card (already done), explanation section, and chat input area. This plan added the two missing locations.

### ExplanationPanel (`src/components/doc/explanation-panel.tsx`)

Added as the last child of `<article>`, after the `SECTION_ORDER.map()` block:

```tsx
<p
  data-testid="explanation-disclaimer"
  className="text-xs text-muted-foreground px-6 pb-4"
>
  AI analysis · not financial advice. Verify all figures against the source PDF.
</p>
```

### ChatInterface (`src/components/chat/chat-interface.tsx`)

Added after the closing `</form>` tag, before the conditional session-ready status paragraph:

```tsx
<p
  data-testid="chat-disclaimer"
  className="text-xs text-muted-foreground"
>
  AI analysis · not financial advice.
</p>
```

## Tests

### Task 1 — ExplanationPanel

Added to `src/components/doc/explanation-panel.test.tsx`:

```
describe("ExplanationPanel — DISCLAIM-01 inline disclaimer")
  it("renders the inline disclaimer paragraph")
    - Asserts screen.getByTestId("explanation-disclaimer") is in the document
    - Asserts text content contains "AI analysis · not financial advice"
```

### Task 2 — ChatInterface

Created `src/components/chat/__tests__/chat-interface-disclaimer.test.tsx`:

```
describe("ChatInterface — DISCLAIM-01 disclaimer")
  it("renders the chat disclaimer paragraph")
    - Mocks ai/react useChat hook
    - Asserts screen.getByTestId("chat-disclaimer") is in the document
    - Asserts text content contains "AI analysis · not financial advice"
```

## Commits

| Hash    | Type | Description |
|---------|------|-------------|
| 7ed28cd | test | RED test for explanation-panel disclaimer (DISCLAIM-01) |
| eb33758 | feat | ChatInterface disclaimer + snapshot update (DISCLAIM-01) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scrollIntoView TypeError in jsdom**
- **Found during:** Task 2 RED phase
- **Issue:** ChatInterface's auto-scroll `useEffect` calls `sentinelRef.current?.scrollIntoView(...)` which jsdom does not implement, causing a `TypeError` that masked the true test failure reason.
- **Fix:** Added `beforeAll(() => { window.HTMLElement.prototype.scrollIntoView = vi.fn(); })` in the test file. This is the standard pattern — same used in `chat-message.test.tsx`.
- **Files modified:** `src/components/chat/__tests__/chat-interface-disclaimer.test.tsx`
- **Commit:** eb33758

**2. [Rule 1 - Bug] Stale snapshot after adding disclaimer paragraph**
- **Found during:** Full suite run after Task 1 implementation
- **Issue:** `tests/components/explanation-panel.test.tsx` Test 7 snapshot captured the old `<article>` output without the disclaimer. Adding the `<p>` as the last child caused the snapshot to fail.
- **Fix:** Ran `pnpm vitest run tests/components/explanation-panel.test.tsx -u` to update the snapshot to include the disclaimer paragraph.
- **Files modified:** `tests/components/explanation-panel.test.tsx` (snapshot file updated inline)
- **Commit:** eb33758

## Pre-existing Failures (Out of Scope)

- `src/lib/stock/fetch-stock-data.test.ts` — mock setup issue (`uploadFresh` export missing from mock). Pre-existing before this plan's changes. Logged to deferred-items.
- `src/lib/chat/session-restore.test.ts` — TypeScript errors on tuple indexing. Pre-existing.

## Self-Check: PASSED

- [x] `src/components/doc/explanation-panel.tsx` contains `data-testid="explanation-disclaimer"` as last child of `<article>`
- [x] `src/components/chat/chat-interface.tsx` contains `data-testid="chat-disclaimer"` after `</form>`
- [x] `src/components/chat/__tests__/chat-interface-disclaimer.test.tsx` exists and passes
- [x] `src/components/doc/explanation-panel.test.tsx` has DISCLAIM-01 describe block
- [x] Commits 7ed28cd and eb33758 exist in git log
- [x] 274 tests pass; only pre-existing stock test failure remains
