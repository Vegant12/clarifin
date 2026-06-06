---
phase: 7
slug: citation-ui-pdf-viewer
status: approved
shadcn_initialized: true
preset: new-york
created: 2026-05-18
---

# Phase 7 — UI Design Contract

> Visual and interaction contract for Phase 7: Citation UI & PDF Viewer.
> Pre-populated from CONTEXT.md (D-01 to D-13), globals.css tokens, and components.json.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (New York style) |
| Preset | new-york |
| Component library | Radix UI (via shadcn) |
| Icon library | lucide-react |
| Font | Geist Sans (var(--font-geist-sans)) |

**New components to add this phase (via `npx shadcn add`):**
- `tabs` — mobile tab switcher (Explanation / Source PDF)
- `popover` — citation hover popover (verbatim page text + go-to-page button)
- `tooltip` — jargon definition tooltip (one-sentence definition, read-only)

**Third-party npm packages (not shadcn blocks — no registry vetting required):**
- `react-pdf` — PDF rendering in browser (canvas-based, ~500KB bundle)
- `react-resizable-panels` — user-resizable split pane with localStorage persistence

---

## Spacing Scale

Declared values (must be multiples of 4). Inherits existing project spacing — Phase 7 adds no new tokens.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, citation badge padding |
| sm | 8px | Popover inner padding, tab padding |
| md | 16px | Panel content padding, card body |
| lg | 24px | Section gaps within explanation |
| xl | 32px | Panel-to-panel gap (split divider area) |
| 2xl | 48px | Vertical section breaks in explanation |
| 3xl | 64px | Page-level top padding |

Exceptions: The split-pane drag handle is 4px wide (1 Tailwind unit) — intentionally below the `xs` token for visual minimalism.

---

## Typography

Inherits existing project type scale (Geist Sans, Tailwind v4 defaults). Phase 7 adds no new type tokens.

**2 weights only — 400 (regular) and 600 (semibold). No medium weight (500).**

| Role | Size | Weight | Line Height | Usage in Phase 7 |
|------|------|--------|-------------|-----------------|
| Body | 16px | 400 | 1.5 | Explanation prose, popover source text |
| Label | 14px | 400 | 1.25 | Tab labels ("Explanation" / "Source PDF"), page number badge |
| Heading | 20px | 600 | 1.25 | Explanation section headings (5 sections from Phase 6 JSON) |
| Small | 12px | 400 | 1.5 | Citation inline badge `[p.N]`, jargon tooltip text |

Jargon tooltip definitions: 14px / weight 400 / line-height 1.4 (one sentence max).

Active tab labels are distinguished by color (emerald-600 bottom border) and not by font weight.

---

## Color

Inherits Phase 1 brand tokens from `src/app/globals.css`. No new color tokens added.

| Role | Value | Tailwind Token | Usage |
|------|-------|---------------|-------|
| Dominant (60%) | #ffffff | `background` / `white` | Page background, panel surfaces, popover background |
| Secondary (30%) | #f4f4f5 | `zinc-100` / `muted` | Split-pane chrome, tab bar background, drag handle |
| Accent (10%) | #059669 | `emerald-600` / `primary` | Citation inline badge background, "Go to page →" button, active tab indicator, focus rings |
| Muted foreground | #71717a | `zinc-500` / `muted-foreground` | Pagination overlay text, helper text in popovers |
| Border | #e4e4e7 | `zinc-200` / `border` | Split divider line, popover border, tooltip border |
| Destructive | #dc2626 | `red-600` / `destructive` | PDF load error state only |
| Foreground | #1a1a1a | `zinc-900` / `foreground` | All primary text: explanation prose, popover content, tab labels |

**Accent reserved for:**
- Citation inline badge `[p.N]` background (emerald-600 fill, white text)
- "Go to page N →" button in citation popover
- Active tab underline indicator (mobile tab switcher)
- Focus ring on citation spans and jargon underlines (`ring-ring` = emerald-600)

Accent is NOT used for: headers, dividers, card backgrounds, general links, body text, or the split-pane drag handle.

**Jargon underline:** `text-decoration: underline dotted` using `text-muted-foreground` (zinc-500) — subtle, not accent-colored. Jargon terms do not use emerald; emerald is reserved for citations only.

---

## Visual Hierarchy

**Primary focal point:** The citation inline badge `[p.N]` (emerald-600 fill, white text, rounded-full) is the primary visual anchor in the explanation panel. It is the only element using the accent color at rest, directing the user's eye to verifiable claims.

**Reading flow:** Explanation prose (foreground/400) → citation badges (emerald accent) → PDF panel (muted chrome). Jargon dotted underlines are zinc-500 (tertiary), never competing with citation badges for attention.

---

## Component Inventory

### New Components (Phase 7)

| Component | Path | Type | Description |
|-----------|------|------|-------------|
| `DocumentReaderLayout` | `src/components/doc/document-reader-layout.tsx` | client | Root split-pane wrapper using react-resizable-panels |
| `ExplanationPanel` | `src/components/doc/explanation-panel.tsx` | client | Renders 5-section explanation JSON with citation detection |
| `PdfViewerPanel` | `src/components/doc/pdf-viewer-panel.tsx` | client | react-pdf Document + page list with imperative scroll API |
| `CitationInline` | `src/components/doc/citation-inline.tsx` | client | `[p.N]` span → hover triggers CitationPopover |
| `CitationPopover` | `src/components/doc/citation-popover.tsx` | client | shadcn Popover: verbatim page text + "Go to page N →" button |
| `JargonTooltip` | `src/components/doc/jargon-tooltip.tsx` | client | shadcn Tooltip: wraps matching terms, dotted underline |
| `PdfLoadingSkeleton` | `src/components/doc/pdf-loading-skeleton.tsx` | client | Animated skeleton while react-pdf initializes |
| `MobileTabView` | `src/components/doc/mobile-tab-view.tsx` | client | shadcn Tabs wrapper for ≤768px layout |

