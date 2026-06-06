# Deferred Items — quick-260525-eq2

Issues discovered out-of-scope during execution; NOT fixed in this task.

## Pre-existing typecheck errors (out of scope — scope boundary rule)

- `src/lib/chat/session-restore.test.ts` line 69 — two TS errors (TS2352
  string-cast and TS2493 tuple-index). Predates this task; reproducible with
  `git stash && pnpm typecheck`. Unrelated to chat markdown rendering or
  PDF/parse diagnostics.

## Pre-existing test failures (out of scope — scope boundary rule)

- `src/lib/stock/fetch-stock-data.test.ts` — fails to load with `new
  YahooFinance()` TypeError at suite collection time. Predates this task.

## Original feature deferral (per plan)

- The user-reported "could not upload PDF for analysis" parse failure was NOT
  root-caused. Task 2's diagnostic logs ([doc-page] / [parse-batch]) are
  intended to provide breadcrumbs for the next incident. Recommend `/gsd-debug`
  with one of those log lines as the entry point if it reproduces.
