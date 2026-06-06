---
quick_id: 260524-ti5
slug: pre-phase12-fixes
status: complete
date: 2026-05-24
---

# Pre-Phase-12 Fixes — Complete

## Fix 1 — Explanation prompt elaboration ✓
`src/lib/explain/explain-prompts.ts` — Each of the 5 section prompts now asks Gemini to explain
the financial fact AND its effects/implications for the investor. Also corrected EXPLANATION_MODEL_ID
from gemini-2.0-flash → gemini-2.5-flash (pre-existing test mismatch).

## Fix 2 — Chat data stream response ✓
`src/app/api/chat/route.ts` — Guardrail and empty-retrieval short-circuit paths now return
`createDataStreamResponse` (AI SDK v4 data stream protocol) instead of `NextResponse.json`.
The old plain-JSON responses caused `useChat` to throw a parse error, showing "Connection error"
in the UI. All 8 chat route tests pass.

## Fix 3 — AI-powered ticker detection ✓
`src/lib/stock/detect-ticker-ai.ts` (new) — Server-only `detectTickerWithAI` function calls
Gemini with a text-only prompt on the first 5 pages; validates the 4-letter result against the
blocklist. `parse-document-batch.ts` now calls it as a soft-fail fallback when regex returns null.
Existing detect-ticker.ts tests unaffected (pure module kept clean).

## Commit
1c0504b fix(pre-phase12): explanation elaboration, chat data stream, AI ticker detection
