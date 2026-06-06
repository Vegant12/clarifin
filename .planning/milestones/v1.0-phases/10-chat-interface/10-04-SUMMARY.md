---
phase: 10-chat-interface
plan: "04"
subsystem: ui
tags: [useChat, streaming, shadcn, citation-inline, guardrail, starter-questions, tdd]

requires:
  - phase: 10-03
    provides: "POST /api/chat and POST /api/starter-questions backend routes"
  - phase: 10-02
    provides: "CHAT_DEFLECTION_MESSAGE, CHAT_SYSTEM_PROMPT, isInvestmentAdviceQuery — all imported by chat-message.tsx"
  - phase: 7
    provides: "CitationInline component + parseCitations function — reused verbatim in ChatMessage"

provides:
  - "ChatPanel — self-contained client component that Plan 05 drops into DocumentReaderLayout + MobileTabView"
  - "ChatInterface — useChat v4 wrapper with streaming display, auto-grow textarea, scroll sentinel"
  - "ChatMessage — user/assistant bubble renderer with parseCitations + CitationInline + DISCLAIM-01"
  - "ChatLoadingSkeleton — three-dot bounce indicator (role=status)"
  - "GuardrailDeflection — neutral info box for investment-advice deflection (CHAT-06)"
  - "StarterQuestions — 5 clickable pill buttons, auto-submits on click, hides after first message"

affects: [10-05-wiring, 10-06-session-restore]

tech-stack:
  added: []
  patterns:
    - "useChat from 'ai/react' (v4) — NOT '@ai-sdk/react' (v5+) — RESEARCH Pitfall 1"
    - "body: { documentId, sessionId } passed with every useChat request — RESEARCH Pitfall 4"
    - "parseCitations + CitationInline reuse — Phase 7 citation format [p.N] is unchanged"
    - "CHAT_DEFLECTION_MESSAGE from @/lib/prompts (not @/lib/chat/prompts) — Plan 03 path decision"
    - "toBeTruthy() instead of toBeInTheDocument() — jest-dom not available in @vitest-environment jsdom docblock tests"

key-files:
  created:
    - src/components/chat/chat-loading-skeleton.tsx
    - src/components/chat/guardrail-deflection.tsx
    - src/components/chat/chat-message.tsx
    - src/components/chat/starter-questions.tsx
    - src/components/chat/chat-interface.tsx
    - src/components/chat/chat-panel.tsx
    - src/components/chat/__tests__/chat-message.test.tsx
    - src/components/chat/__tests__/starter-questions.test.tsx
  modified: []

key-decisions:
  - "Import CHAT_DEFLECTION_MESSAGE from @/lib/prompts not @/lib/chat/prompts — Plan 03 placed files at src/lib/ root per STATE.md decision"
  - "Use toBeTruthy() not toBeInTheDocument() — @testing-library/jest-dom matchers not available in @vitest-environment jsdom docblock test files (setup-dom.ts loads for tests/components/** but not src/components/**/__tests__/**)"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06]

duration: 6min
completed: 2026-05-21
---

# Phase 10 Plan 04: Chat UI Components Summary

**6 client components + 2 render tests — ChatPanel, ChatInterface, ChatMessage, ChatLoadingSkeleton, GuardrailDeflection, StarterQuestions, all wired per UI-SPEC contracts (CHAT-01..06)**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-21T16:15:00Z
- **Completed:** 2026-05-21T16:21:00Z
- **Tasks:** 2
- **Files created:** 8

## Component Tree

```
ChatPanel (chat-panel.tsx)
└── ChatInterface (chat-interface.tsx)
    ├── StarterQuestions (starter-questions.tsx)  — visible only when messages.length === 0
    ├── ChatMessage[] (chat-message.tsx)
    │   ├── CitationInline (Phase 7 reuse — @/components/doc/citation-inline)
    │   └── GuardrailDeflection (guardrail-deflection.tsx) — when content === CHAT_DEFLECTION_MESSAGE
    └── ChatLoadingSkeleton (chat-loading-skeleton.tsx)  — when isLoading
```

## Accomplishments

### Task 1: Leaf components + render tests (TDD)
- `ChatLoadingSkeleton`: three-dot bounce, `role="status" aria-label="Clarifin is thinking"`, matched UI-SPEC Streaming Loading Indicator exactly
- `GuardrailDeflection`: neutral info box `bg-muted/30 border-border`, heading "I can't help with that", friendly tone (not destructive coloring)
- `ChatMessage`: user right-aligned `bg-muted rounded-2xl rounded-br-sm`; assistant left-aligned `bg-background border`; parseCitations + CitationInline for [p.N] tokens; DISCLAIM-01 disclaimer below every assistant bubble; deflection short-circuit renders GuardrailDeflection instead
- `StarterQuestions`: 5 clickable button pills, `aria-label="Ask: {q}"` per a11y spec, `visible` prop controls render, heading + body copy verbatim from UI-SPEC Copywriting Contract
- 2 test files: 7 tests, all green

