---
phase: 10-chat-interface
plan: "05"
subsystem: integration
tags: [rsc-wiring, session-restore, mobile-tabs, human-verify, chat-panel, desktop-split]

requires:
  - phase: 10-04
    provides: "ChatPanel component — the single mount point this plan consumes"
  - phase: 10-03
    provides: "POST /api/chat and POST /api/starter-questions backend routes"
  - phase: 10-01
    provides: "Supabase chat_sessions + chat_messages tables; session-restore.test.ts RED stub"

provides:
  - "src/lib/session-restore.ts — loadInitialMessages helper (Wave 0 RED stub now GREEN)"
  - "RSC doc/[documentId]/page.tsx — fetches chat_messages + starter_questions, threads all chat props"
  - "DocumentProgressView — URL-sync effect appends ?sessionId= on first visit (CHAT-04 restore)"
  - "DocumentReaderLayout — ChatPanel mounted in desktop left scrollable panel after ExplanationPanel"
  - "MobileTabView — third 'Chat' tab with controlled state; citation click switches to PDF tab"
  - "ChatInterface — isSessionReady gate; submit disabled + status row when sessionId not yet set"

affects: [phase-11-langfuse, phase-12-rate-limiting]

tech-stack:
  added: []
  patterns:
    - "session-restore.ts at src/lib/ root (not src/lib/chat/) to match ../session-restore import from test in src/lib/chat/"
    - "sessionId ?? '' passed to ChatPanel — null guard suppressed to allow CHAT-05 empty state on first paint"
    - "URL-sync effect in DocumentProgressView: POST /api/session → append ?sessionId= via router.replace"
    - "MobileTabView controlled tab state (useState) to enable programmatic tab switch on citation click"

key-files:
  created:
    - src/lib/session-restore.ts
  modified:
    - src/app/doc/[documentId]/page.tsx
    - src/components/doc/document-progress-view.tsx
    - src/components/doc/document-reader-layout.tsx
    - src/components/doc/mobile-tab-view.tsx
    - src/components/chat/chat-interface.tsx

key-decisions:
  - "session-restore.ts placed at src/lib/ root (not src/lib/chat/) — matches the ../session-restore import in src/lib/chat/session-restore.test.ts, following the established pattern for guardrail.ts, prompts.ts, starter-questions-schema.ts"
  - "ChatPanel rendered UNCONDITIONALLY (no sessionId !== null guard) — guard would suppress CHAT-05 starter-question empty state until URL-sync fires, violating phase must_haves.truths"
  - "URL-sync deferred to DocumentProgressView client effect (not upload flow) — simpler path that doesn't require modifying ensureBrowserSession"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06]

duration: ~10min
completed: 2026-05-21T09:34:34Z
---

# Phase 10 Plan 05: RSC Wiring + Layout Integration Summary

**ChatPanel wired into DocumentReaderLayout (desktop) and MobileTabView (third tab); session-restore helper extracted and GREEN; RSC fetches chat history + starter questions server-side**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-21T09:24:00Z
- **Completed:** 2026-05-21T09:34:34Z
- **Tasks completed:** 2/3 (Task 3 is a blocking human-verify checkpoint)
- **Files created:** 1
- **Files modified:** 5

## Accomplishments

### Task 1: RSC + DocumentProgressView + session-restore helper

- `src/lib/session-restore.ts` created — exports `loadInitialMessages({sessionId, documentId, now?})`, queries chat_messages with BOTH `.eq("session_id")` AND `.eq("doc_id")` (T-10-25 cross-doc leak prevention), `.limit(40)`, 7-day TTL via `.gte("created_at", sevenDaysAgo)` — Wave 0 `session-restore.test.ts` (5 tests) turns GREEN
- `page.tsx` extended with `searchParams: Promise<{ sessionId?: string }>` — UUID-validates via Zod, calls `loadInitialMessages`, fetches `starter_questions` from `document_analysis` jsonb cache (or falls back to `/api/starter-questions` POST with `VERCEL_URL`-aware base URL)
- `DocumentProgressView` receives `sessionId`, `initialMessages`, `starterQuestions` as new props; URL-sync effect on mount: if `sessionId === null`, POSTs to `/api/session` to get row id, then `router.replace(?sessionId=...)` — next refresh restores history

### Task 2: Desktop split pane + mobile tab + ChatInterface gate

