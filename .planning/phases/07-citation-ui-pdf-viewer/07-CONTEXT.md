# Phase 7: Citation UI & PDF Viewer - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Render the Phase 6 explanation (5-section structured JSON with `[p.N]` citations) alongside the source PDF in a trust-building reading experience. Phase 7 delivers: split-pane desktop layout, click-to-scroll citation navigation, hover popovers with verbatim source text, financial term jargon tooltips, and a mobile tab-switcher fallback.

Phase 7 does NOT include: AI scoring (Phase 8), stock data/charts (Phase 9), or chat (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### PDF Viewer Library

- **D-01:** Use **react-pdf** (pdf.js wrapper) to render the PDF in the browser. Renders pages as canvas elements — gives full JS control over scroll position, page targeting, and future overlay capabilities. ~500KB bundle addition is acceptable.
- **D-02:** Citation clicks use **smooth scroll to page** within a continuous scrollable page list. Clicking `[p.12]` scrolls the PDF pane to page 12 — keeps the user in context, avoids disorienting hard jumps.

### Split-Pane Layout

- **D-03:** Desktop uses a **user-resizable split pane** via `react-resizable-panels`. Default ratio 50/50. User can drag the divider to give more space to either panel.
- **D-04:** The pane ratio is **persisted in localStorage** using react-resizable-panels' built-in `storage` prop. User drags once; ratio survives page reloads and return visits.
- **D-05:** Mobile (≤ 375px) uses a **tab switcher** — two tabs ("Explanation" and "PDF") replace the split layout. Tab state does not need to persist.

### Citation Hover Popover

- **D-06:** Hovering a `[p.N]` citation in the explanation shows a popover with **verbatim page text** fetched from the chunks table in Supabase.
- **D-07:** Page text is fetched **on-demand per hover**, via a new `GET /api/page-text?doc_id=X&page=N` route that queries `SELECT text FROM chunks WHERE doc_id = X AND page_number = N LIMIT 1`. Results are **cached client-side in a `Map`** keyed by `${docId}:${pageNum}` — subsequent hovers on the same page are instant. No upfront fetch on mount.
- **D-08:** The popover also contains a secondary "Go to page N →" button that triggers the PDF scroll (same as a citation click).

### Jargon Tooltips

- **D-09:** Financial term definitions come from a **static JSON file** (`src/lib/jargon/jargon-dictionary.json`), ~60-80 common IDX-relevant terms with one-sentence plain-English definitions. No Gemini calls, zero latency.
- **D-10:** Trigger: **hover on desktop, tap on mobile**. On mobile a first tap shows the definition; a second tap (or tap elsewhere) dismisses it. Matches ROADMAP spec (JARGON-01, JARGON-02).
- **D-11:** Term detection is **client-side substring match** against the explanation text — terms found in the rendered prose get a dotted underline and tooltip trigger. Case-insensitive matching.

### Document Page Architecture

- **D-12:** The existing `/doc/[documentId]` page currently shows `DocumentProgressView`. When `status === "ready"`, it transitions to the new reader layout. The transition is in-place (same route, same component tree) — no redirect.
- **D-13:** The explanation JSON is fetched server-side in the Next.js page component (RSC) from `document_analysis` table and passed as a prop. The PDF URL is a Supabase Storage signed URL fetched at the same time. Both fail gracefully if not yet available.

### Claude's Discretion

- Exact shadcn/ui popover component choice for citation hover and jargon tooltips (shadcn Popover or Tooltip — planner decides based on interaction pattern)
- Whether to add a page number indicator overlay on the PDF panel (e.g., "Page 12 / 87" in the corner)
- Loading skeleton design for the PDF while react-pdf initializes
- Exact wording of the tab labels on mobile

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 output (what this phase consumes)
- `.planning/phases/06-ai-explanation-generation/06-CONTEXT.md` — D-04 (5-section JSON schema), D-05 (`[p.N]` citation format)
- `src/lib/explain/explanation-schema.ts` — `ExplanationResult` type (5-section object, each a string with `[p.N]` markers)

### Requirements
- `.planning/REQUIREMENTS.md` — VIEWER-01 through VIEWER-04, JARGON-01, JARGON-02

### Existing UI assets to reuse
- `src/app/globals.css` — brand tokens (emerald-600 primary, zinc-100 muted, white bg)
- `src/components/ui/` — Button, Card, Separator (shadcn components already installed)
- `src/components/doc/document-progress-view.tsx` — existing doc page component to extend
- `src/lib/hooks/use-document-status.ts` — status polling hook (already wired)

### Roadmap success criteria
- `.planning/ROADMAP.md` §Phase 7 — 5 success criteria that define "done"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button`, `Card`, `Separator` (shadcn/ui): Core building blocks already installed. Planner should add `Popover`, `Tooltip`, and `Tabs` shadcn components via `npx shadcn add`.
- `useDocumentStatus` hook: Already polls `/api/status` — the reader page can branch on `status === "ready"` using this hook.
- `DocumentProgressView`: Current terminal page at `/doc/[documentId]`. Phase 7 extends this — when ready, it switches to the reader layout.
- Brand tokens in `globals.css`: emerald-600 primary, zinc-100 muted, white background — use these for the split-pane chrome, tab switcher, and popover styling.

### Established Patterns
- Server components for data fetching (RSC pattern): page.tsx fetches Supabase data server-side and passes props to client components. Follow this for fetching the explanation JSON and signed PDF URL.
- `getBrowserSessionToken()` + `sessionToken` pattern: used throughout for anonymous auth. The `/api/page-text` route will need to validate the session token like other internal routes.
- Tailwind v4 utility classes + `@theme` variables: all styling uses Tailwind. No CSS modules or styled-components.

### Integration Points
- `document_analysis` table: Phase 7 reads `explanation` (jsonb) and will need to query `chunks` for page text in the hover popover API route.
- Supabase Storage: the PDF is stored at `documents/{doc_id}/{filename}`. Phase 7 needs a signed URL for the react-pdf `<Document>` component.
- `/api/status` route: already returns `status` field. No changes needed.
- New route needed: `GET /api/page-text?doc_id=X&page=N` — queries `chunks` table, returns first chunk text for that page.

</code_context>

<specifics>
## Specific Ideas

- The popover for `[p.N]` should feel like a "quick verify" — user doesn't have to scroll the PDF just to check if the AI is telling the truth. The verbatim text + "Go to page" button together serve both trust and navigation.
- The jargon tooltip should feel subtle — dotted underline only (no icon), tooltip appears on hover/tap. Shouldn't clutter the explanation prose.
- The split-pane drag handle should be visually minimal (a thin line with a subtle grip indicator) — the reading experience is the focus, not the chrome.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-citation-ui-pdf-viewer*
*Context gathered: 2026-05-18*