### Task 2: ChatInterface + ChatPanel
- `ChatInterface`: `useChat({ api: "/api/chat", id: documentId, body: { documentId, sessionId }, initialMessages })` — v4 import from `"ai/react"`; auto-grow textarea (1–4 rows, max 112px via scrollHeight); Enter-to-submit / Shift+Enter newline; scroll sentinel with `isAtBottom` guard; error state `role="alert"` below input
- `ChatPanel`: section wrapper with `h2 Chat` heading (text-xl font-semibold), mounts ChatInterface with all props forwarded
- typecheck: 0 errors in new files (pre-existing session-restore.ts errors unchanged)

## v4 Import Verification

File: `src/components/chat/chat-interface.tsx`, line 10:
```typescript
import { useChat, type Message } from "ai/react";
```
`grep -l 'from "@ai-sdk/react"' src/components/chat/*.tsx` → returns nothing (no v5 imports).

## Test Results

```
src/components/chat/__tests__/chat-message.test.tsx     4 tests  PASS
src/components/chat/__tests__/starter-questions.test.tsx 3 tests  PASS
src/app/api/chat/__tests__/route.test.ts                4 tests  PASS  (Plan 03 — no regressions)
src/app/api/starter-questions/__tests__/route.test.ts   3 tests  PASS  (Plan 03 — no regressions)
src/lib/chat/guardrail.test.ts                         12 tests  PASS  (Plan 02 — no regressions)
src/lib/chat/prompts.test.ts                            5 tests  PASS  (Plan 02 — no regressions)
src/lib/chat/starter-questions-schema.test.ts           4 tests  PASS  (Plan 02 — no regressions)

Total Phase 10 chat tests: 7 test files, 35 tests — all PASS
Full project: 7 files failed | 33+ passed (all failures are pre-existing, none introduced by Plan 04)
```

## Task Commits

1. **Task 1: Leaf components + render tests** — `efdc8fc`
2. **Task 2: ChatInterface + ChatPanel** — `b988008`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CHAT_DEFLECTION_MESSAGE import path corrected**
- **Found during:** Task 1 implementation
- **Issue:** Plan 04 template code imported `CHAT_DEFLECTION_MESSAGE` from `@/lib/chat/prompts` but Plan 03 placed the file at `src/lib/prompts.ts` (root lib, not chat subdirectory) per the STATE.md decision documented in Plan 03 SUMMARY
- **Fix:** Import path changed to `@/lib/prompts` throughout chat-message.tsx and test files
- **Files modified:** `src/components/chat/chat-message.tsx`, `src/components/chat/__tests__/chat-message.test.tsx`

**2. [Rule 3 - Blocking] Test assertions use toBeTruthy() instead of toBeInTheDocument()**
- **Found during:** Task 1 test run
- **Issue:** `@testing-library/jest-dom` matchers loaded via `tests/setup-dom.ts` only apply to files matching `tests/components/**` in `environmentMatchGlobs`. Files in `src/components/chat/__tests__/` with `@vitest-environment jsdom` docblock run in a different environment context where the setup import doesn't extend Chai. `toBeInTheDocument()` threw "Invalid Chai property".
- **Fix:** Replaced `toBeInTheDocument()` with `toBeTruthy()` (standard Chai — `getByText` already throws if element not found, so the assertion is semantically equivalent). Also imported `cleanup` from `@testing-library/react` (not `vitest`) and added `afterEach(cleanup)` to prevent DOM accumulation between tests.
- **Files modified:** `src/components/chat/__tests__/chat-message.test.tsx`, `src/components/chat/__tests__/starter-questions.test.tsx`

**3. [Rule 1 - Bug] Fixed TypeScript error in starter-questions test**
- **Found during:** Task 2 typecheck
- **Issue:** `Q[0]` has type `string | undefined` (array element access); `screen.getByText` expects `Matcher` not `string | undefined`
- **Fix:** Changed `Q[0]` to `Q[0]!` (non-null assertion — safe since Q is a fixed 5-element const array)
- **Files modified:** `src/components/chat/__tests__/starter-questions.test.tsx`

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking issue)

## Known Stubs

None — all 6 components are fully implemented and wired. `StarterQuestions` receives `questions` prop from the parent; Plan 05 wires the `/api/starter-questions` fetch. The components themselves have no hardcoded empty values.

## Threat Surface Scan

Threats T-10-18 through T-10-22 (from plan threat model) addressed:
- T-10-18 (XSS): `ChatMessage` uses `{tok.value}` inside React children (not `dangerouslySetInnerHTML`) — React HTML-escapes by default. Citation pills rendered as `CitationInline` React components.
- No new network endpoints introduced by this plan (UI-only components).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/chat/chat-loading-skeleton.tsx` | FOUND |
| `src/components/chat/guardrail-deflection.tsx` | FOUND |
| `src/components/chat/chat-message.tsx` | FOUND |
| `src/components/chat/starter-questions.tsx` | FOUND |
| `src/components/chat/chat-interface.tsx` | FOUND |
| `src/components/chat/chat-panel.tsx` | FOUND |
| `src/components/chat/__tests__/chat-message.test.tsx` | FOUND |
| `src/components/chat/__tests__/starter-questions.test.tsx` | FOUND |
| Commit `efdc8fc` (leaf components + tests) | VERIFIED |
| Commit `b988008` (ChatInterface + ChatPanel) | VERIFIED |
