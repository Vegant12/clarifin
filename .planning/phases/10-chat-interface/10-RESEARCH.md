# Phase 10: Chat Interface - Research

**Researched:** 2026-05-20
**Domain:** Vercel AI SDK v4 streaming chat, pgvector RAG, Supabase session persistence, investment-advice guardrails
**Confidence:** HIGH (core stack verified against npm registry and Context7; codebase patterns verified by direct file reads)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | User can ask follow-up questions via chat interface | useChat hook + /api/chat route pattern — Section 3 |
| CHAT-02 | Chat answers grounded in retrieved chunks with page citations | matchDocumentChunks RPC already built (Phase 4) — Section 5 |
| CHAT-03 | Chat answers stream progressively (first token within 2s) | streamText + toDataStreamResponse — Section 3 |
| CHAT-04 | Session persists across page refresh (anonymous UUID, 7-day TTL) | chat_sessions + chat_messages tables already exist — Section 6 |
| CHAT-05 | 3–5 suggested questions at session start | generateObject with StarterQuestionsSchema — Section 8 |
| CHAT-06 | Buy/sell recommendation language hard-blocked | String match guardrail (pre-LLM) — Section 9 |
</phase_requirements>

---

## Summary

Phase 10 implements a RAG-grounded streaming chat on top of infrastructure that is almost entirely pre-built. The `match_document_chunks` RPC (Phase 4), `chat_sessions`/`chat_messages` tables (Phase 1 migration), `session-client.ts` with `getBrowserSessionToken` / `ensureBrowserSession` (Phase 2), and `embedQueryText` (Phase 4) are all already in the codebase and production-ready. The only net-new infrastructure is the `ai` package and its companion providers (`@ai-sdk/google`, `@ai-sdk/groq`), which are not yet installed.

**Version alignment is the most important planning decision in this phase.** The AI-SPEC mandates Vercel AI SDK v4 (`^4.0.0`). The npm `latest` tag resolves to v6, which has significant breaking API changes — `useChat` import moves to `@ai-sdk/react`, `toDataStreamResponse()` is replaced by `toUIMessageStreamResponse()`, `generateObject` is replaced by `generateText` + `Output.object()`, and `initialMessages` is renamed to `messages`. Plans MUST pin `ai@^4.3.19` (latest stable v4) and companions `@ai-sdk/google@^1.2.22` + `@ai-sdk/groq@^1.2.9`. These provider versions share the same `@ai-sdk/provider@1.1.3` internal shim as `ai@4.3.19` — they are compatible.

The existing codebase uses `@google/genai` for the Gemini Files API (explanation generation, scoring). That package and `@ai-sdk/google` are entirely separate packages with different purposes — `@google/genai` is Google's direct SDK for Files API and generative models, while `@ai-sdk/google` is the Vercel AI SDK provider adapter. They can and must coexist in the same project without conflict.

