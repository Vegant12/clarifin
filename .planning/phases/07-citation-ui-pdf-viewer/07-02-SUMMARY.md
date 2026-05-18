---
plan: 07-02
phase: 07-citation-ui-pdf-viewer
status: complete
wave: 2
completed: "2026-05-18"
self_check: PASSED
---

# Plan 07-02 Summary — Citation + Jargon UI Primitives

## What Was Built

7 client components + 1 pure parser delivering the trust mechanic in code: inline citation badges, verbatim-text hover popovers with client-side caching, dotted-underline jargon tooltips, a PDF loading skeleton, and the ExplanationPanel that composes them around the 5-section explanation JSON.

## Key Files Created

| File | Description |
|------|-------------|
| `src/components/ui/popover.tsx` | shadcn Popover primitive (Radix `@radix-ui/react-popover`) |
| `src/components/ui/tooltip.tsx` | shadcn Tooltip primitive (Radix `@radix-ui/react-tooltip`) |
| `src/lib/citations/parse-citations.ts` | Pure tokenizer: splits `[p.N]` markers into text + citation tokens |
| `src/components/doc/citation-inline.tsx` | `[p.N]` emerald badge with Popover trigger + keyboard nav |
| `src/components/doc/citation-popover.tsx` | On-demand `/api/page-text` fetch with module-level Map cache |
| `src/components/doc/jargon-tooltip.tsx` | Dotted-underline term wrapper with 300ms shadcn Tooltip |
| `src/components/doc/pdf-loading-skeleton.tsx` | 3-rect animate-pulse skeleton, `aria-label="Loading PDF document…"` |
| `src/components/doc/explanation-panel.tsx` | Renders 5-section ExplanationResult with citations + jargon detection |
| `tests/lib/parse-citations.test.ts` | 8 unit tests covering all tokenizer edge cases |
| `tests/components/explanation-panel.test.tsx` | 7 integration tests (render, click, jargon, snapshot) |

## ExplanationPanel API

```typescript
export function ExplanationPanel(props: {
  documentId: string;        // passed to CitationInline/CitationPopover for /api/page-text fetch
  explanation: ExplanationResult; // 5-section object from explanation-schema.ts
  onGoToPage: (page: number) => void; // callback from parent (Plan 03 wires to PDF scroll)
  className?: string;
}): JSX.Element;
```

## UI-SPEC Class Strings (for Plan 03 cross-reference)

**Citation badge** (`citation-inline.tsx`):
```
"inline-flex cursor-pointer items-center rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:shadow-sm"
```

**Jargon underline** (`jargon-tooltip.tsx`):
```
"cursor-help underline decoration-muted-foreground decoration-dotted underline-offset-2"
```

## wrapJargon Heuristic

Recursive longest-match substring scan:
- `SORTED_TERMS` precomputed at module load — keys sorted by `length DESC` so "operating margin" matches before "margin".
- Case-insensitive via `text.toLowerCase()` for index lookup; matched slice preserves original casing for display.
- No interaction with citation tokens — `parseCitations` splits out `[p.N]` BEFORE `wrapJargon` runs on the remaining text segments, so a jargon term can never overlap a citation marker.

## Module-Level pageTextCache

`const pageTextCache = new Map<string, string>()` in `citation-popover.tsx` is **module-scope**, not component-scope. It survives component unmount/remount within the same browser tab (D-07). Cleared only on full page reload. Exported `__clearPageTextCacheForTests()` allows test isolation.

## Open Items for Plan 03

- **150ms hover delay on CitationInline**: shadcn Popover has no `delayDuration`. The 150ms is implicit from Radix transition timing. If human-verify flags the popover as too eager, add a `setTimeout(150)` debounce in a follow-up. Not added pre-emptively.
- **Plan 03 wires `onGoToPage`** from `ExplanationPanel` to `PdfViewerPanel.scrollToPage(page)` via `useRef<PdfViewerHandle>`.

## Tests

```
✓ tests/lib/parse-citations.test.ts (8 tests)
✓ tests/components/explanation-panel.test.tsx (7 tests)
```

All 15 tests pass.

## Deviations

- `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `tests/setup-dom.ts` added as dev deps to support component tests (vitest `environment: "jsdom"` configured).
- Biome `useSemanticElements` lint rule suppressed on `<span role="button">` inside `PopoverTrigger asChild` — `asChild` requires a non-semantic element; suppression is the Radix-idiomatic approach.
