# Phase 7: Citation UI & PDF Viewer — Discussion Log

**Session date:** 2026-05-18
**Phase:** 07-citation-ui-pdf-viewer

---

## Areas Discussed

### 1. PDF Viewer Library

**Q:** Which PDF rendering library to use — react-pdf (pdf.js wrapper) vs a direct pdf.js integration?

**Decision:** react-pdf. Renders pages as canvas elements, gives full JS control over scroll position and page targeting. ~500KB bundle addition is acceptable. The canvas approach also opens the door to future overlay capabilities (Phase 8+ annotation).

---

### 2. Citation Click Behavior

**Q:** Should citation clicks navigate via hard page jump or smooth scroll within a continuous page list?

**Decision:** Smooth scroll to page within a continuous scrollable page list. Clicking `[p.12]` scrolls the PDF pane to page 12. Keeps the user in context — avoids disorienting hard jumps.

---

### 3. Split-Pane Layout

**Q:** How should the split pane be implemented — fixed ratio, CSS only, or a drag library?

**Decision:** react-resizable-panels with user-resizable drag handle. Default 50/50 ratio. User can adjust once and the ratio persists via localStorage (react-resizable-panels' built-in `storage` prop).

---

### 4. Mobile Layout

**Q:** Should mobile show a reduced-width split pane or a completely different layout?

**Decision:** Tab switcher on mobile (≤375px) — two tabs ("Explanation" and "PDF") replace the split layout entirely. Tab state does not need to persist. Mobile reading of a split pane is unusable.

---

### 5. Citation Hover Popover

**Q:** Should the popover content (verbatim page text) be fetched upfront for the whole document, or on-demand per hover?

**Decision:** On-demand per hover via a new `GET /api/page-text?doc_id=X&page=N` route. Results cached client-side in a `Map` keyed by `${docId}:${pageNum}`. Subsequent hovers on the same page are instant. No upfront bulk fetch on mount — avoids unnecessary bandwidth.

The popover also contains a "Go to page N →" button that triggers the PDF scroll, letting the user verify in context without clicking the citation first.

---

### 6. Jargon Tooltip Source

**Q:** Should jargon definitions come from a static JSON file or a Gemini call?

**Decision:** Static JSON file (`src/lib/jargon/jargon-dictionary.json`), ~60-80 common IDX-relevant terms with one-sentence plain-English definitions. No Gemini calls, zero latency. These are stable financial terms that don't change.

---

### 7. Jargon Tooltip Trigger

**Q:** Hover-only, tap-only, or both?

**Decision:** Hover on desktop, tap on mobile. On mobile, first tap shows the definition; second tap (or tap elsewhere) dismisses it. Matches JARGON-01 and JARGON-02 requirements.

---

### 8. Term Detection Method

**Q:** Should term detection be AI-assisted (ask Gemini to tag terms during explanation generation) or purely client-side?

**Decision:** Client-side substring match against the rendered explanation text. Case-insensitive. Terms found in the prose get a dotted underline. No Gemini calls — keeps Phase 7 fully offline for the tooltip layer.

---

### 9. Document Page Architecture

**Q:** Should the reader view live on a new route or extend the existing `/doc/[documentId]` page?

**Decision:** Extend in-place. When `status === "ready"`, the existing `/doc/[documentId]` page transitions from `DocumentProgressView` to the new reader layout — same route, same component tree, no redirect. Avoids a navigation moment and keeps URL stable.

The explanation JSON is fetched server-side (RSC) from `document_analysis` and the PDF signed URL from Supabase Storage, both passed as props. Both fail gracefully if not yet available.

---

## Deferred / Out of Scope

None — all discussion stayed within Phase 7 scope.
