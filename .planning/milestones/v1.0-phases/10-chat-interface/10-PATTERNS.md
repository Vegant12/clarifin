# Phase 10: Chat Interface - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/chat/route.ts` | route | request-response + streaming | `src/app/api/session/route.ts` + `src/app/api/upload-complete/route.ts` | role-match |
| `src/app/api/starter-questions/route.ts` | route | request-response | `src/app/api/session/route.ts` | role-match |
| `src/app/doc/[documentId]/page.tsx` | page (Server Component) | CRUD | `src/app/doc/[documentId]/page.tsx` (extend) | exact |
| `src/components/chat/ChatPanel.tsx` | component | request-response | `src/components/doc/explanation-panel.tsx` | role-match |
| `src/components/chat/ChatInterface.tsx` | component | streaming | `src/components/session-provider.tsx` | role-match |
| `src/components/chat/ChatMessage.tsx` | component | transform | `src/components/doc/citation-inline.tsx` | role-match |
| `src/components/chat/StarterQuestions.tsx` | component | request-response | `src/components/doc/score-card.tsx` | role-match |
| `src/components/chat/ChatCitationBadge.tsx` | component | transform | `src/components/doc/citation-inline.tsx` | exact |
| `src/lib/chat/guardrail.ts` | utility | transform | `src/lib/explain/score-prompts.ts` | exact |
| `src/lib/chat/prompts.ts` | utility | transform | `src/lib/explain/explain-prompts.ts` | exact |
| `src/lib/chat/starter-questions-schema.ts` | utility | transform | `src/lib/explain/score-schema.ts` | exact |

---

## Pattern Assignments

### `src/app/api/chat/route.ts` (route, streaming + request-response)

**Primary analog:** `src/app/api/session/route.ts`
**Secondary analog:** `src/app/api/upload-complete/route.ts`

**Imports pattern** (session/route.ts lines 1-4):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/db/client";
```

**Extend with these chat-specific imports:**
```typescript
import 'server-only'
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { matchDocumentChunks } from '@/lib/rag/match-document-chunks'
import { isInvestmentAdviceQuery } from '@/lib/chat/guardrail'
import { CHAT_SYSTEM_PROMPT } from '@/lib/chat/prompts'
```

**Zod request validation pattern** (session/route.ts lines 6-8):
```typescript
const bodySchema = z.object({
  session_token: z.string().uuid(),
});
```

**Adapt for chat:**
```typescript
const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(20),
  documentId: z.string().uuid(),
  sessionId: z.string().uuid(),
})
```

**Core handler pattern** (session/route.ts lines 10-51 — async POST with try/catch + safeParse):
```typescript
export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request. Provide a UUID session_token." },
        { status: 400 },
      );
    }
    // ... business logic ...
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
```

**Supabase insert pattern** (upload-complete/route.ts lines 71-80):
```typescript
await supabaseAdmin
  .from("documents")
  .update({ status: "failed", error_message: "..." })
  .eq("id", doc_id);
```

**Adapt for chat_messages insert (always include both session_id AND doc_id):**
```typescript
await supabaseAdmin.from('chat_messages').insert([
  { session_id: sessionId, doc_id: documentId, role: 'user', content: lastMessage },
])
```

**Streaming response pattern** (from RESEARCH.md Pattern 1 — no existing codebase analog uses streamText):
```typescript
const result = streamText({
  model: google('gemini-2.5-flash'),
  system: CHAT_SYSTEM_PROMPT(context),
  messages,
  maxTokens: 1500,
  temperature: 0.3,
  onFinish: async ({ text }) => {
    await supabaseAdmin.from('chat_messages').insert([
      { session_id: sessionId, doc_id: documentId, role: 'assistant', content: text },
    ])
  },
})
return result.toDataStreamResponse()
```

**Error handling pattern** (session/route.ts lines 29-31, 43-45):
```typescript
if (existing.error) {
  return NextResponse.json({ error: "Could not verify session." }, { status: 500 });
}
```

---

### `src/app/api/starter-questions/route.ts` (route, request-response)

**Analog:** `src/app/api/session/route.ts`

**Imports pattern** (session/route.ts lines 1-4):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/db/client";
```