**Primary recommendation:** Pin `ai@4.3.19` + `@ai-sdk/google@1.2.22` + `@ai-sdk/groq@1.2.9`. Use v4 API patterns throughout: `import { useChat } from 'ai/react'`, `toDataStreamResponse()` server-side, `initialMessages` prop, `body: { documentId, sessionId }` on the useChat hook.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chat message display + input | Browser (Client Component) | — | `useChat` manages in-memory message state client-side |
| Session token identity | Browser (localStorage) | API / Backend | Token generated client-side; validated/upserted server-side |
| Query embedding | API / Backend | — | `embedQueryText` must run server-side — Gemini API key must never reach browser |
| pgvector chunk retrieval | API / Backend | Database / Storage | `match_document_chunks` RPC called from API route via `supabaseAdmin` |
| Streaming LLM call | API / Backend | — | `streamText` runs in Next.js API route handler |
| Message persistence | API / Backend | Database / Storage | `onFinish` callback writes assistant turn to `chat_messages` |
| Session restore (initialMessages) | Frontend Server (SSR) | Database / Storage | Server Component fetches prior messages before render; passed as `initialMessages` prop |
| Starter question generation | API / Backend | — | `generateObject` call runs server-side on document upload completion |
| Investment advice guardrail | API / Backend | — | String match before LLM call; also enforced in system prompt |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `4.3.19` | Core: `streamText`, `generateObject`, `useChat`, `toDataStreamResponse` | AI-SPEC mandated v4; latest stable v4 as of 2026-05-20 [VERIFIED: npm registry] |
| `@ai-sdk/google` | `1.2.22` | Vercel AI SDK adapter for Gemini 2.5 Flash — `google('gemini-2.5-flash')` | Compatible with ai@4.3.19 via shared `@ai-sdk/provider@1.1.3` [VERIFIED: npm registry] |
| `@ai-sdk/groq` | `1.2.9` | Vercel AI SDK adapter for Groq/Llama 3.3 70B fallback | Same provider shim version as @ai-sdk/google [VERIFIED: npm registry] |
| `@google/genai` | `^1.52.0` | Already installed — Gemini Files API for existing explanation/score generation | NOT used for chat; chat uses @ai-sdk/google [VERIFIED: package.json] |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^3.25.76` | Request validation (ChatRequestSchema), starter questions schema | All API route input validation |
| `@supabase/supabase-js` | `^2.105.1` | `chat_messages` insert, session restore query | All Supabase operations in chat route |

### Key Codebase Assets (Pre-Built — Do Not Rewrite)
| Asset | Location | What It Does |
|-------|----------|--------------|
| `matchDocumentChunks` | `src/lib/rag/match-document-chunks.ts` | Embeds query + calls `match_document_chunks` RPC — returns `MatchedChunkRow[]` with `page_number` |
| `embedQueryText` | `src/lib/embed/gemini-embed.ts` | Single-text embedding via `gemini-embedding-001`, returns `number[]` |
| `vectorToPgString` | `src/lib/embed/gemini-embed.ts` | Converts `number[]` to pgvector text format `[n1,n2,...]` |
| `supabaseAdmin` | `src/db/client.ts` | Service-role Supabase client; server-only |
| `getBrowserSessionToken` | `src/lib/session-client.ts` | Reads UUID from `localStorage` |
| `ensureBrowserSession` | `src/lib/session-client.ts` | Creates/verifies session row via `POST /api/session` |
| `scanForInvestmentAdvice` | `src/lib/explain/score-prompts.ts` | Regex blocking investment terms — EXTEND for Bahasa Indonesia, don't duplicate |
| `PSAK_GLOSSARY` | `src/lib/explain/explain-prompts.ts` | 30-term Bahasa Indonesia financial vocabulary — IMPORT into chat prompts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ai@4.3.19` | `ai@6.x` (latest) | v6 has breaking API changes — useChat import, toDataStreamResponse removed — AI-SPEC explicitly mandated v4 |
| `@ai-sdk/google` | `@google/genai` directly | @google/genai lacks streamText/useChat protocol adapter; would require manual ReadableStream piping |
| String-match guardrail (pre-LLM) | LLM-as-judge guardrail | String match is <1ms, deterministic, zero quota cost; LLM judge adds 250ms and uses rate-limited quota |

**Installation (net-new packages only):**
```bash
pnpm add ai@4.3.19 @ai-sdk/google@1.2.22 @ai-sdk/groq@1.2.9
```

**Version verification:** [VERIFIED: npm registry 2026-05-20]
- `ai@4.3.19` — latest stable v4 (npm dist-tag `ai-v5` resolves to 5.0.190; `latest` resolves to 6.0.185)
- `@ai-sdk/google@1.2.22` — latest v1.x, compatible with ai@4.x (shares `@ai-sdk/provider@1.1.3`)
- `@ai-sdk/groq@1.2.9` — latest v1.x, same provider shim compatibility

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  user submits question (text)
  ▼
useChat hook (ai/react)
  │  POST /api/chat
  │  body: { messages, documentId, sessionId }
  ▼
/api/chat  route.ts  (Next.js API Route)
  ├─── guardrail: isInvestmentAdviceQuery(lastMessage)
  │      └── if triggered → return pre-written deflection (no LLM call)
  │
  ├─── embedQueryText(lastMessage)     ← gemini-embedding-001 via @google/genai
  │
  ├─── matchDocumentChunks(docId, query, 5)  ← Supabase RPC
  │      └── chunks: [{ content, page_number }]
  │      └── if 0 chunks → return "document does not contain info"
  │
  ├─── streamText(                     ← Vercel AI SDK + @ai-sdk/google
  │      model: google('gemini-2.5-flash'),
  │      system: CHAT_SYSTEM_PROMPT(context),
  │      messages,
  │      maxTokens: 1500,
  │      temperature: 0.3,
  │      onFinish: async({ text }) => {
  │        // guardrail check on output
  │        // supabaseAdmin.insert chat_messages
  │      }
  │    )
  │
  └─── result.toDataStreamResponse()
         │  [Vercel AI data stream protocol]
         ▼
       useChat receives streaming chunks
         │  renders incrementally
         ▼
       ChatMessage components (with CitationBadge)

Server Component (doc/[documentId]/page.tsx or chat sub-route)
  │
  ├── supabaseAdmin.from('chat_messages').select()
  │     .eq('session_id', sessionId)
  │     .eq('doc_id', documentId)
  │     .order('created_at', ascending: true)
  │     .gte('created_at', sevenDaysAgo)
  │
  └── passes initialMessages[] to <ChatInterface>
