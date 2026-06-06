---
quick_id: 260525-dl3
description: Fix four pre-phase-12 bugs (post-analysis navigation, PDF viewer, chat connection error, citation popover flicker)
date: 2026-05-25
status: incomplete
human_verify_pending: true
---

# Quick Task 260525-dl3 — SUMMARY

## Bugs fixed

1. **Post-analysis navigation** — `src/components/doc/document-progress-view.tsx`
   - Removed the duplicate render block that passed `explanation={null}` / `pdfUrl={null}` to `DocumentReaderLayout` when polling returned `status="ready"`.
   - Added a single `useEffect` (guarded by `hasRefreshedRef`) that calls `router.refresh()` once when polling reaches a terminal status (`ready` | `failed`) AND the SSR `explanation` prop is still null. RSC re-runs, repopulates explanation/score/pdfUrl, and the `if (explanation)` fast-path at the top of the component takes over.

2. **PDF viewer not displaying** — Fixed as a consequence of Bug 1 (`pdfUrl` is now populated by the RSC refresh).

3. **Chat "connection error"** — `src/app/api/chat/route.ts`, `src/app/api/starter-questions/route.ts`
   - Replaced `import { google } from "@ai-sdk/google"` with `createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY })`. The default `google` provider reads `GOOGLE_GENERATIVE_AI_API_KEY`; this project uses `GEMINI_API_KEY`, which caused 401s on every chat request.
   - Updated `vi.mock("@ai-sdk/google", ...)` factories in `chat/__tests__/route.test.ts` and `starter-questions/__tests__/route.test.ts` to export `createGoogleGenerativeAI` instead of `google`.

4. **Citation popover flicker** — `src/components/doc/citation-inline.tsx` + new `src/components/ui/hover-card.tsx`
   - Added a Radix HoverCard wrapper (`hover-card.tsx`) mirroring the existing `popover.tsx` style — uses the `radix-ui` meta-package's HoverCard re-export, no new install.
   - Rewrote `citation-inline.tsx` to use `HoverCard` with controlled open state and `openDelay={150}` / `closeDelay={200}`. The bridge between trigger and content is now handled natively, eliminating the flicker.
   - Click / Enter / Space still trigger `onGoToPage(page)`.
   - Refreshed `tests/components/__snapshots__/explanation-panel.test.tsx.snap` to reflect popover-trigger → hover-card-trigger swap.

## Commits

- `9d17b18` — `fix(quick-260525-dl3): router.refresh on terminal status, remove stale-prop render` (Bug 1 + Bug 2)
- `116bebb` — `fix(quick-260525-dl3): wire GEMINI_API_KEY into chat + starter-questions AI provider` (Bug 3)
- `624c8ab` — `fix(quick-260525-dl3): swap citation Popover to Radix HoverCard to stop flicker` (Bug 4)

## Verification

- `tsc --noEmit`: clean for changed files (pre-existing errors in `src/lib/chat/session-restore.test.ts` are out of scope).
- Affected tests: 37/37 pass (`pnpm vitest run src/app/api/chat src/app/api/starter-questions citation explanation-panel`).

## Outstanding

- **Task 4 (human-verify checkpoint):** Run `pnpm dev`, upload a PDF, and walk through the four bug scenarios end-to-end:
  1. After analysis completes, the page should auto-transition to the reader (no manual refresh).
  2. The PDF should render in the viewer panel.
  3. Send a chat message and confirm the streamed response arrives (no "connection error").
  4. Hover a `[p.N]` citation — the source-text card should open smoothly and remain open while moving the cursor over it.

## Deviations

- Dropped `onOpenAutoFocus` prop on `<HoverCardContent>` — Radix HoverCard does not expose it (hover surface is not focus-trapped). No behavioral change for users.

## Files touched

- Created: `src/components/ui/hover-card.tsx`
- Modified: `src/components/doc/document-progress-view.tsx`, `src/app/api/chat/route.ts`, `src/app/api/starter-questions/route.ts`, `src/app/api/chat/__tests__/route.test.ts`, `src/app/api/starter-questions/__tests__/route.test.ts`, `src/components/doc/citation-inline.tsx`, `tests/components/__snapshots__/explanation-panel.test.tsx.snap`
