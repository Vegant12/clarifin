# Phase 8: AI Score & Drill-Down - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 08-ai-score-drill-down
**Areas discussed:** Score generation timing, SDK choice, Score UI placement, Drill-down interaction

---

## Score Generation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Same analyze-batch run | Sequential in same cron tick as explanation | ✓ |
| Separate score-batch after ready | New cron + route, fires after document is ready | |

**User's choice:** Same analyze-batch run — simpler, one pipeline step, one cron slot, Files API reuse.

---

### Score failure behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Soft fail — document still goes to ready | Explanation saved, score = null, UI shows gracefully | ✓ |
| Hard fail — document stays in analyzing | Entire pipeline retries including explanation re-generation | |

**User's choice:** Soft fail — explanation should not be blocked by score failure.

---

### Score caching

| Option | Description | Selected |
|--------|-------------|----------|
| Cache hit skips generation | Score non-null → skip Gemini call | ✓ |
| Always regenerate | Burn quota on every analyze-batch run | |

**User's choice:** Cache per-document — consistent with explanation caching pattern.

---

## SDK Choice for Scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Keep @google/genai + responseSchema | Consistent with all existing code, manual retry | ✓ |
| Vercel AI SDK generateObject | ROADMAP spec, built-in retry, introduces second SDK | |

**User's choice:** @google/genai — consistency with the existing codebase takes precedence.

---

### Retry count

| Option | Description | Selected |
|--------|-------------|----------|
| 1 retry (2 total attempts) | Fail faster, less quota use | ✓ |
| 2 retries (3 total attempts) | More chances to recover | |
| You decide | Leave to planner | |

**User's choice:** 1 retry — if Gemini returns invalid JSON twice, a third try is unlikely to help.

---

## Score UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top of explanation panel | Above the 5 sections, no layout restructuring | ✓ |
| Pinned header strip | Above both panels, always visible when scrolling | |
| New Score tab on mobile | 3rd tab on mobile, section in desktop panel | |

**User's choice:** Top of explanation panel — reading flow is verdict → evidence (sections).

---

### Score unavailable state

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton placeholder + unavailable state | Animated skeleton while loading, muted state if null | ✓ |
| Hide slot until ready | No placeholder, widget appears after score loads | |

**User's choice:** Skeleton + unavailable state — consistent with PDF loading skeleton from Phase 7.

---

### Disclaimer label placement (SCORE-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Adjacent inline, same line as number | Compact, always co-visible | |
| Below the number, smaller text | More visual hierarchy, prominent number | ✓ |

**User's choice:** Below the number — score number should be prominent; disclaimer in smaller muted text directly beneath.

---

## Drill-Down Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion expand/collapse | Inline block of snippets, no overlay | ✓ |
| Sheet/drawer overlay | Side or bottom sheet covers part of reader | |
| Modal | Centered dialog, disrupts reading flow | |

**User's choice:** Accordion — stays in context, no overlay.

---

### Multiple accordions

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | Opening second collapses first | ✓ |
| Multiple open simultaneously | All 4 can be open at once | |

**User's choice:** One at a time — keeps score card compact.

---

### Snippet citation behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — use CitationInline | [p.N] scrolls PDF viewer | ✓ |
| No — plain text page number | Non-interactive | |

**User's choice:** CitationInline — consistent citation behavior throughout the reader.

---

## Claude's Discretion

- Exact `score_breakdown` JSON schema shape (suggested structure in CONTEXT.md)
- Score number display styling (size, color)
- Dimension layout (grid vs vertical stack)
- Model ID and temperature for score prompt
- Score prompt criteria per dimension
- Error state UI copy for "AI Assessment unavailable"
- shadcn Accordion vs custom expand/collapse

## Deferred Ideas

- Vercel AI SDK `generateObject` — deferred in favor of `@google/genai` consistency
- Score regeneration UI button
- Score history / version tracking
- Color-coded score (red/yellow/green) — deferred; brand color (emerald) in v1