```

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # POST: guardrail → embed → retrieve → streamText → persist
│   │   └── starter-questions/
│   │       └── route.ts          # POST: generateObject → return 5 questions
│   └── doc/
│       └── [documentId]/
│           └── page.tsx          # EXTEND existing RSC: fetch chat history, render ChatPanel
├── components/
│   └── chat/
│       ├── ChatPanel.tsx         # Container: StarterQuestions + ChatInterface
│       ├── ChatInterface.tsx     # useChat wrapper: messages list + input form
│       ├── ChatMessage.tsx       # Single message with citation parsing + CitationBadge
│       ├── StarterQuestions.tsx  # 3-5 clickable question pills
│       └── ChatCitationBadge.tsx # [Page N] pill (reuse CitationBadge from Phase 7 if compatible)
└── lib/
    └── chat/
        ├── guardrail.ts          # isInvestmentAdviceQuery(text): boolean
        ├── prompts.ts            # CHAT_SYSTEM_PROMPT(context): string
        └── starter-questions-schema.ts  # StarterQuestionsSchema (Zod)
```

### Pattern 1: Chat API Route (v4 canonical)
**What:** Server-side streaming with RAG retrieval and session persistence
**When to use:** The single POST handler for all chat messages

```typescript
// src/app/api/chat/route.ts
// Source: AI-SPEC.md §3 (verified against ai@4.3.19 API)
import 'server-only'
import { streamText, generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { matchDocumentChunks } from '@/lib/rag/match-document-chunks'
import { supabaseAdmin } from '@/db/client'
import { isInvestmentAdviceQuery } from '@/lib/chat/guardrail'
import { CHAT_SYSTEM_PROMPT } from '@/lib/chat/prompts'

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(20),
  documentId: z.string().uuid(),
  sessionId: z.string().uuid(),
})

export async function POST(req: Request) {
  const body = ChatRequestSchema.parse(await req.json())
  const { messages, documentId, sessionId } = body
  const lastMessage = messages.at(-1)!.content

  // 1. Pre-LLM guardrail
  if (isInvestmentAdviceQuery(lastMessage)) {
    const deflection = "I can help you understand this document, but I'm not able to give investment advice or buy/sell recommendations. What would you like to know about the company's financials?"
    await supabaseAdmin.from('chat_messages').insert([
      { session_id: sessionId, doc_id: documentId, role: 'user', content: lastMessage },
      { session_id: sessionId, doc_id: documentId, role: 'assistant', content: deflection },
    ])
    return new Response(JSON.stringify({ role: 'assistant', content: deflection }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Retrieve chunks
  const chunks = await matchDocumentChunks({ docId: documentId, query: lastMessage, matchCount: 5 })
  if (chunks.length === 0) {
    // Return empty-retrieval guard without calling LLM
    const noInfoMsg = "The document does not appear to contain information about this topic."
    await supabaseAdmin.from('chat_messages').insert([
      { session_id: sessionId, doc_id: documentId, role: 'user', content: lastMessage },
      { session_id: sessionId, doc_id: documentId, role: 'assistant', content: noInfoMsg },
    ])
    return new Response(JSON.stringify({ role: 'assistant', content: noInfoMsg }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Build context
  const context = chunks
    .map(c => `[Page ${c.page_number}]: ${c.content}`)
    .join('\n\n')

  // 4. Persist user message before streaming
  await supabaseAdmin.from('chat_messages').insert([
    { session_id: sessionId, doc_id: documentId, role: 'user', content: lastMessage },
  ])

  // 5. Stream response
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
}
```

### Pattern 2: Client useChat Hook (v4 canonical)
**What:** Client component using v4 `useChat` from `ai/react`
**When to use:** The React chat component

```typescript
// src/components/chat/ChatInterface.tsx
// Source: AI-SPEC.md §3 (verified against ai@4.3.19 — import is 'ai/react', NOT '@ai-sdk/react')
'use client'
import { useChat, type Message } from 'ai/react'

interface ChatInterfaceProps {
  documentId: string
  sessionId: string
  initialMessages: Message[]
}

export function ChatInterface({ documentId, sessionId, initialMessages }: ChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { documentId, sessionId },   // sent with every request
    initialMessages,                   // pre-loaded from Supabase for session restore
  })

  return (
    <div>
      {messages.map(m => <ChatMessage key={m.id} message={m} />)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Ask about this document..." />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  )
}
```

### Pattern 3: Session Restore in Server Component
**What:** Loading prior messages before first render to avoid flash of empty chat
**When to use:** Any Server Component that wraps ChatInterface

```typescript
// In the Server Component (doc/[documentId]/page.tsx or sub-route)
// Source: Codebase analysis — extends existing pattern in src/app/doc/[documentId]/page.tsx
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const chatRes = await supabaseAdmin
  .from('chat_messages')
  .select('id, role, content, created_at')
  .eq('session_id', sessionId)
  .eq('doc_id', documentId)
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: true })

// Convert to Message[] format for useChat initialMessages
const initialMessages: Message[] = (chatRes.data ?? []).map(row => ({
  id: row.id,
  role: row.role as 'user' | 'assistant',
  content: row.content,
}))
```