- `DocumentReaderLayout` (desktop): imports `ChatPanel`; `DesktopSplitPane` appends `<ChatPanel>` after `<ExplanationPanel>` inside the left scrollable `Panel` — unconditional render, `sessionId ?? ""`
- `MobileTabView`: third `TabsTrigger value="chat"` labeled "Chat"; `useState` for controlled tab (`"explanation" | "pdf" | "chat"`); `TabsContent value="chat"` contains `<ChatPanel>` with `onGoToPage` that calls `setTab("pdf")` then deferred `scrollToPage` (UI-SPEC Citation Click in Chat)
- `ChatInterface` patched: derives `isSessionReady = sessionId.length > 0`; form `onSubmit` short-circuits on `!isSessionReady`; textarea and submit button have `disabled={!isSessionReady || isLoading}`; status row "Setting up your chat session…" renders below the form when not ready

## Test Results

```
src/lib/chat/session-restore.test.ts        5 tests  PASS (Wave 0 RED → GREEN)
src/app/api/chat/__tests__/route.test.ts    4 tests  PASS (no regressions)
src/app/api/starter-questions/__tests__/    3 tests  PASS (no regressions)
src/components/chat/__tests__/chat-message  4 tests  PASS (no regressions)
src/components/chat/__tests__/starter-qs   3 tests  PASS (no regressions)

Total Phase 10 chat tests: 5 files, 19 tests — all PASS
Full project: 2 failed (pre-existing) | 244 passed | 1 skipped
```

Pre-existing failures (not introduced by this plan):
- `src/lib/stock/fetch-stock-data.test.ts` — Supabase constructor mock issue (Phase 9)
- `src/lib/explain/__tests__/explain-prompts.test.ts` — model ID "gemini-2.0-flash" vs "gemini-2.5-flash" mismatch (Phase 6)

## Task Commits

1. **Task 1: RSC + session-restore helper + DocumentProgressView** — `4d3ee20`
2. **Task 2: Desktop split pane + mobile Chat tab + ChatInterface gate** — `3365fa0`

## Task 3: Blocking Human-Verify Checkpoint

Task 3 is `type="checkpoint:human-verify" gate="blocking"` — Phase 10 sign-off. Requires:
- `pnpm dev` + browser testing on desktop (≥1024px) and mobile (≤768px)
- Full 7-section script (A: desktop happy path, B: empty retrieval, C: guardrail EN+ID, D: session restore, E: mobile tabs, F: disclaimer, G: console/network sanity)
- User types "approved" to complete

**Resume signal:** After human approves, the continuation agent can mark Phase 10 complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] session-restore.ts placed at src/lib/ root, not src/lib/chat/**
- **Found during:** Task 1 — checking the test import path
- **Issue:** Plan specified `src/lib/chat/session-restore.ts` but the Wave 0 test at `src/lib/chat/session-restore.test.ts` imports `from "../session-restore"` which resolves to `src/lib/session-restore.ts` (one level up). Creating the file at `src/lib/chat/session-restore.ts` would leave the test permanently broken.
- **Fix:** Created file at `src/lib/session-restore.ts` — identical pattern to `guardrail.ts`, `prompts.ts`, `starter-questions-schema.ts` (all at `src/lib/` root with tests in `src/lib/chat/`)
- **Files created:** `src/lib/session-restore.ts`
- **Commit:** `4d3ee20`

## Known Stubs

None — all components are fully wired. ChatPanel receives real `initialMessages` from the RSC (empty `[]` on first visit, populated after session restore), real `starterQuestions` from `document_analysis` jsonb cache or `/api/starter-questions`.

## Threat Surface Scan

All threats mitigated per plan threat model:
- T-10-24: `sessionIdSchema = z.string().uuid().safeParse()` in RSC — invalid input falls back to `sessionId = null`
- T-10-25: `loadInitialMessages` uses `.eq("session_id")` AND `.eq("doc_id")` — cross-document leak prevention confirmed by session-restore test case "scopes the query by BOTH session_id AND doc_id"
- T-10-26: `.limit(40)` + 7-day `.gte` filter cap initialMessages payload

No new security-relevant surface introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/lib/session-restore.ts` exists | FOUND |
| `src/app/doc/[documentId]/page.tsx` modified | FOUND |
| `src/components/doc/document-progress-view.tsx` modified | FOUND |
| `src/components/doc/document-reader-layout.tsx` modified | FOUND |
| `src/components/doc/mobile-tab-view.tsx` modified | FOUND |
| `src/components/chat/chat-interface.tsx` modified | FOUND |
| Commit `4d3ee20` (Task 1) | VERIFIED |
| Commit `3365fa0` (Task 2) | VERIFIED |
| session-restore.test.ts 5 tests GREEN | VERIFIED |
| pnpm typecheck: 0 errors in plan files | VERIFIED (2 pre-existing test-file errors remain) |