### Modified Components (Phase 7)

| Component | Path | Change |
|-----------|------|--------|
| `document-progress-view.tsx` | `src/components/doc/document-progress-view.tsx` | When `status === "ready"`, render `DocumentReaderLayout` instead of progress UI |

### New API Routes (Phase 7)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/page-text` | GET | `?doc_id=X&page=N` — queries `chunks` table, returns first chunk text for page |

---

## Interaction States

### Split Pane (desktop ≥769px)

| State | Visual |
|-------|--------|
| Default | 50/50 split, thin zinc-200 divider with a 4px center grip indicator |
| Dragging | Divider highlights to emerald-600/20 (10% opacity), cursor `col-resize` |
| After drag | New ratio persisted to localStorage key `reader-panel-ratio` |
| Min panel width | 280px per side (prevents either panel from becoming unusable) |

### Citation Inline `[p.N]`

| State | Visual |
|-------|--------|
| Default | Emerald-600 badge pill, white text, 12px, rounded-full, `cursor-pointer` |
| Hover | Slightly elevated box-shadow (`shadow-sm`), popover opens after 150ms delay |
| Focus (keyboard) | Emerald focus ring (`ring-2 ring-ring ring-offset-1`) |
| Active/click | PDF pane scrolls to page N; badge unchanged |
| Popover open | shadcn Popover attached below citation, z-50 |

### Citation Popover

| State | Visual |
|-------|--------|
| Loading | "Loading source text…" with subtle Tailwind animate-pulse on a 2-line skeleton |
| Loaded | Verbatim page text (max 4 lines, ellipsis if longer) + "Go to page N →" button |
| Error/missing | "Source text unavailable for this page." (muted-foreground, no button) |
| Cached | Instant display (no loading state if already in client Map) |

### Jargon Tooltip

| State | Visual |
|-------|--------|
| Default | Matching term: dotted underline (zinc-500), no other visual change |
| Hover (desktop) | shadcn Tooltip appears after 300ms delay, above the term |
| Tap (mobile) | First tap shows tooltip; second tap or tap-away dismisses |
| Focus (keyboard) | Tooltip shows on focus, dismisses on blur |

### PDF Viewer

| State | Visual |
|-------|--------|
| Loading | `PdfLoadingSkeleton` — 3 stacked page rectangles with animate-pulse (zinc-100 fill) |
| Loaded | Continuous scrollable page list inside PdfViewerPanel |
| Page jump | `scrollIntoView({ behavior: "smooth" })` on target page element |
| Error | Red-600 error message: "Could not load PDF. Try refreshing." |
| Page number indicator | Sticky bottom-right overlay `"Page N / Total"` — 12px, zinc-500, bg white/80 |

### Mobile Tab Switcher (≤768px)

| State | Visual |
|-------|--------|
| Default | "Explanation" tab active, zinc-100 tab bar background |
| Active tab | Emerald-600 bottom border indicator, foreground text weight 600 |
| Inactive tab | Muted foreground text, no underline |
| Tab switch | Instant (no animation) — content panels are show/hide, not animated |

---

## Responsive Layout

| Breakpoint | Layout | Trigger |
|------------|--------|---------|
| ≥769px (md+) | `DocumentReaderLayout` with `react-resizable-panels` side-by-side | `hidden md:flex` |
| ≤768px | `MobileTabView` with shadcn `Tabs` (Explanation / Source PDF) | `flex md:hidden` |

The ≤768px breakpoint satisfies both VIEWER-04 (≤768px) and ROADMAP success criteria (375px test case).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Tab label — explanation | "Explanation" |
| Tab label — PDF | "Source PDF" |
| Citation badge | "[p.N]" (literal, N = page number, no surrounding text) |
| Citation popover loading | "Loading source text…" |
| Citation popover error | "Source text unavailable for this page." |
| Citation popover go-to button | "Go to page N →" (N = page number) |
| Jargon tooltip — format | "{Term}: {one-sentence plain-English definition}." |
| PDF loading skeleton aria | "Loading PDF document…" |
| PDF error | "Could not load PDF. Try refreshing the page." |
| Page indicator | "Page N / Total" |
| Split pane drag handle aria | "Drag to resize panels" |
| No explanation data heading | "Explanation not ready" |
| No explanation data body | "The analysis is still processing. Check back in a moment." |

No destructive actions in Phase 7 — no confirmation copy needed.

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Citation keyboard nav | `<span tabIndex={0}>` on citation badge; Enter/Space triggers PDF scroll; popover opens on focus |
| Citation ARIA | `aria-label="View source for page N"` on each citation span |
| Citation popover ARIA | `role="dialog"` with `aria-label="Source text for page N"` |
| Jargon tooltip ARIA | `role="tooltip"` with `id` linked via `aria-describedby` on the term span |
| PDF panel ARIA | `aria-label="Source document viewer"` on the panel root |
| Tab switcher | shadcn Tabs (Radix TabsList/Tab) — fully accessible by default |
| Drag handle | `role="separator"` + `aria-orientation="vertical"` + `aria-label="Drag to resize panels"` |
| PDF loading | `aria-busy="true"` on PdfViewerPanel while loading |
| Focus order | Explanation panel first, PDF panel second (matches visual reading order) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `tabs`, `popover`, `tooltip` | not required |

**No third-party shadcn registries declared.** `react-pdf` and `react-resizable-panels` are standard npm packages installed via `npm install` — outside shadcn registry scope.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-18