### Pattern 4: Starter Question Generation (v4 generateObject)
**What:** Structured output generation for document-specific suggested questions
**When to use:** Called once per document after ingestion completes; result cached in Supabase

```typescript
// src/app/api/starter-questions/route.ts
// Source: AI-SPEC.md §4b — generateObject is still available in ai@4.3.19
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

const StarterQuestionsSchema = z.object({
  questions: z.array(z.string().max(120)).length(5),
})

const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: StarterQuestionsSchema,
  prompt: `Given this financial document summary, generate 5 plain-English questions a non-finance investor would want to ask:\n\n${documentSummary}`,
})
// object.questions: string[] (5 items, typed)
```

> NOTE: `generateObject` is deprecated in AI SDK v5+ (replaced by `generateText` + `Output.object()`). In v4.3.19, `generateObject` is the correct API. [VERIFIED: Context7 — migration guide 5.0]

### Pattern 5: Groq Fallback
**What:** Rate-limit fallback to Groq/Llama when Gemini returns 429
**When to use:** Wrap `streamText` call in try/catch

```typescript
import { groq } from '@ai-sdk/groq'

async function streamWithFallback(options: StreamOptions) {
  try {
    return streamText({ model: google('gemini-2.5-flash'), ...options })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 429) {
      return streamText({ model: groq('llama-3.3-70b-versatile'), ...options })
    }
    throw err
  }
}
```

### Anti-Patterns to Avoid
- **Using `ai@latest` (v6):** `toDataStreamResponse()` is removed, `useChat` import changes, `generateObject` is removed. Pin to `ai@4.3.19`.
- **Calling `useChat` with import from `@ai-sdk/react`:** That import is only available in v5+. In v4, it's `import { useChat } from 'ai/react'`.
- **Using `toUIMessageStreamResponse()`:** This is a v5+ API. In v4, use `result.toDataStreamResponse()`.
- **Calling `embedQueryText` from a Client Component:** The Gemini API key would be exposed to the browser. Embedding must happen in the API route.
- **Persisting the user message AFTER the stream:** If streaming fails mid-way, you'd have no user message in the DB. Persist user message before calling `streamText`.
- **Not scoping `chat_messages` queries by both `session_id` AND `doc_id`:** A user may have multiple documents in their session; messages must be scoped to the current document.
- **Importing `supabaseAdmin` from a Client Component:** It contains the service role key. The `server-only` guard in `src/db/client.ts` will catch this at build time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming message display + state | Custom ReadableStream parser, message state reducer | `useChat` from `ai/react` | Handles streaming protocol, partial tokens, loading state, error state, abort |
| Investment advice string matching | Custom regex from scratch | Extend `scanForInvestmentAdvice` from `src/lib/explain/score-prompts.ts` | Already exists with BLOCKED_TERMS regex; add Bahasa Indonesia variants |
| Query embedding | Direct HTTP to Gemini embedding API | `matchDocumentChunks` from `src/lib/rag/match-document-chunks.ts` | Already embeds query + calls pgvector RPC in one function |
| Session token | Custom UUID generation + validation | `getBrowserSessionToken` / `ensureBrowserSession` from `src/lib/session-client.ts` | Already built and wired to `/api/session` |
| Citation parsing in responses | Custom regex for `[Page N]` | Extend `parseCitations` from Phase 7 if compatible (check `src/lib/citations/`) | Same citation format; reuse parser to extract page references from chat responses |

**Key insight:** The infrastructure layer for Phase 10 is largely pre-built. The primary net-new work is the `streamText` API route, the `useChat` client component, and the guardrail expansion for Bahasa Indonesia variants.

---

## Common Pitfalls

### Pitfall 1: Installing the wrong version of `ai`
**What goes wrong:** Running `pnpm add ai` installs v6 (current `latest`). The v4 API patterns in AI-SPEC.md (`useChat` from `ai/react`, `toDataStreamResponse`, `initialMessages`, `generateObject`) are either broken or removed in v6.
**Why it happens:** npm `latest` tag points to 6.0.185 as of 2026-05-20.
**How to avoid:** Always pin: `pnpm add ai@4.3.19 @ai-sdk/google@1.2.22 @ai-sdk/groq@1.2.9`.
**Warning signs:** TypeScript errors "Module '@ai-sdk/react' not found" or "toDataStreamResponse is not a function" — both indicate the wrong version.

### Pitfall 2: Confusing `@ai-sdk/google` with `@google/genai`
**What goes wrong:** Developer sees `@google/genai` already installed and thinks `@ai-sdk/google` is redundant. They try to pass a `@google/genai` model instance to `streamText` — TypeScript error.
**Why it happens:** Both wrap Gemini, but different SDKs with incompatible interfaces.
**How to avoid:** Keep both. `@google/genai` → Gemini Files API (explanation, scoring). `@ai-sdk/google` → Vercel AI SDK adapter for `streamText` chat calls. Never mix them.
**Warning signs:** TypeScript error on the `model:` parameter of `streamText`.

