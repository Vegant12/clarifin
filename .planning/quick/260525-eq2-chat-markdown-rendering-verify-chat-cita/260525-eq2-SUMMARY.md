---
phase: quick-260525-eq2
plan: 01
subsystem: chat-ui, ingest-diagnostics
tags: [markdown, citations, diagnostics, pdf, parse-batch]
requires:
  - react-markdown@^9
  - remark-gfm@^4
provides:
  - "ChatMessage renders markdown (bold, italics, lists, headings, code) with [p.N] citations preserved as CitationInline pills (HoverCard popovers) in every markdown context"
  - "[doc-page] and [parse-batch] server-side breadcrumbs at four named failure sites"
  - "Actionable PDF-viewer empty-state copy"
affects:
  - src/components/chat/chat-message.tsx
  - src/app/doc/[documentId]/page.tsx
  - src/components/doc/pdf-viewer-panel.tsx
  - src/lib/ingest/parse-document-batch.ts
tech_stack:
  added:
    - react-markdown@^9
    - remark-gfm@^4
  patterns:
    - "ReactMarkdown components-map with a renderInlineWithCitations helper that walks React.Children, parses [p.N] tokens per string leaf, and substitutes CitationInline pills"
key_files:
  modified:
    - src/components/chat/chat-message.tsx
    - src/components/chat/__tests__/chat-message.test.tsx
    - src/app/doc/[documentId]/page.tsx
    - src/components/doc/pdf-viewer-panel.tsx
    - src/lib/ingest/parse-document-batch.ts
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Inline helper (renderInlineWithCitations) over a remark plugin — react-markdown hands us text children for every inline element, so per-leaf parseCitations is the simplest correct path. Keep local to chat-message.tsx; hoist if a second consumer appears."
  - "No @tailwindcss/typography — the components-map already covers the inline styling we need."
  - "User messages bypass markdown processing — protects against accidental formatting injection from chat input."
metrics:
  duration_minutes: ~5
  tasks: 3
  files_changed: 7
completed: 2026-05-25
---

# Quick Task quick-260525-eq2: Chat Markdown Rendering + Citation Verify + PDF Diagnostics

Three small, related fixes landed together: markdown rendering in assistant
chat bubbles, tests proving citation popovers still work inside markdown nodes,
and server-side breadcrumb logs around the PDF signed-URL and parse-batch
failure paths.

## What shipped

### Task 1 — Markdown rendering in assistant chat messages

Replaced the assistant bubble's plain `<p whitespace-pre-wrap>` block with a
`ReactMarkdown` renderer (`react-markdown@^9` + `remark-gfm@^4`). A small
`renderInlineWithCitations` helper, kept private to `chat-message.tsx`, walks
each inline element's children and substitutes `CitationInline` pills for
every `[p.N]` token found in any string leaf. Result: `**bold**`, `- bullet`,
`# heading`, `` `code` `` all render as expected, and citations remain
clickable HoverCard pills regardless of whether they live in a paragraph, a
list item, or a bold span.

User messages and the GuardrailDeflection short-circuit were not touched —
they keep their pre-existing behavior (literal text, no markdown).

### Task 2 — Citation verification (implicitly delivered by Task 1)

The plan's second requirement — verifying `[p.N]` pills still work after
markdown landed — is delivered by Task 1's new tests:

- `assistant message: preserves citation pills inside list items` — two pills
  rendered inside `<li>` elements.
- `assistant message: preserves citation pill inside bold span` — pill
  rendered inside `<strong>`.

The pills resolve via `getByLabelText(/view source for page N/i)` (the
`CitationInline` aria-label), so a future markdown library upgrade that
silently changed leaf rendering would be caught.

### Task 3 — PDF + parse-pipeline diagnostics

Added four `console.error`/`console.warn` log lines, no behavior changes:

| File | Tag | Trigger |
|------|-----|---------|
| `src/app/doc/[documentId]/page.tsx` | `[doc-page] createSignedUrl failed` | `signedRes.error` set when `storage_path` was non-null but signing rejected |
| `src/app/doc/[documentId]/page.tsx` | `[doc-page] storage_path missing for document` | `documents` row loaded but `storage_path` is null/empty (older uploads) |
| `src/lib/ingest/parse-document-batch.ts` | `[parse-batch] download failed` | `supabaseAdmin.storage.from("pdfs").download(...)` returned an error |
| `src/lib/ingest/parse-document-batch.ts` | `[parse-batch] documents update during gemini upload failed` | `documents` update with `gemini_file_resource_name` returned an error |