**Extend with:**
```typescript
import 'server-only'
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { StarterQuestionsSchema } from '@/lib/chat/starter-questions-schema'
```

**Core handler pattern** (same try/catch + safeParse as session/route.ts lines 10-51):
```typescript
export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    // generateObject call here
    return NextResponse.json({ questions: object.questions });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
```

**generateObject pattern** (from RESEARCH.md Pattern 4 — v4 API; no existing codebase analog):
```typescript
const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: StarterQuestionsSchema,
  prompt: `Given this financial document summary, generate 5 plain-English questions a non-finance investor would want to ask:\n\n${documentSummary}`,
})
// object.questions: string[] (5 items, typed)
```

---

### `src/app/doc/[documentId]/page.tsx` (Server Component, CRUD — EXTEND existing file)

**Analog:** `src/app/doc/[documentId]/page.tsx` (self — this is the file being extended)

**Existing Supabase multi-query pattern** (page.tsx lines 19-66 — fetch several tables in sequence):
```typescript
const analysisRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation, score_breakdown")
  .eq("doc_id", documentId)
  .maybeSingle();

const docRes = await supabaseAdmin
  .from("documents")
  .select("storage_path, ticker")
  .eq("id", documentId)
  .maybeSingle();
```

**Add chat history fetch using this same pattern:**
```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const chatRes = await supabaseAdmin
  .from('chat_messages')
  .select('id, role, content, created_at')
  .eq('session_id', sessionId)
  .eq('doc_id', documentId)
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: true })
  .limit(40)
```

**Note:** The server component currently has no access to sessionId (stored in localStorage). Per RESEARCH.md Open Question 2, either: pass sessionId as a URL search param after `ensureBrowserSession`, OR move chat history fetch to a client boundary. The existing page passes all data down as props to `DocumentProgressView`; follow the same prop-drilling pattern when adding `initialMessages`.

---

### `src/components/chat/ChatPanel.tsx` (component, request-response — container)

**Analog:** `src/components/doc/explanation-panel.tsx`

**Client component declaration and imports** (explanation-panel.tsx lines 1-18):
```typescript
"use client";

import { Fragment } from "react";
import { parseCitations } from "@/lib/citations/parse-citations";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import { cn } from "@/lib/utils";
import { CitationInline } from "./citation-inline";
```

**Prop interface pattern** (explanation-panel.tsx lines 83-95):
```typescript
export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  score: ScoreResult | null;
  onGoToPage: (page: number) => void;
  className?: string;
  // Phase 9 additions
  ticker: string | null;
  stockData: StockData | null;
}) {
  const { documentId, explanation, score, onGoToPage, className } = props;
```

**Adapt for ChatPanel:**
```typescript
export function ChatPanel(props: {
  documentId: string
  sessionId: string
  initialMessages: Message[]
  starterQuestions: string[]
  className?: string
}) {
  const { documentId, sessionId, initialMessages, starterQuestions, className } = props
```

**Section/article layout pattern** (explanation-panel.tsx lines 107-178 — flex col, gap, rounded-lg border):
```typescript
<article
  className={cn("flex flex-col gap-12 px-6 py-8", className)}
  aria-label="Plain-English explanation"
>
```

---

### `src/components/chat/ChatInterface.tsx` (component, streaming)

**Analog:** `src/components/session-provider.tsx`

**Client component + useEffect async pattern** (session-provider.tsx lines 1-48):
```typescript
"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { ensureBrowserSession } from "@/lib/session-client";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSessionReady, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureBrowserSession();
        if (!cancelled) { setReady(true); }
      } catch (e: unknown) {
        if (!cancelled) {
          setSessionError(e instanceof Error ? e.message : "Could not start session.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
```

**useChat hook pattern** (from RESEARCH.md Pattern 2 — v4 API; no existing codebase analog):
```typescript
// CRITICAL: import from 'ai/react', NOT '@ai-sdk/react' — v4 only
import { useChat, type Message } from 'ai/react'

const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  body: { documentId, sessionId },    // sent with every request
  initialMessages,                    // pre-loaded for session restore
})
```