### Pitfall 3: Session restore flash (SSR timing)
**What goes wrong:** `initialMessages` loaded client-side causes a flash of empty chat before history appears.
**Why it happens:** Client-side fetch of chat history runs after hydration.
**How to avoid:** Load `chat_messages` in the Server Component (RSC) that wraps `ChatInterface`, pass as `initialMessages` prop. This ensures history is present on first render, no client-side fetch needed.
**Warning signs:** Chat history appears with a visible delay/flash after page load.

### Pitfall 4: Session ID not passed in `body`
**What goes wrong:** The API route can't scope the `chat_messages` query to the correct session. All user messages appear mixed across sessions.
**Why it happens:** `useChat` body is frequently forgotten when devs copy the basic `useChat` example.
**How to avoid:** Always include `body: { documentId, sessionId }` in the `useChat` config. The API route reads `body` fields alongside `messages` from the request.
**Warning signs:** Messages from other documents appear in chat history.

### Pitfall 5: Guardrail bypass via Bahasa Indonesia phrasings
**What goes wrong:** English keyword list blocks "should I buy" but misses "apakah sebaiknya beli" (should I buy), "rekomendasikan" (recommend), "layak dibeli" (worth buying).
**Why it happens:** The existing `scanForInvestmentAdvice` in `score-prompts.ts` is English-only.
**How to avoid:** Extend the guardrail in `lib/chat/guardrail.ts` with at minimum: `beli saham`, `jual saham`, `investasi`, `rekomendasikan`, `layak dibeli`, `saham bagus`, `apakah bagus`.
**Warning signs:** Guardrail eval test set (from AI-SPEC §5) shows failures on Indonesian phrasing variants.

### Pitfall 6: `chat_messages` missing `doc_id` on insert
**What goes wrong:** Messages are persisted with `session_id` but null `doc_id`. Session restore query filtering by `doc_id` returns 0 rows.
**Why it happens:** DB schema makes `doc_id` nullable (for forward compatibility); easy to omit.
**How to avoid:** Always include `doc_id: documentId` in every `chat_messages` insert.
**Warning signs:** Session restore always returns empty `initialMessages` despite chat history existing.

### Pitfall 7: Streaming response cut off at 60s Vercel Hobby limit
**What goes wrong:** Long Gemini responses (1500 tokens at ~150 tokens/sec = ~10s) are well within the 60s Hobby limit, but embed + retrieval + streaming together could approach limits if Gemini is slow.
**Why it happens:** Vercel Hobby has a 60-second max function duration. Gemini 2.5 Flash TTFT is ~1.5s, total generation ~10s.
**How to avoid:** Total estimated latency: embed (~200ms) + Supabase RPC (~50ms) + Gemini TTFT (~1500ms) + stream (~10s) = ~12s. Well within 60s, but monitor with Langfuse `generation.latency`. If Gemini is slow, the Groq fallback is ~2x faster for short responses.
**Warning signs:** Langfuse traces showing function execution > 30s consistently.

---

## Code Examples

### Guardrail (extend existing score-prompts pattern)
```typescript
// src/lib/chat/guardrail.ts
// Source: Codebase analysis — src/lib/explain/score-prompts.ts line 50 (scanForInvestmentAdvice pattern)

const INVESTMENT_ADVICE_PATTERNS = /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight|price target|should i|worth buying|beli saham|jual saham|investasi|rekomendasikan|layak dibeli|saham bagus|apakah bagus|apakah sebaiknya)\b/i

export function isInvestmentAdviceQuery(text: string): boolean {
  return INVESTMENT_ADVICE_PATTERNS.test(text)
}
```

### Chat System Prompt
```typescript
// src/lib/chat/prompts.ts
// Source: AI-SPEC.md §4b (prompt engineering discipline)

export function CHAT_SYSTEM_PROMPT(context: string): string {
  return `You are a financial document assistant for Clarifin. You help Indonesian retail investors understand IDX-listed company financial documents in plain English.

CONTEXT FROM THE DOCUMENT:
${context}

RULES (non-negotiable):
1. Answer ONLY from the context provided above. If the context does not contain information to answer the question, say "The document does not contain information about this topic."
2. Do NOT use your training knowledge to supplement context.
3. When citing a source, include [Page N] inline, where N is the page number from the context block.
4. Do NOT make buy, sell, or hold recommendations. Do not opine on whether the stock is attractive.
5. If asked for investment advice, say: "I can help you understand the document, but I'm not able to give investment advice."
6. Define all financial jargon inline for a non-finance audience.
7. This is not investment advice. Include a one-line disclaimer at the end of any response that discusses valuations, ratios, or performance.`
}
```

