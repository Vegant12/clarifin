---
plan: 07-03
phase: 07-citation-ui-pdf-viewer
status: complete
wave: 3
completed: "2026-05-19"
self_check: PASSED
human_verify: APPROVED
---

# Plan 07-03 Summary — Reader Layout & RSC

## What Was Built

The complete Phase 7 reader experience: a resizable desktop split pane (explanation left, PDF right), a mobile tab switcher (Explanation / Source PDF), and a server-side RSC page that fetches the explanation JSON + signed PDF URL from Supabase before rendering. `DocumentProgressView` branches on `status === "ready"` to swap in the reader layout, replacing the progress UI cleanly in-place.

## Key Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/doc/pdf-viewer-panel.tsx` | modified | Fixed workerSrc from CDN to local `/pdf.worker.min.mjs` |
| `src/components/doc/document-reader-layout.tsx` | created | Desktop split (react-resizable-panels v4 `Group/Panel/Separator`) + mobile fallback to MobileTabView |
| `src/components/doc/mobile-tab-view.tsx` | created | shadcn Tabs wrapper — `PdfViewerPanel` loaded via `dynamic()` `ssr:false` |
| `src/components/doc/document-progress-view.tsx` | modified | Added `explanation` / `pdfUrl` props; short-circuits to `DocumentReaderLayout` when `status === "ready"` |
| `src/app/doc/[documentId]/page.tsx` | modified | RSC fetches `document_analysis.explanation` + `documents.storage_path`, creates 1h signed URL, passes all three as props |
| `public/pdf.worker.min.mjs` | created | Copied from `pdfjs-dist@5.4.296` — required because cdnjs has no v5.4.296 |
| `package.json` | modified | Added `postinstall` script to keep worker copy in sync |

## RSC Fetch Shape

```typescript
// page.tsx — two sequential Supabase queries, both server-side
supabaseAdmin.from("document_analysis").select("explanation").eq("doc_id", documentId).maybeSingle()
supabaseAdmin.from("documents").select("storage_path").eq("id", documentId).maybeSingle()
supabaseAdmin.storage.from("pdfs").createSignedUrl(storagePath, 3600)
```

- Explanation parsed through `explanationSchema.safeParse` — null on validation failure (graceful null).
- Signed URL TTL: **3600s (1h)**. On expiry, a page reload re-issues a fresh URL via RSC.
- Both queries use `maybeSingle()` — returns `null` rather than throwing when no row exists.

## react-resizable-panels v4 API

The Wave 3 agent encountered a breaking API change from the v2 interface documented in the plan:

| Plan-07-03 spec (v2) | Actual API (v4) |
|---------------------|-----------------|
| `PanelGroup` | `Group` |
| `PanelResizeHandle` | `Separator` |
| `autoSaveId` prop on PanelGroup | `useDefaultLayout({ id, panelIds, storage })` hook |

`useDefaultLayout` is called inside `DesktopSplitPane` (a sub-component) so that hooks are not called conditionally. The `localStorage` guard (`typeof window !== "undefined"`) is required because `DesktopSplitPane` is a `"use client"` component but `useDefaultLayout` is called at render time.

## Panel Persistence

- **localStorage key**: `react-resizable-panels:reader-panel-group` (the library prefixes the id passed to `useDefaultLayout`)
- Ratio is persisted via `onLayoutChanged` callback; `defaultLayout` provides the restored value on mount.
- Survives page reload; cleared by clearing localStorage.

## Worker Config Decision

CDN workerSrc (cdnjs.cloudflare.com) was initially used per the plan spec, but cdnjs does not host pdfjs-dist v5.4.296. Fixed by:
1. Copying `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` → `public/pdf.worker.min.mjs`
2. Setting `pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`
3. Adding `postinstall` script to keep the copy in sync on dependency updates

## SSR Guard

`PdfViewerPanel` (and `mobile-tab-view.tsx`) must be loaded with `dynamic(() => ..., { ssr: false })` because `pdfjs-dist` references browser globals (`DOMMatrix`) at module evaluation time. Any static import of `PdfViewerPanel` from a server-rendered component will crash with `DOMMatrix is not defined`.

## DocumentProgressView Branch Condition

```typescript
if (mounted && !sessionError && docIdValid && hasToken && data?.status === "ready") {
  return <DocumentReaderLayout documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} />;
}
```

The guard waits for client-side hydration (`mounted`) and clears all the same pre-conditions as the polling UI, so there is no flash of the reader layout before the session token is validated.

## Human Verify Results

All 14 steps passed. No UI-SPEC deviations observed. Approved 2026-05-19.

## Deferred Security TODO (Phase 12)

`// TODO(phase-12): validate session ownership server-side in RSC before exposing explanation + signed URL.`

Located in `src/app/doc/[documentId]/page.tsx`. The RSC currently fetches by `documentId` from the URL without re-validating the session token server-side (STRIDE T-07.3-03 / T-07.3-07). The client-side polling in `DocumentProgressView` validates session ownership, but a direct URL access bypasses it. Phase 12 (INFRA) must add server-side ownership validation before public launch.

## Tests

No new automated tests added in this plan (UI integration tests for the reader layout require a running dev server; covered by human-verify instead). Plans 01–02 tests remain green:

```
✓ tests/lib/parse-citations.test.ts (8 tests)
✓ tests/components/explanation-panel.test.tsx (7 tests)
```