**Disabled button state pattern** (document-progress-view.tsx lines 83-86 — Button with disabled):
```typescript
<Button asChild variant="outline" className="h-11">
  <Link href="/">Back to home</Link>
</Button>
```

---

### `src/components/chat/ChatMessage.tsx` (component, transform)

**Analog:** `src/components/doc/citation-inline.tsx`

**Client component with state** (citation-inline.tsx lines 1-8):
```typescript
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CitationPopover } from "./citation-popover";
```

**Citation token rendering pattern** (explanation-panel.tsx lines 146-177 — parseCitations + map tokens):
```typescript
const tokens = parseCitations(sectionText);
// ...
{tokens.map((tok, idx) => {
  if (tok.kind === "citation") {
    return (
      <CitationInline
        key={`${sectionKey}.cite.${idx}`}
        page={tok.page}
        docId={documentId}
        onGoToPage={onGoToPage}
      />
    );
  }
  return (
    <Fragment key={`${sectionKey}.text.${idx}`}>
      {tok.value}
    </Fragment>
  );
})}
```

**Note:** Phase 10 chat uses `[Page N]` citation format (not `[p.N]`). The existing `parseCitations` function uses `/\[p\.(\d+)\]/g` regex (parse-citations.ts line 5). Chat responses from the system prompt use `[Page N]`. Either: adapt existing parseCitations with a second regex for `[Page N]` format, OR write a separate `parseChatCitations` in `src/lib/chat/`. Do NOT modify parse-citations.ts — it is used throughout Phase 7 explanation rendering with `[p.N]` format.

---

### `src/components/chat/StarterQuestions.tsx` (component, request-response)

**Analog:** `src/components/doc/score-card.tsx`

**Client component with section/header layout** (score-card.tsx lines 1-20):
```typescript
"use client";

import { cn } from "@/lib/utils";

export function ScoreCard(props: {
  documentId: string;
  score: ScoreResult;
  onGoToPage: (page: number) => void;
  className?: string;
}) {
  return (
    <section
      aria-label="AI Assessment"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-background p-4",
        className,
      )}
    >
```

**Pill/badge pattern** (score-card.tsx lines 49-51 — rounded-full bg-primary):
```typescript
<span className="rounded-full bg-primary px-2 py-1 text-primary-foreground text-xs font-semibold">
  {`[${dim.score}/10]`}
</span>
```

**Adapt for question pills:**
```typescript
{questions.map((q, i) => (
  <button
    key={i}
    type="button"
    onClick={() => onSelect(q)}
    className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground hover:bg-muted text-left"
  >
    {q}
  </button>
))}
```

---

### `src/components/chat/ChatCitationBadge.tsx` (component, transform)

**Analog:** `src/components/doc/citation-inline.tsx` (near-exact role match)

**Full component pattern** (citation-inline.tsx lines 1-57):
```typescript
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function CitationInline(props: {
  page: number;
  docId: string;
  onGoToPage: (page: number) => void;
}) {
  const { page, docId, onGoToPage } = props;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`View source for page ${page}`}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-full bg-primary px-1.5 py-0.5",
            "text-primary-foreground text-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "hover:shadow-sm",
          )}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => onGoToPage(page)}
        >
          {`[p.${page}]`}
        </span>
      </PopoverTrigger>
```

**For chat, change display text to `[Page ${page}]`** to match chat system prompt citation format. All other interaction patterns (hover/focus popover, keyboard handler) copy verbatim from CitationInline.

---

### `src/lib/chat/guardrail.ts` (utility, transform)

**Analog:** `src/lib/explain/score-prompts.ts` (exact match — `scanForInvestmentAdvice` is the direct predecessor)

**Blocked terms regex pattern** (score-prompts.ts lines 50-63):
```typescript
const BLOCKED_TERMS = /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight)\b/i;

/**
 * Pre-persist compliance guardrail (SCORE-05 / AI-SPEC §6).
 * Returns the matched blocked term (original casing) if present, otherwise null.
 */
export function scanForInvestmentAdvice(text: string): string | null {
  const m = BLOCKED_TERMS.exec(text);
  return m ? m[0] : null;
}
```