### 7-Day TTL Session Restore Query
```typescript
// Source: Codebase analysis — chat_sessions.last_active column + chat_messages.created_at
// TTL is application-enforced (filter), not DB-native

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

const { data } = await supabaseAdmin
  .from('chat_messages')
  .select('id, role, content, created_at')
  .eq('session_id', sessionId)
  .eq('doc_id', documentId)
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: true })
  .limit(40) // cap at 20 turns (40 messages) to avoid oversized initialMessages
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useChat` from `ai/react` | `useChat` from `@ai-sdk/react` (v5+) | AI SDK v5 (2025) | In v4, still use `ai/react`. Do NOT use `@ai-sdk/react` with v4. |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` (v5+) | AI SDK v5 (2025) | In v4, `toDataStreamResponse()` is correct. |
| `generateObject` | `generateText` + `Output.object()` (v5+) | AI SDK v5 (2025) | In v4, `generateObject` still works. |
| `initialMessages` prop | `messages` prop in useChat (v5+) | AI SDK v5 (2025) | In v4, `initialMessages` is correct. |

**Version landscape (2026-05-20):**
- `ai@4.x` (latest: 4.3.19) — stable, production API; mandated by AI-SPEC
- `ai@5.x` (latest: 5.0.190) — intermediate with breaking changes
- `ai@6.x` (latest: 6.0.185, npm `latest` tag) — current stable, further breaking changes
- `ai@7.x` (7.0.0-beta) — future; ignore

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `chat_sessions` 7-day TTL is enforced at query time via `created_at >= 7 days ago` filter, not a DB cron or pg policy | Schema Analysis | If the schema has a cron-based cleanup, the TTL filter in the restore query would be redundant but harmless |
| A2 | Starter questions should be cached in Supabase (generated once at upload completion, not per session open) | AI-SPEC §4 cost budget | If generation is very fast (<500ms), per-session generation is acceptable; but caching is the safer assumption for free-tier quota |
| A3 | The `parseCitations` function from Phase 7 (`src/lib/citations/`) uses the same `[p.N]` format as chat responses and can be reused | Phase 7 codebase — not yet examined in full | If Phase 7 used a different format, the chat needs its own citation parser |

---

## Open Questions (RESOLVED)

> All three open questions have been resolved by the Phase 10 plans. Resolution annotations inline below.

1. **Where should starter questions be stored/triggered?**

   > **RESOLVED (Plan 01 + Plan 03):** `starter_questions jsonb` column added to `document_analysis` via migration; populated lazily by `/api/starter-questions` route (cache-then-generate). RSC reads the cached value directly; on cache miss with explanation ready, RSC fires a server-to-server fetch to `/api/starter-questions` which generates and caches.

   - What we know: AI-SPEC §4 says "cache per document in Supabase (generate once at upload)". The `document_analysis` table doesn't have a `starter_questions` column yet.
   - What's unclear: Whether to add a `starter_questions jsonb` column to `document_analysis`, or create a separate `/api/starter-questions` route called on first session open.
   - Recommendation: Add `starter_questions jsonb` to `document_analysis` via a migration, populate it in the `analyze-document-batch` pipeline after explanation. The chat UI reads it from the existing analysis fetch on the document page.

2. **How does the Server Component know the `session_id` for chat restore?**

   > **RESOLVED (Plan 05):** `session_id` is passed as a `?sessionId={uuid}` URL search parameter. On first visit, `DocumentProgressView` (client component) reads the localStorage `session_token`, calls `/api/session` to obtain the `session_id`, then `router.replace`s the URL to append `?sessionId=`. Subsequent refreshes preserve the param and trigger the RSC chat_messages query.
   - What we know: `session_token` is in `localStorage` (client-only). The Server Component at `doc/[documentId]/page.tsx` runs server-side.
   - What's unclear: How the RSC gets the session ID to load `chat_messages`. There's no auth cookie mechanism.
   - Recommendation: Pass `sessionId` as a URL query parameter from the client (after `ensureBrowserSession`), or use a cookie set on `/api/session`. The existing `/api/session` returns `session_id` — the client can redirect to `?sessionId=xxx` after ensuring session. Alternatively, move chat to a nested client boundary where `initialMessages` is fetched client-side (adds 1 roundtrip but avoids session ID leakage via URL).

3. **Does the existing `doc/[documentId]/page.tsx` need to be split for chat routing?**

   > **RESOLVED (Plan 05):** Existing `doc/[documentId]/page.tsx` RSC is extended with additional Supabase fetches for `initialMessages` (via `loadInitialMessages` helper in `src/lib/chat/session-restore.ts`) and `starter_questions` (via `document_analysis` jsonb column or `/api/starter-questions` loopback). No split needed — one query overhead per page render.
   - What we know: Current page fetches explanation, score, PDF URL, stock data in one RSC. Adding chat history fetch adds another DB query.
   - What's unclear: Whether to add chat directly to the existing page or create a nested route/component.
   - Recommendation: Keep one page, add the chat history fetch alongside the existing queries. The overhead is one small Supabase query.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ai@4.3.19` | Core streaming SDK | ✗ not installed | — | None — must install |
