# Phase 6: AI Explanation Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 06-ai-explanation-generation
**Areas discussed:** Analysis trigger, Explanation storage format

---

## Analysis Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto after embedding | Fires automatically via Vercel Cron + /api/internal/analyze-batch after embedding completes | ✓ |
| On-demand, first page load | Fires only when user opens /doc/[id] after embedding is done | |
| Manual trigger button | User clicks "Generate Explanation" — explicit opt-in | |

**User's choice:** Auto after embedding (Recommended)

**Follow-up: Invocation mechanism**

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Cron + internal route | Same pattern as embed-batch; slight cron-interval delay | ✓ |
| after() hook in embed pipeline | Immediate trigger after embed-batch; tighter coupling | |

**User's choice:** Vercel Cron + internal route (Recommended)

**Notes:** Consistent with existing pipeline. The `"analyzing"` status is already in the `document_status` enum, so no migration is needed for status tracking.

---

## Explanation Storage Format

| Option | Description | Selected |
|--------|-------------|----------|
| Structured JSON per section | JSON object with 5 string fields; [p.N] citations inline | ✓ |
| Markdown string with ## headers | Single markdown blob; Phase 7 must parse section boundaries | |

**User's choice:** Structured JSON per section (Recommended)

**Follow-up: Citation format within sections**

| Option | Description | Selected |
|--------|-------------|----------|
| [p.12] inline markers | Citations appear inline in prose text; regex-parseable | ✓ |
| Footnote-style at section end | [1] Page 12 — statement; cleaner reading, more linking complexity | |

**User's choice:** [p.12] inline markers (Recommended)

**Notes:** Consistent with REQUIREMENTS.md EXPLAIN-02. Phase 7 will parse [p.N] tokens into clickable PDF viewer jump links.

---

## Claude's Discretion

- SDK choice (native @google/genai vs Vercel AI SDK) — left to planner
- Whether to add jsonb migration for document_analysis.explanation
- Cron interval for analyze cron
- PSAK glossary initial term list
- Error handling strategy for Gemini quota exhaustion during analyze

## Deferred Ideas

- Vercel AI SDK useChat integration (Phase 10 entry point)
- Artificial streaming of cached explanation for re-visits
- Per-section regeneration (v2)