**Extend this exact pattern for chat guardrail** — return boolean instead of string (faster path check), add Bahasa Indonesia terms:
```typescript
// src/lib/chat/guardrail.ts
// Extends pattern from src/lib/explain/score-prompts.ts (scanForInvestmentAdvice)
const INVESTMENT_ADVICE_PATTERNS = /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight|price target|should i|worth buying|beli saham|jual saham|investasi|rekomendasikan|layak dibeli|saham bagus|apakah bagus|apakah sebaiknya)\b/i

export function isInvestmentAdviceQuery(text: string): boolean {
  return INVESTMENT_ADVICE_PATTERNS.test(text)
}
```

**No-server-only directive needed** — like score-prompts.ts, this is a pure function importable in Vitest tests.

---

### `src/lib/chat/prompts.ts` (utility, transform)

**Analog:** `src/lib/explain/explain-prompts.ts` (exact match — same role: prompt builder)

**Module header and const export pattern** (explain-prompts.ts lines 1-59):
```typescript
/**
 * Explanation prompt constants and builder for Phase 6 AI Explanation Generation.
 * No server-only import — pure strings/functions, importable in Vitest tests.
 */

export const EXPLANATION_MODEL_ID = "gemini-2.0-flash" as const;

export const PSAK_GLOSSARY = `...` as const;

export const EXPLAIN_SYSTEM_PROMPT = `...` as const;
```

**Builder function pattern** (explain-prompts.ts lines 70-86 — function takes params, returns string):
```typescript
export function buildExplanationPrompt(
  totalPages: number,
  isIndonesian: boolean,
): string {
  const glossaryBlock = isIndonesian
    ? `\n\nBAHASA INDONESIA VOCABULARY REFERENCE...\n${PSAK_GLOSSARY}`
    : "";

  return `${EXPLAIN_SYSTEM_PROMPT} The document has ${totalPages} total pages...${glossaryBlock}

Produce a JSON object with EXACTLY these five string keys...`;
}
```

**Adapt for chat — context-injecting function:**
```typescript
// src/lib/chat/prompts.ts
// No server-only import — pure strings, importable in Vitest tests (mirrors explain-prompts.ts)

export function CHAT_SYSTEM_PROMPT(context: string): string {
  return `You are a financial document assistant for Clarifin...

CONTEXT FROM THE DOCUMENT:
${context}

RULES (non-negotiable):
1. Answer ONLY from the context provided above...
7. This is not investment advice...`
}
```

**PSAK_GLOSSARY import** — do NOT copy the glossary; import it from `explain-prompts.ts`:
```typescript
import { PSAK_GLOSSARY } from '@/lib/explain/explain-prompts'
```

---

### `src/lib/chat/starter-questions-schema.ts` (utility, transform)

**Analog:** `src/lib/explain/score-schema.ts` (exact match — same role: Zod schema + type export)

**Schema module pattern** (score-schema.ts lines 1-24):
```typescript
import { z } from "zod";

const snippetSchema = z.object({
  text: z.string().min(1),
  page: z.number().int().positive(),
});

export const scoreSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  dimensions: z.array(dimensionSchema).length(4),
});

export type ScoreResult = z.infer<typeof scoreSchema>;
```

**Adapt for starter questions — simpler schema:**
```typescript
// src/lib/chat/starter-questions-schema.ts
import { z } from "zod";

export const StarterQuestionsSchema = z.object({
  questions: z.array(z.string().max(120)).length(5),
});

export type StarterQuestions = z.infer<typeof StarterQuestionsSchema>;
```

---

## Test File Patterns

### `src/lib/chat/guardrail.test.ts` (test, unit)

**Analog:** `src/lib/explain/__tests__/score-prompts.test.ts`