| `@ai-sdk/google@1.2.22` | Gemini adapter for streamText | ✗ not installed | — | None — must install |
| `@ai-sdk/groq@1.2.9` | Groq fallback | ✗ not installed | — | Can skip initially, add for rate-limit resilience |
| `@google/genai@1.52.0` | embedQueryText (existing) | ✓ installed | 1.52.0 | — |
| `@supabase/supabase-js@2.105.1` | Chat persistence | ✓ installed | 2.105.1 | — |
| `zod@3.25.76` | Request validation | ✓ installed | 3.25.76 | — |
| Supabase `chat_messages` table | Message persistence | ✓ in schema | Phase 1 migration | — |
| Supabase `chat_sessions` table | Session identity | ✓ in schema | Phase 1 migration | — |
| `match_document_chunks` RPC | Chunk retrieval | ✓ in schema | Phase 4 migration | — |
| GROQ_API_KEY env var | Groq fallback | ✗ not yet set | — | Skip fallback until set |

**Missing dependencies with no fallback:**
- `ai@4.3.19`, `@ai-sdk/google@1.2.22` — must install in Wave 0 plan

**Missing dependencies with fallback:**
- `@ai-sdk/groq@1.2.9` + `GROQ_API_KEY` — Groq fallback can be stubbed initially; Gemini-only works for dev

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (present) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |
| Environment | `node` default; `jsdom` for `src/components/**/*.test.tsx` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Chat API route accepts valid request, returns stream | Unit (route handler) | `pnpm test src/app/api/chat/route.test.ts` | ❌ Wave 0 |
| CHAT-02 | `matchDocumentChunks` results appear as `[Page N]` citations in response | Unit (prompt builder) | `pnpm test src/lib/chat/prompts.test.ts` | ❌ Wave 0 |
| CHAT-03 | TTFT < 2000ms at p50 | Manual / Playwright E2E | `pnpm test:e2e:chat` (Playwright, not yet installed) | ❌ Wave 0 |
| CHAT-04 | After simulated page refresh, `initialMessages` contains prior messages | Unit (session restore query) | `pnpm test src/lib/chat/session-restore.test.ts` | ❌ Wave 0 |
| CHAT-05 | `generateObject` returns array of 5 strings, all ≤120 chars | Unit (schema validation) | `pnpm test src/lib/chat/starter-questions-schema.test.ts` | ❌ Wave 0 |
| CHAT-06 | `isInvestmentAdviceQuery` returns true for 10 guardrail phrases (EN + ID) | Unit (guardrail) | `pnpm test src/lib/chat/guardrail.test.ts` | ❌ Wave 0 |
| CHAT-06 | Guardrail triggers before LLM call (no LLM called when guardrail fires) | Unit (route handler mock) | `pnpm test src/app/api/chat/route.test.ts` (mock Gemini) | ❌ Wave 0 |

### TTFT Measurement Approach
The AI-SPEC mandates TTFT < 2000ms at p50. Measurement approach for Phase 10:

1. **Unit-level timing (Vitest):** In the route handler test, mock `matchDocumentChunks` and `streamText` to return instantly. Measure the time from request receipt to first `write()` to the response stream. This tests routing/validation overhead only (should be <10ms).

2. **Integration timing (manual):** During human UAT, use browser DevTools Network tab → select the `/api/chat` request → check "Time to first byte" (TTFB). Target < 2000ms. Record in the VALIDATION.md for the phase.

3. **Langfuse `generation.latency`:** After Langfuse is wired in Phase 11, production TTFT is monitored automatically. For Phase 10, log the embed + retrieval time manually using `console.time` in dev, remove before merge.

**Playwright E2E for TTFT** (from AI-SPEC §5): `pnpm test:e2e:chat` is specified in the AI-SPEC but Playwright is not yet installed. Add Playwright as a dev dependency in Wave 0 if the plan includes E2E tests, OR defer TTFT Playwright testing to Phase 11 (Observability) when Langfuse provides production data.

### Reference Dataset Approach (AI-SPEC §5)
The AI-SPEC specifies a 20-example faithfulness eval dataset. For Phase 10 planning purposes:

- **20 examples in `eval/chat-reference/`**: JSON files with `{question, expected_chunks, expected_answer_keywords, should_deflect}` fields
- **Composition:** 5 factual, 4 multi-page synthesis, 4 edge cases, 4 investment-advice deflection, 3 citation-accuracy
- **Automated subset:** Guardrail tests (4 deflection cases) can run in Vitest — assert `isInvestmentAdviceQuery` returns true for each. Assert the API route returns the deflection string without calling `streamText`.
- **Manual subset:** Context faithfulness and citation accuracy require human review against a known IDX annual report (e.g., BBCA from the Phase 5 eval corpus).
- **RAGAS:** The AI-SPEC specifies a `python scripts/eval/faithfulness.py` script. This is a Python script outside the Node.js bundle — it runs manually, not in `pnpm test`. Do not include it in Wave 0 Vitest gaps; it belongs in the Phase 11 observability plan.

