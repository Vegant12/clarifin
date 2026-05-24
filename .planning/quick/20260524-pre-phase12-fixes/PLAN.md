---
quick_id: 260524-ti5
slug: pre-phase12-fixes
date: 2026-05-24
description: Three pre-phase-12 fixes — explanation elaboration, chat data stream, AI ticker detection
---

# Pre-Phase-12 Fixes

## Fix 1 — Explanation prompt elaboration
**File:** `src/lib/explain/explain-prompts.ts`
- `buildExplanationPrompt` returns a prompt with 5 section descriptions
- Each section currently says "Explain X" — must also say "elaborate on what this means for the company and why an investor should care"
- Change: expand each of the 5 JSON key descriptions to include an effects/implications sentence

## Fix 2 — Chat data stream response
**File:** `src/app/api/chat/route.ts`
- Guardrail path (lines 92-101) returns `NextResponse.json()` — breaks useChat v4 parsing → error state
- Empty-retrieval path (lines 110-118) has the same problem
- Fix: import `createDataStreamResponse` and `formatDataStreamPart` from `ai`; use them to return proper data stream responses for both short-circuit paths

## Fix 3 — AI-powered ticker detection
**Files:** `src/lib/stock/detect-ticker.ts`, `src/lib/ingest/parse-document-batch.ts`
- Current `detectTicker` is pure regex on first 5 pages — misses non-standard IDX doc formats
- Fix: add `detectTickerWithAI(pageTexts: string[]): Promise<string | null>` in `detect-ticker.ts`
  - Uses `@google/genai` GoogleGenAI with a simple text-only `generateContent` call
  - Concatenates first 5 pages; asks Gemini to extract the 4-letter IDX ticker or return "null"
  - Validates output: 4 uppercase letters, not in blocklist
- Update `parse-document-batch.ts`: after regex returns null, call `detectTickerWithAI` as fallback
  - Soft-fail: any exception → null (same as regex)