**Test structure pattern** (score-prompts.test.ts lines 1-72 — no mocks needed, pure function tests):
```typescript
import { describe, it, expect } from "vitest";
import { SCORE_MODEL_ID, buildScorePrompt, scanForInvestmentAdvice } from "../score-prompts";

describe("scanForInvestmentAdvice", () => {
  it("SCORE-05: blocks 'buy' (returns matched term)", () => {
    expect(scanForInvestmentAdvice("This stock is a buy.")).toBe("buy");
  });
  it("SCORE-05: respects word boundaries — 'buyer' does not match 'buy'", () => {
    expect(scanForInvestmentAdvice("the buyer of the company")).toBeNull();
  });
});
```

**Adapt for guardrail — test 10 phrase variants (EN + ID):**
```typescript
import { describe, it, expect } from "vitest";
import { isInvestmentAdviceQuery } from "../guardrail";

describe("isInvestmentAdviceQuery", () => {
  it("CHAT-06: blocks 'should I buy'", () => {
    expect(isInvestmentAdviceQuery("should I buy this stock?")).toBe(true);
  });
  it("CHAT-06: blocks 'beli saham' (Bahasa Indonesia)", () => {
    expect(isInvestmentAdviceQuery("apakah saya harus beli saham ini?")).toBe(true);
  });
  // ...7 more EN + ID variants...
  it("CHAT-06: passes neutral financial question", () => {
    expect(isInvestmentAdviceQuery("What was the net income in 2023?")).toBe(false);
  });
});
```

### `src/app/api/chat/route.test.ts` (test, unit)

**Analog:** `src/app/api/internal/analyze-batch/__tests__/route.test.ts`

**Hoisted mocks + route import pattern** (route.test.ts lines 1-25):
```typescript
import { describe, expect, it, vi } from "vitest";

const { runAnalyzeBatch, fromMock } = vi.hoisted(() => ({
  runAnalyzeBatch: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/ingest/analyze-document-batch", () => ({ runAnalyzeBatch }));
vi.mock("@/db/client", () => ({ supabaseAdmin: { from: fromMock } }));

import { GET, POST } from "../route";
```

**Adapt for chat route — mock streamText + matchDocumentChunks + guardrail:**
```typescript
const { streamTextMock, matchChunksMock, isInvestmentAdviceMock, insertMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  matchChunksMock: vi.fn(),
  isInvestmentAdviceMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@ai-sdk/google', () => ({ google: vi.fn(() => 'mock-model') }));
vi.mock('@/lib/rag/match-document-chunks', () => ({ matchDocumentChunks: matchChunksMock }));
vi.mock('@/lib/chat/guardrail', () => ({ isInvestmentAdviceQuery: isInvestmentAdviceMock }));
vi.mock('@/db/client', () => ({
  supabaseAdmin: { from: () => ({ insert: insertMock }) }
}));
```

**Request helper pattern** (route.test.ts lines 33-42):
```typescript
function makePost(body: unknown, authHeader?: string): Request {
  return new Request("http://localhost/api/internal/analyze-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}
```

---

## Shared Patterns

### `server-only` Guard
**Source:** `src/db/client.ts` line 1, `src/lib/rag/match-document-chunks.ts` line 1
**Apply to:** `src/app/api/chat/route.ts`, `src/app/api/starter-questions/route.ts`
```typescript
import 'server-only'
```
Any file that imports `supabaseAdmin`, `matchDocumentChunks`, or calls LLM APIs must have this at the top.

### Supabase Admin Pattern
**Source:** `src/db/client.ts` lines 1-22
**Apply to:** `src/app/api/chat/route.ts`, `src/app/api/starter-questions/route.ts`
```typescript
import { supabaseAdmin } from "@/db/client";
// supabaseAdmin is service-role, bypasses RLS
// server-only guard at build time prevents client import
```

### Zod safeParse + 400 Response Pattern
**Source:** `src/app/api/session/route.ts` lines 10-19
**Apply to:** `src/app/api/chat/route.ts`, `src/app/api/starter-questions/route.ts`
```typescript
const json: unknown = await request.json().catch(() => null);
const parsed = bodySchema.safeParse(json);
if (!parsed.success) {
  return NextResponse.json(
    { error: "Invalid request. ..." },
    { status: 400 },
  );
}
```