The user-facing `error_message` strings persisted by `failDocument` were not
changed. Other `failDocument` call sites in `parse-document-batch.ts` already
have `console.error` next to them and were left alone.

PDF viewer empty-state copy moved from "PDF is not available for this document
yet." to a more actionable line pointing the user at re-upload — older
uploads without a `storage_path` will never recover by waiting.

## Files changed

Task 1 — markdown renderer:
- `package.json` (added `react-markdown@^9`, `remark-gfm@^4`)
- `pnpm-lock.yaml`
- `src/components/chat/chat-message.tsx`
- `src/components/chat/__tests__/chat-message.test.tsx` (4 original tests kept, 5 new tests)

Task 2 — diagnostics + empty-state copy:
- `src/app/doc/[documentId]/page.tsx`
- `src/components/doc/pdf-viewer-panel.tsx`
- `src/lib/ingest/parse-document-batch.ts`

Task 3 — this SUMMARY (orchestrator commits docs).

## Deferred

**The user-reported "could not upload PDF for analysis" parse failure was NOT
root-caused in this quick task.** The diagnostics added in Task 2 are intended
to give the NEXT incident a breadcrumb in the dev terminal. If the failure
reproduces, open `/gsd-debug` and use the `[doc-page]` or `[parse-batch]` log
line as the starting point. Likely classes:

- `[doc-page] storage_path missing for document …` → the row was created but
  the bucket upload didn't land — investigate the upload-init route.
- `[doc-page] createSignedUrl failed …` → the bucket object is gone or RLS is
  rejecting the service-role signer.
- `[parse-batch] download failed …` → same bucket-side cause as above, but
  hitting the worker instead of the page.
- `[parse-batch] documents update during gemini upload failed …` → Supabase
  write error, often a stale connection or RLS policy change.

Also deferred (out of scope per the executor's scope-boundary rule):

- `src/lib/chat/session-restore.test.ts` line 69 — two pre-existing TypeScript
  errors (TS2352, TS2493). Reproducible before my changes via
  `git stash && pnpm typecheck`.
- `src/lib/stock/fetch-stock-data.test.ts` — suite fails to load with `new
  YahooFinance()` TypeError at collection time. Predates this task.

Both are tracked in `deferred-items.md`.

## Verification

Commands that were run (all passing for files touched by this task):

```
pnpm add react-markdown@^9 remark-gfm@^4                # OK — 94 packages added
pnpm exec vitest run src/components/chat/__tests__/chat-message.test.tsx
                                                        # 9/9 tests pass (4 original + 5 new)
pnpm exec vitest run src/components/chat                # 13/13 tests pass
pnpm exec vitest run                                    # 284 passed, 1 pre-existing failure
                                                        # (fetch-stock-data — unrelated)
pnpm typecheck                                          # only pre-existing session-restore.test
                                                        # errors remain; no new errors from
                                                        # the 5 files this task touched
pnpm exec biome lint src/app/doc/[documentId]/page.tsx \
                     src/components/doc/pdf-viewer-panel.tsx \
                     src/lib/ingest/parse-document-batch.ts
                                                        # clean for my edits; 1 pre-existing
                                                        # warning on an untouched line
                                                        # (sessionIdParsed && …)
grep -n "\[doc-page\]\|\[parse-batch\]" \
        src/app/doc/[documentId]/page.tsx \
        src/lib/ingest/parse-document-batch.ts
                                                        # 4 hits confirmed at the named sites
```

## Tech-debt notes

None required. The `renderInlineWithCitations` helper is intentionally kept
local to `chat-message.tsx` — if a second consumer (e.g. the explanation
panel) ever wants the same markdown-with-citations behavior, hoist it into
`src/lib/citations/` then.

## Self-Check: PASSED

- Created/modified files exist:
  - `src/components/chat/chat-message.tsx` — FOUND
  - `src/components/chat/__tests__/chat-message.test.tsx` — FOUND
  - `src/app/doc/[documentId]/page.tsx` — FOUND
  - `src/components/doc/pdf-viewer-panel.tsx` — FOUND
  - `src/lib/ingest/parse-document-batch.ts` — FOUND
  - `package.json` — FOUND
  - `pnpm-lock.yaml` — FOUND
- Commits exist:
  - `cc20045` test(quick-260525-eq2): add failing tests for markdown rendering in chat — FOUND
  - `20ca2fb` feat(quick-260525-eq2): markdown rendering in assistant chat messages — FOUND
  - `466c6c0` feat(quick-260525-eq2): PDF + parse-pipeline diagnostics — FOUND
