---
phase: 260526-c5k
plan: 01
type: execute
subsystem: ui-rendering, citations
tags: [bug-fix, refactor, react-markdown, citations, explanation-panel]
requirements: [QUICK-260526-C5K]
provides:
  - "Multi-page citation parser supporting [p.N, p.M, ...] blocks"
  - "Shared renderInlineWithCitations helper with transformText extension point"
  - "Markdown-rendered ExplanationPanel sections (bold, lists, headings, code)"
affects:
  - "src/components/doc/explanation-panel.tsx"
  - "src/components/chat/chat-message.tsx"
key-files:
  created:
    - "src/lib/citations/render-inline-citations.tsx"
  modified:
    - "src/lib/citations/parse-citations.ts"
    - "tests/lib/parse-citations.test.ts"
    - "src/components/chat/chat-message.tsx"
    - "src/components/doc/explanation-panel.tsx"
metrics:
  duration: ~30min
  completed: "2026-05-26"
  tasks_completed: 3
  files_touched: 5
  tests_added: 8
  commits: 4
---

# Quick Task 260526-c5k: ExplanationPanel markdown rendering + multi-page citations Summary

Two surgical fixes shipped together: multi-page citation tokens (`[p.49, p.111]`) now render as separate pills via an updated `parseCitations` regex, and the AI explanation panel now flows through `react-markdown` so `**bold**`, lists, and headings render as formatting instead of literal syntax — with `JargonTooltip` wrapping and citation pills preserved end-to-end.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/citations/parse-citations.ts` | Block-level regex (`/\[p\.[^\]]*\]/g`) + digit extraction. Drops `[p.0]` and `[p.]` silently. |
| `tests/lib/parse-citations.test.ts` | +8 new cases (multi-page, ranges, malformed, drop-then-text behavior). |
| `src/lib/citations/render-inline-citations.tsx` | NEW. Shared helper, options-object signature, `transformText` hook. |
| `src/components/chat/chat-message.tsx` | Imports shared helper, deletes local copy, options-object call site. |
| `src/components/doc/explanation-panel.tsx` | Renders each section body via `ReactMarkdown` + `remark-gfm`; inline contexts use shared helper with `transformText: wrapJargon`. |

## Behavior Changes

### Citation parser

| Input | Before | After |
|-------|--------|-------|
| `[p.49]` | `citation(49)` | `citation(49)` (unchanged) |
| `[p.49, p.111]` | `text("[p.49, p.111]")` (raw bracket text leaked) | `citation(49), citation(111)` |
| `[p.49, 111]` | `text("[p.49, 111]")` | `citation(49), citation(111)` |
| `[p.49 - p.55]` | `text("[p.49 - p.55]")` | `citation(49), citation(55)` (range endpoints, v1 approximation) |
| `[p.0]` | `citation(0)` (broken pill) | `[]` (dropped) |
| `[p.]` | `text("[p.]")` | `[]` (dropped) |
| `[foo]` | `text("[foo]")` | `text("[foo]")` (unchanged — `p.` prefix required) |
| `text [p.0] more` | `text("text "), citation(0), text(" more")` | `text("text "), text(" more")` |

The drop-on-malformed behavior matches the trust guarantee: LLMs occasionally emit `[p.0]` when they can't find a real page; surfacing the literal pill or bracket text looks broken to the reader.

### Explanation panel rendering

Before: each section body was a single `<p>` with manual `parseCitations` tokenization + `wrapJargon` calls. `**bold**` and `- list` markdown showed as literal syntax.

After: each section body flows through `ReactMarkdown` + `remark-gfm`. Inline contexts (`p`, `strong`, `em`, `li`, `h1-h3`) run their children through the shared `renderInlineWithCitations` helper with `transformText: (text, key) => wrapJargon(text, key)`. Block-level wrappers (`ul`, `ol`, `pre`) pass children through unchanged so nested markdown still descends through the same handlers.

The section LABEL `h2` (e.g. "Revenue") stays OUTSIDE `ReactMarkdown` so its `text-xl` styling does not collide with the markdown-body `h2` override (`text-base`).

## Shared Helper: `renderInlineWithCitations`

New module at `src/lib/citations/render-inline-citations.tsx`. Used by both `chat-message.tsx` and `explanation-panel.tsx`.

```tsx
renderInlineWithCitations(children, {
  keyPrefix,
  docId,
  onGoToPage,
  transformText?, // optional: wrap text leaves (e.g. JargonTooltip)
});
```

**Extension point:** the `transformText` hook is the seam for a third caller. If a future surface needs different text-leaf decoration (highlighting, term linking, etc.), wire it via `transformText` rather than forking the helper. The whole reason this fix exists is that chat-message and explanation-panel had drifted — chat got multi-page support in `quick-260525-eq2`, explanation didn't. Centralizing the walk prevents the next drift.

## Test Coverage Delta

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| `tests/lib/parse-citations.test.ts` | 8 | 16 | +8 (multi-page, range, malformed, drop-text-merge) |
| `src/components/chat/__tests__/chat-message.test.tsx` | 9 | 9 | unchanged (contract preserved) |
| `tests/components/explanation-panel.test.tsx` | 7 | 7 | unchanged (snapshot regenerated, byte-identical) |

**Snapshot diff:** zero. The existing snapshot fixture (`"Revenue grew [p.1]."` + 4 plain-text sections) renders byte-identically before and after the markdown switch — react-markdown's `<p>` for a single-paragraph string with no block markup produces the same DOM as the previous hand-written `<p>`. Manually verified: `CitationInline` trigger (`aria-label="View source for page 1"`) and `JargonTooltip` trigger (`.decoration-dotted` on "Revenue") both still present; `ScoreCard`/disclaimer paragraphs untouched.

**Multi-page rendering verification:** parser unit tests cover the token sequence (Test 9: `[p.49, p.111]` → text, cite(49), cite(111), text). The full render path is covered transitively — both `chat-message` and `explanation-panel` route through the same helper, and chat-message tests already exercise citation-inside-bold and citation-inside-list (Tests 7-8 in that suite).

## Verification

- `pnpm exec vitest run tests/lib/parse-citations.test.ts src/components/chat/__tests__/chat-message.test.tsx tests/components/explanation-panel.test.tsx src/components/doc src/lib/citations` — **60/60 pass**.
- `pnpm typecheck` — only pre-existing `src/lib/chat/session-restore.test.ts` errors (per CLAUDE.md scope). No new errors in any touched file.

Manual smoke (recommended, not automated): open a real document whose explanation includes both `**bold**` and a `[p.49, p.111]` citation; confirm bold renders as `<strong>`, both pills click through to the right pages, and a glossary term like `revenue` still shows the tooltip popover.

## Commits

| Hash | Subject |
|------|---------|
| `5ac040e` | `test(quick-260526-c5k): add failing tests for multi-page citation parsing` |
| `817f207` | `fix(quick-260526-c5k): parse multi-page citation blocks as separate pills` |
| `5df1c1d` | `refactor(quick-260526-c5k): extract renderInlineWithCitations to shared module` |
| `8373f58` | `fix(quick-260526-c5k): render ExplanationPanel sections as markdown` |

## Deviations from Plan

None. Plan executed exactly as written. The snapshot byte-identical outcome was anticipated by the plan ("possibly different attribute ordering"); zero diff was the best case and it landed.

## Cumulative observation

This is the **4th** quick task in the v1 polish stretch touching user-visible rendering paths:

| Quick task | Date | Surface |
|-----------|------|---------|
| `260525-dl3` | 2026-05-25 | Post-analysis nav, PDF viewer, chat connection, citation popover flicker |
| `260525-eq2` | 2026-05-25 | Chat markdown rendering + chat citation popover + PDF/parse diagnostics |
| `260526-c5k` | 2026-05-26 | ExplanationPanel markdown + multi-page citations |
| (a prior c-prefix quick task) | earlier | citation/UI work |

The cumulative diff across these tasks now spans citation parsing, citation pill rendering, chat markdown, explanation markdown, PDF viewer interactions, and post-analysis navigation — i.e. essentially every surface a user looks at after upload. Two follow-up actions worth considering before more polish work:

1. **Consolidation pass.** The `renderInlineWithCitations` helper now exists as a single seam; revisit whether other rendering helpers (`wrapJargon`, the PDF-page navigation handlers, citation popovers) have parallel drift between explanation and chat. The c5k bug existed because chat got the fix in `eq2` and explanation didn't — that's the canonical multi-surface-drift failure mode.
2. **Regression test pass.** A small end-to-end test (Playwright or a hand-written render test) over the "upload doc → explanation + chat both render citations and markdown correctly" path would catch the next drift before a user notices. Right now, parser unit tests + component tests cover the helpers but not the integrated render path through a real LLM-shaped explanation.

Suggest scheduling one of these (probably the e2e regression test, since the consolidation is mostly preventive) before adding more rendering polish.

## Self-Check: PASSED

- `src/lib/citations/parse-citations.ts` exists and contains `CITATION_BLOCK_REGEX` and `PAGE_DIGITS_REGEX`.
- `src/lib/citations/render-inline-citations.tsx` exists and exports `renderInlineWithCitations` + `RenderInlineCitationsOptions`.
- `src/components/chat/chat-message.tsx` imports from the shared module and has no local `renderInlineWithCitations` function.
- `src/components/doc/explanation-panel.tsx` imports `ReactMarkdown`, `remark-gfm`, and the shared helper. `parseCitations` and `CitationInline` are NOT directly imported there anymore.
- Commits `5ac040e`, `817f207`, `5df1c1d`, `8373f58` all present in `git log`.
- All 60 affected tests pass; `pnpm typecheck` clean apart from accepted pre-existing errors.