### Client Component `"use client"` + Named Export
**Source:** `src/components/doc/citation-inline.tsx` line 1, `src/components/doc/score-card.tsx` line 1
**Apply to:** All `src/components/chat/*.tsx` files
```typescript
"use client";
// Named export (not default) — consistent with all existing components
export function ComponentName(props: { ... }) { ... }
```

### cn() Utility + Tailwind Classes
**Source:** `src/components/doc/score-card.tsx` lines 1-9, 20-27
**Apply to:** All `src/components/chat/*.tsx` files
```typescript
import { cn } from "@/lib/utils";
// className composition:
className={cn(
  "flex flex-col gap-4 rounded-lg border border-border bg-background p-4",
  className,  // always accept optional className prop for layout overrides
)}
```

### Pure Function — No Server-Only Import
**Source:** `src/lib/explain/score-prompts.ts` lines 1-8, `src/lib/explain/explain-prompts.ts` lines 1-6
**Apply to:** `src/lib/chat/guardrail.ts`, `src/lib/chat/prompts.ts`, `src/lib/chat/starter-questions-schema.ts`
```typescript
/**
 * [description]. No server-only import — pure strings/functions, importable in Vitest tests.
 */
```
These lib/chat utility modules must NOT import `server-only` so they remain testable in Vitest node environment.

### Vitest Test — No Mocks for Pure Functions
**Source:** `src/lib/explain/__tests__/score-prompts.test.ts` lines 1-3 (no vi.mock calls)
**Apply to:** `src/lib/chat/guardrail.test.ts`, `src/lib/chat/prompts.test.ts`, `src/lib/chat/starter-questions-schema.test.ts`
```typescript
import { describe, it, expect } from "vitest";
// No vi.mock needed — pure functions only
import { isInvestmentAdviceQuery } from "../guardrail";
```

### Supabase Query Scoping (session_id + doc_id)
**Source:** `src/app/doc/[documentId]/page.tsx` lines 19-23 (always .eq on primary key)
**Apply to:** `src/app/api/chat/route.ts` chat_messages queries, `src/app/doc/[documentId]/page.tsx` session restore query
```typescript
// Always scope chat_messages by BOTH session_id AND doc_id
.eq('session_id', sessionId)
.eq('doc_id', documentId)
// Missing either filter causes cross-document/cross-session data leakage
```

---

## No Analog Found

All files have a codebase analog. However, these files require net-new patterns from RESEARCH.md (no existing codebase analog uses `streamText` or `useChat`):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/api/chat/route.ts` (streaming portion) | route | streaming | `streamText` + `toDataStreamResponse()` — no existing AI SDK streaming in codebase |
| `src/components/chat/ChatInterface.tsx` (useChat portion) | component | streaming | `useChat` hook from `ai/react` — no existing useChat usage in codebase |

For these, use RESEARCH.md Patterns 1 and 2 as the primary source. Pin `ai@4.3.19` — `useChat` import is `ai/react`, not `@ai-sdk/react`. `toDataStreamResponse()` is the v4 API, not `toUIMessageStreamResponse()`.

---

## Citation Format Discrepancy

**Critical implementation note for planner:**

- `src/lib/citations/parse-citations.ts` uses regex `/\[p\.(\d+)\]/g` — matches `[p.N]` format
- `src/lib/explain/explain-prompts.ts` instructs LLM to use `[p.N]` format
- `src/lib/chat/prompts.ts` (new) will instruct LLM to use `[Page N]` format (per RESEARCH.md Pattern for CHAT_SYSTEM_PROMPT)

These are incompatible. The planner must decide one of:
1. Change `CHAT_SYSTEM_PROMPT` to use `[p.N]` format and reuse `parseCitations` — preferred, lower code surface
2. Add a second regex `[Page N]` to `parseCitations` and export a second parser
3. Write a standalone `parseChatCitations` in `src/lib/chat/`

Option 1 minimizes new code and reuses the existing `CitationInline` component unchanged.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/components/doc/`, `src/components/`, `src/lib/explain/`, `src/lib/rag/`, `src/lib/citations/`, `src/db/`
**Files scanned:** 28
**Pattern extraction date:** 2026-05-20