### Sampling Rate
- **Per task commit:** `pnpm test src/lib/chat/ src/app/api/chat/` (guardrail + schema unit tests)
- **Per wave merge:** `pnpm test` (full Vitest suite)
- **Phase gate:** Full suite green + guardrail 10/10 pass rate + manual TTFT < 2000ms measured during human verify

### Wave 0 Gaps
- [ ] `src/lib/chat/guardrail.test.ts` — covers CHAT-06 (10 EN + ID phrase variants)
- [ ] `src/lib/chat/prompts.test.ts` — covers CHAT-02 (system prompt contains context, citation instruction, no-advice clause)
- [ ] `src/lib/chat/starter-questions-schema.test.ts` — covers CHAT-05 (schema validates 5-item array)
- [ ] `src/app/api/chat/route.test.ts` — covers CHAT-01, CHAT-06 route behavior (mocked Gemini, mocked matchDocumentChunks)
- [ ] Package install: `pnpm add ai@4.3.19 @ai-sdk/google@1.2.22 @ai-sdk/groq@1.2.9`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in v1; session is anonymous UUID |
| V3 Session Management | Yes | UUID in localStorage + server-side lookup; 7-day TTL via query filter |
| V4 Access Control | Yes | API route validates `documentId` is real and `sessionId` is real before querying; `supabaseAdmin` scoped to session |
| V5 Input Validation | Yes | `ChatRequestSchema` (Zod) — message content max 4000 chars, max 20 messages, UUIDs validated |
| V6 Cryptography | No | No secrets stored; Gemini/Groq keys server-side only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via user message | Tampering | System prompt owns grounding constraint; retrieved chunks not trusted as instructions |
| Investment advice bypass | Elevation of Privilege | Pre-LLM string match + system prompt instruction (defense in depth) |
| Session impersonation | Spoofing | Any UUID works (no auth v1); acceptable by design — session tokens are not secrets |
| Cross-document data leakage | Disclosure | `chat_messages` queries always include `doc_id` filter; chunks always scoped to `docId` |
| API key exposure | Disclosure | `@google/genai` and `@ai-sdk/google` calls are server-only; `server-only` import guard on `supabaseAdmin` |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry 2026-05-20] — `ai@4.3.19` is latest stable v4; `latest` tag = 6.0.185
- [VERIFIED: npm registry 2026-05-20] — `@ai-sdk/google@1.2.22` and `@ai-sdk/groq@1.2.9` share `@ai-sdk/provider@1.1.3` with `ai@4.3.19` — confirmed compatible
- [VERIFIED: codebase `src/lib/rag/match-document-chunks.ts`] — RPC exists, takes `docId, query, matchCount`, returns `MatchedChunkRow[]`
- [VERIFIED: codebase `src/db/database.types.ts`] — `chat_messages` schema: `id, session_id, doc_id, role, content, citations, created_at`
- [VERIFIED: codebase `src/lib/session-client.ts`] — `getBrowserSessionToken`, `ensureBrowserSession` already built
- [VERIFIED: codebase `supabase/migrations/20260503000000_init.sql`] — `chat_sessions` has `last_active` but NO DB-native TTL; TTL is query-time filter
- [CITED: Context7 /vercel/ai migration-guide-5-0] — v4 uses `initialMessages`; v5 renames to `messages`
- [CITED: Context7 /vercel/ai common-errors] — `toDataStreamResponse()` deprecated for v5+; `toUIMessageStreamResponse()` is v5+
- [CITED: Context7 /vercel/ai common-errors] — `generateObject` deprecated in v5+

### Secondary (MEDIUM confidence)
- [CITED: AI-SPEC.md §3] — Framework patterns, model configuration, context window budget
- [CITED: AI-SPEC.md §5] — Evaluation dimensions and reference dataset composition

### Tertiary (LOW confidence)
- [ASSUMED: A1] — 7-day TTL is query-time enforced, no DB cron found (verified by schema inspection but no explicit TTL constraint visible)

---

## Metadata

**Confidence breakdown:**
- Standard stack (package versions, compatibility): HIGH — verified against npm registry
- Architecture patterns (v4 API usage): HIGH — verified against Context7 docs + codebase
- Pre-built assets: HIGH — verified by direct file reads
- Pitfalls: HIGH — v4/v5/v6 API differences verified; codebase patterns verified
- Guardrail expansion (Bahasa Indonesia terms): MEDIUM — terms verified against AI-SPEC domain research; may need native speaker review

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (30 days — Vercel AI SDK releases frequently; re-verify npm versions if planning takes >1 week)
