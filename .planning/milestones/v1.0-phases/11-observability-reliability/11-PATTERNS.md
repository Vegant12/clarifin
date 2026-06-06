# Phase 11: Observability & Reliability - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 10
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/langfuse.ts` | utility (singleton client) | request-response | `src/db/client.ts` | exact |
| `src/lib/env.ts` | config | — | `src/lib/env.ts` (self — modify) | self-modify |
| `src/lib/explain/generate-explanation.ts` | service | streaming + batch | `src/lib/explain/generate-score.ts` | exact |
| `src/lib/explain/generate-score.ts` | service | streaming + batch | `src/lib/explain/generate-explanation.ts` | exact |
| `src/app/api/chat/route.ts` | controller | streaming | `src/app/api/starter-questions/route.ts` | role-match |
| `src/app/api/starter-questions/route.ts` | controller | request-response | `src/app/api/chat/route.ts` | role-match |
| `src/lib/ingest/embed-document-batch.ts` | service | batch | `src/lib/ingest/analyze-document-batch.ts` | exact |
| `src/app/api/cron/keep-alive/route.ts` | controller | request-response | `src/app/api/session/route.ts` | role-match |
| `vercel.json` | config | — | `vercel.json` (self — modify) | self-modify |
| `src/lib/ingest/analyze-document-batch.ts` | service | batch | `src/lib/ingest/embed-document-batch.ts` | exact (concurrency cap integration point) |

---

## Pattern Assignments

### `src/lib/langfuse.ts` (utility, singleton)

**Analog:** `src/db/client.ts`

**Imports + structure pattern** (`src/db/client.ts` lines 1-22):
```typescript
import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS (D-12: RLS is disabled in v1; access
 * control is enforced at API route boundaries via session_token filtering).
 *
 * The `import "server-only"` directive at the top of this module causes a
 * build error if any client component imports this file — Next.js's primary
 * defense against accidental service-role-key leaks to the browser.
 */
export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
```

**Pattern to copy:** `src/lib/langfuse.ts` follows identical shape — `import "server-only"`, named import from package, `env` import from `@/lib/env`, single named const export. Replace `createClient` with `new Langfuse(...)`, replace env keys with `LANGFUSE_SECRET_KEY`/`LANGFUSE_PUBLIC_KEY`. No options object beyond credentials; Langfuse defaults (`baseUrl: https://cloud.langfuse.com`) are correct for cloud deployment.

---

### `src/lib/env.ts` (config — modify)

**Analog:** `src/lib/env.ts` (self-modify)

**Existing server schema block pattern** (`src/lib/env.ts` lines 16-31):
```typescript
export const env = createEnv({
  server: {
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    GEMINI_API_KEY: z.string().min(20),
    INTERNAL_PARSE_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    STUB_PIPELINE_TICK: z.string().optional(),
    CLARIFIN_APP_URL: z.string().url().optional(),
  },
  // ...
```

**Existing `runtimeEnv` block pattern** (`src/lib/env.ts` lines 41-51):
```typescript
  runtimeEnv: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    INTERNAL_PARSE_SECRET: process.env.INTERNAL_PARSE_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    // ...
  },
```

**Pattern to add:** Three new entries in `server:` schema — `LANGFUSE_SECRET_KEY: z.string().min(20)`, `LANGFUSE_PUBLIC_KEY: z.string().min(20)`, `LANGFUSE_HOST: z.string().url().optional()`. Mirror each in `runtimeEnv:` with `process.env.LANGFUSE_*`. Use `.optional()` for `LANGFUSE_HOST` so dev without self-hosted Langfuse still starts.

---

### `src/lib/explain/generate-explanation.ts` (service — modify, Pattern A)

**Analog:** `src/lib/explain/generate-score.ts` (mirrors same structure exactly)

**Current imports block** (`src/lib/explain/generate-explanation.ts` lines 1-16):
```typescript
import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { clonePdfBytes } from "@/lib/pdf/clone-pdf-bytes";
import {
  EXPLANATION_RESPONSE_SCHEMA,
  explanationSchema,
  type ExplanationResult,
} from "@/lib/explain/explanation-schema";
import {
  EXPLANATION_MODEL_ID,
  buildExplanationPrompt,
} from "@/lib/explain/explain-prompts";
```

**Add to imports:**
```typescript
import { langfuse } from "@/lib/langfuse";
```

**Current stream + accumulate core pattern** (`src/lib/explain/generate-explanation.ts` lines 172-199):
```typescript
  const stream = await ai.models.generateContentStream({
    model: EXPLANATION_MODEL_ID,
    contents: [createPartFromUri(uri, mimeType), { text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseSchema: EXPLANATION_RESPONSE_SCHEMA,
    },
  });

  // Accumulate chunks — each chunk is partial JSON; do NOT JSON.parse per chunk (Pitfall 1)
  let accumulated = "";
  for await (const chunk of stream) {
    accumulated += (chunk as { text?: string }).text ?? "";
  }

  if (!accumulated) {
    throw new Error("Empty Gemini response (no chunks accumulated).");
  }

  const stripped = accumulated
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(stripped) as unknown;
  const result = explanationSchema.parse(parsed);

  return { result, fileResourceName: resourceName };
```

**Langfuse Pattern A instrumentation to wrap around this block** (AI-SPEC §4, Pattern A):
```typescript
export async function generateExplanation(
  params: GenerateExplanationParams,
): Promise<GenerateExplanationResult> {
  // ... existing file resolution logic (lines 138-168 unchanged) ...

  const isIndonesian = isIndonesianDoc(params.extractionSource, params.firstPageText);
  const prompt = buildExplanationPrompt(params.totalPages, isIndonesian);

  // --- LANGFUSE: open trace + generation BEFORE LLM call ---
  const trace = langfuse.trace({
    name: "explanation",
    metadata: {
      doc_id: params.docId,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      step: "explanation",
    },
  });
  const generation = trace.generation({
    name: "gemini-explanation",
    model: EXPLANATION_MODEL_ID,
    // DO NOT log pdfBytes — only the prompt text and metadata (AI-SPEC pitfall 5)
    input: { prompt, docId: params.docId, isIndonesian, totalPages: params.totalPages },
    modelParameters: { responseMimeType: "application/json" },
    metadata: { doc_id: params.docId, step: "explanation", gemini_file_uri: uri },
  });

  try {
    const stream = await ai.models.generateContentStream({ /* unchanged */ });
    let accumulated = "";
    let lastChunk: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } | undefined;
    for await (const chunk of stream) {
      accumulated += (chunk as { text?: string }).text ?? "";
      lastChunk = chunk as typeof lastChunk;
    }

    if (!accumulated) throw new Error("Empty Gemini response (no chunks accumulated).");

    const stripped = accumulated.trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(stripped) as unknown;
    const result = explanationSchema.parse(parsed);

    // --- LANGFUSE: close generation with output + usage ---
    generation.end({
      output: result,
      usageDetails: {
        input: lastChunk?.usageMetadata?.promptTokenCount ?? 0,
        output: lastChunk?.usageMetadata?.candidatesTokenCount ?? 0,
      },
    });
    trace.update({ output: { status: "success", sections: Object.keys(result) } });

    return { result, fileResourceName: resourceName };
  } catch (err) {
    // --- LANGFUSE: always close generation on error path (AI-SPEC pitfall 4) ---
    generation.end({
      output: { error: String(err) },
      level: "ERROR",
      statusMessage: String(err),
    });
    trace.update({ output: { error: String(err) } });
    throw err;
  } finally {
    // --- LANGFUSE: mandatory flush before serverless function exits (AI-SPEC pitfall 1) ---
    await langfuse.flushAsync();
  }
}
```

**Existing test file analog for mock pattern** (`src/lib/explain/__tests__/generate-explanation.test.ts` lines 1-35):
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentStream, filesGet, filesUpload, createPartFromUri } = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
  filesGet: vi.fn(),
  filesUpload: vi.fn(),
  createPartFromUri: vi.fn((uri: string, mime: string) => ({
    fileData: { fileUri: uri, mimeType: mime },
  })),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    files: { get: filesGet, upload: filesUpload },
    models: { generateContentStream },
  })),
  createPartFromUri,
}));

vi.mock("@/lib/env", () => ({
  env: { GEMINI_API_KEY: "test-key" },
}));

vi.mock("server-only", () => ({}));
```

**Add to test mocks for Langfuse:**
```typescript
const { flushAsync, traceEnd, generationEnd } = vi.hoisted(() => ({
  flushAsync: vi.fn().mockResolvedValue(undefined),
  traceEnd: vi.fn().mockReturnThis(),
  generationEnd: vi.fn().mockReturnThis(),
}));

vi.mock("@/lib/langfuse", () => ({
  langfuse: {
    trace: vi.fn().mockReturnValue({
      generation: vi.fn().mockReturnValue({ end: generationEnd }),
      update: vi.fn(),
    }),
    flushAsync,
  },
}));
```

---

### `src/lib/explain/generate-score.ts` (service — modify, Pattern A)

**Analog:** `src/lib/explain/generate-explanation.ts` (exact same structure — Pattern A)

**Current imports block** (`src/lib/explain/generate-score.ts` lines 1-16):
```typescript
import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { isIndonesianDoc, uploadFresh, waitForFileReady } from "@/lib/explain/generate-explanation";
import { SCORE_RESPONSE_SCHEMA, scoreSchema, type ScoreResult } from "@/lib/explain/score-schema";
import { SCORE_MODEL_ID, buildScorePrompt, scanForInvestmentAdvice } from "@/lib/explain/score-prompts";
```

**Current stream core pattern** (`src/lib/explain/generate-score.ts` lines 69-112):
```typescript
  const stream = await ai.models.generateContentStream({
    model: SCORE_MODEL_ID,
    contents: [createPartFromUri(uri, mimeType), { text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCORE_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let accumulated = "";
  for await (const chunk of stream) {
    accumulated += (chunk as { text?: string }).text ?? "";
  }

  if (!accumulated) { throw new Error("Empty Gemini score response."); }

  const stripped = accumulated.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(stripped) as unknown;
  const result = scoreSchema.parse(parsed);

  // 5. Compliance guardrail scan...
  for (const dim of result.dimensions) { /* ... */ }

  return { result, fileResourceName: resourceName };
```

**Langfuse Pattern A** — identical shape as generate-explanation.ts. Key differences:
- `trace.name: "score"` instead of `"explanation"`
- `generation.name: "gemini-score"`, `model: SCORE_MODEL_ID`
- `modelParameters: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }`
- `trace.update({ output: { status: "success", overall_score: result.overall_score } })`
- `finally { await langfuse.flushAsync(); }` — mandatory, same as explanation

---

### `src/app/api/chat/route.ts` (controller, streaming — modify, Pattern B)

**Analog:** `src/app/api/starter-questions/route.ts`

**Current imports block** (`src/app/api/chat/route.ts` lines 1-30):
```typescript
import "server-only";

import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { isInvestmentAdviceQuery } from "@/lib/guardrail";
import {
  CHAT_DEFLECTION_MESSAGE,
  CHAT_EMPTY_RETRIEVAL_MESSAGE,
  CHAT_MODEL_ID,
  CHAT_SYSTEM_PROMPT,
} from "@/lib/prompts";
import { matchDocumentChunks } from "@/lib/rag/match-document-chunks";
```

**Current `onFinish` callback** (`src/app/api/chat/route.ts` lines 133-152):
```typescript
  const result = streamText({
    model: google(CHAT_MODEL_ID),
    system: CHAT_SYSTEM_PROMPT(context),
    messages,
    maxTokens: 1500,
    temperature: 0.3,
    onFinish: async ({ text }) => {
      try {
        await persistMessages(sessionId, documentId, [
          { role: "assistant", content: text },
        ]);
      } catch {
        // Persistence failure inside onFinish must not crash the stream;
        // the stream has already been delivered to the client at this point.
        // Plan 11 (Observability) will surface this as a Langfuse error span.
      }
    },
  });

  return result.toDataStreamResponse();
```

**Langfuse Pattern B to insert before `streamText` and inside `onFinish`** (AI-SPEC §4, Pattern B):
```typescript
  // --- LANGFUSE: open trace + generation BEFORE streamText (records startTime correctly) ---
  const trace = langfuse.trace({
    name: "chat",
    metadata: {
      doc_id: documentId,
      session_id: sessionId,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    },
  });
  const generation = trace.generation({
    name: "gemini-chat",
    model: CHAT_MODEL_ID,
    input: messages,
    modelParameters: { maxTokens: 1500, temperature: 0.3 },
    metadata: { doc_id: documentId, step: "chat", chunks_retrieved: chunks.length },
  });

  const result = streamText({
    model: google(CHAT_MODEL_ID),
    system: CHAT_SYSTEM_PROMPT(context),
    messages,
    maxTokens: 1500,
    temperature: 0.3,
    onFinish: async ({ text, usage }) => {
      // --- LANGFUSE: close inside onFinish — flush here before function tears down ---
      generation.end({
        output: text,
        usageDetails: {
          input: usage?.promptTokens ?? 0,
          output: usage?.completionTokens ?? 0,
        },
      });
      await langfuse.flushAsync();  // CRITICAL: flush inside onFinish, not after return

      try {
        await persistMessages(sessionId, documentId, [
          { role: "assistant", content: text },
        ]);
      } catch {
        // unchanged
      }
    },
  });

  return result.toDataStreamResponse();
```

**Existing test mock pattern** (`src/app/api/chat/__tests__/route.test.ts` lines 1-35) — Langfuse mock to add:
```typescript
vi.mock("@/lib/langfuse", () => ({
  langfuse: {
    trace: vi.fn().mockReturnValue({
      generation: vi.fn().mockReturnValue({ end: vi.fn() }),
      update: vi.fn(),
    }),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  },
}));
```

---

### `src/app/api/starter-questions/route.ts` (controller, request-response — modify, Pattern B variant)

**Analog:** `src/app/api/chat/route.ts`

**Current `generateObject` call** (`src/app/api/starter-questions/route.ts` lines 100-119):
```typescript
  // 3. Generate.
  const { object } = await generateObject({
    model: google(CHAT_MODEL_ID),
    schema: StarterQuestionsSchema,
    prompt: `Given this plain-English summary...`,
  });

  // 4. Persist cache — best-effort; do not fail the response on write error.
  try {
    await supabaseAdmin
      .from("document_analysis")
      .update({ starter_questions: object.questions })
      .eq("doc_id", documentId);
  } catch {
    // Plan 11 will trace this via Langfuse.
  }

  return NextResponse.json({ questions: object.questions });
```

**Langfuse Pattern B variant** — non-streaming, try/finally (AI-SPEC §4, Pattern B variant):
```typescript
  const trace = langfuse.trace({
    name: "starter-questions",
    metadata: { doc_id: documentId, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
  });
  const generation = trace.generation({
    name: "gemini-starter-questions",
    model: CHAT_MODEL_ID,
    input: { summary },
    modelParameters: { maxTokens: 512, maxRetries: 2 },
    metadata: { doc_id: documentId, step: "starter-questions" },
  });

  try {
    const { object, usage } = await generateObject({
      model: google(CHAT_MODEL_ID),
      schema: StarterQuestionsSchema,
      prompt: `...`,
      maxTokens: 512,
      maxRetries: 2,
    });

    generation.end({
      output: object,
      usageDetails: { input: usage?.promptTokens ?? 0, output: usage?.completionTokens ?? 0 },
    });
    trace.update({ output: { status: "success" } });

    // existing cache persist (unchanged)
    try {
      await supabaseAdmin.from("document_analysis")
        .update({ starter_questions: object.questions }).eq("doc_id", documentId);
    } catch { /* best-effort */ }

    return NextResponse.json({ questions: object.questions });
  } catch (err) {
    generation.end({ output: { error: String(err) }, level: "ERROR" });
    throw err;
  } finally {
    await langfuse.flushAsync();  // try/finally — not after return (AI-SPEC pitfall 1)
  }
```

**Note:** The `usage` destructured from `generateObject` requires updating the existing destructure from `const { object }` to `const { object, usage }`.

---

### `src/lib/ingest/embed-document-batch.ts` (service, batch — modify, PDF cleanup INFRA-04)

**Analog:** `src/app/api/upload-complete/route.ts`

**Existing PDF removal call pattern** (`src/app/api/upload-complete/route.ts` lines 68-72):
```typescript
      await supabaseAdmin.storage
        .from("pdfs")
        .remove([docRes.data.storage_path])
        .catch(() => {});
```

**Current success path where cleanup slots in** (`src/lib/ingest/embed-document-batch.ts` lines 78-82):
```typescript
      const remaining = await countNullEmbeddings(docId);
      if (remaining === 0) {
        await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", docId);
        scheduleAnalyzeBatchForDoc(docId);
        return { done: true };
      }
```

**And lines 125-131:**
```typescript
    const afterCount = await countNullEmbeddings(docId);
    if (afterCount === 0) {
      await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", docId);
      scheduleAnalyzeBatchForDoc(docId);
      return { done: true };
    }
```

**Pattern to insert** at BOTH `remaining === 0` and `afterCount === 0` success-exit points, between status update and `return { done: true }`. The `storage_path` must be fetched from the doc row — the existing `docRes` query at line 47 already selects `id, status` but must be extended to include `storage_path`:

```typescript
// Fetch storage_path alongside existing doc fields (add to docRes select at top of function):
const docRes = await supabaseAdmin
  .from("documents")
  .select("id, status, storage_path")   // add storage_path
  .eq("id", docId)
  .maybeSingle();
```

```typescript
// PDF cleanup — INFRA-04. Only on confirmed success (remaining === 0).
// On partial failure: skip cleanup so raw PDF is preserved for reprocessing.
if (docRes.data?.storage_path) {
  await supabaseAdmin.storage
    .from("pdfs")
    .remove([docRes.data.storage_path])
    .catch(() => {
      // best-effort: log but do not fail the pipeline if cleanup fails
      console.warn(`[embed-batch] PDF cleanup failed for doc ${docId}`);
    });
}
```

**Test spy pattern** (from `src/app/api/internal/embed-batch/embed-batch.test.ts` mock style):
```typescript
const { removeMock } = vi.hoisted(() => ({
  removeMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    storage: {
      from: vi.fn().mockReturnValue({ remove: removeMock }),
    },
  },
}));
// Assert: removeMock called once on success; NOT called when embedding fails
```

---

### `src/app/api/cron/keep-alive/route.ts` (NEW controller, request-response)

**Analog:** `src/app/api/session/route.ts` (lightweight Supabase query + JSON response)

**Session route pattern** (`src/app/api/session/route.ts` lines 1-51) — template for response structure:
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";

export async function POST(request: Request): Promise<Response> {
  try {
    // ... Supabase query ...
    return NextResponse.json({ session_id: created.data.id });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
```

**Status route pattern for GET** (`src/app/api/status/route.ts` lines 1-12):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";

export async function GET(request: Request): Promise<Response> {
  // ...Supabase query...
  return NextResponse.json({ status: row.status, /* ... */ });
}
```

**Internal route auth pattern** (`src/app/api/internal/embed-batch/route.ts` lines 29-46) — Vercel Cron sends no auth header but the `CRON_SECRET` env var pattern is standard. For the keep-alive route, Vercel's built-in `x-vercel-cron: 1` header gates the request rather than a secret in the URL (avoids the query-string secret in vercel.json being visible in logs):
```typescript
// Gate: only allow Vercel Cron invocations (not open to the public)
function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) { return null; }
  return h.slice(7);
}
```

**Keep-alive route shape to create:**
```typescript
import "server-only";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/db/client";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * INFRA-05: Weekly Vercel Cron keep-alive.
 * Runs a trivial SELECT 1 against Supabase to prevent the project from pausing
 * after 1 week of inactivity (Supabase Feb 2026 policy).
 */
export async function GET(): Promise<Response> {
  try {
    const { error } = await supabaseAdmin.from("documents").select("id").limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
```

**Test pattern** (mirrors `src/app/api/internal/embed-batch/embed-batch.test.ts`):
```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));
vi.mock("server-only", () => ({}));

import { GET } from "./route";

describe("GET /api/cron/keep-alive", () => {
  it("returns 200 with ok: true when Supabase query succeeds", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
```

---

### `vercel.json` (config — modify)

**Analog:** `vercel.json` (self-modify)

**Current cron array** (`vercel.json` lines 1-12):
```json
{
  "crons": [
    {
      "path": "/api/internal/parse-batch?secret=${INTERNAL_PARSE_SECRET}",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/internal/embed-batch?secret=${INTERNAL_PARSE_SECRET}",
      "schedule": "* * * * *"
    }
  ]
}
```

**Pattern to add** — third entry in the `crons` array:
```json
{
  "path": "/api/cron/keep-alive",
  "schedule": "0 0 * * 0"
}
```

`"0 0 * * 0"` = every Sunday at midnight UTC (weekly). No `secret` query param needed — the route is gated by checking `process.env.NODE_ENV` or Vercel's built-in cron invocation header (`Authorization: Bearer ${CRON_SECRET}`). Alternatively, use the Vercel-recommended `CRON_SECRET` env var pattern.

---

### `src/lib/ingest/analyze-document-batch.ts` (service — modify, concurrency cap INFRA-03)

**Analog:** `src/lib/ingest/embed-document-batch.ts`

**Current status gate pattern** (`src/lib/ingest/analyze-document-batch.ts` lines 88-95):
```typescript
  if (docRes.error || !docRes.data) return { done: false };
  const doc = docRes.data;

  // -------------------------------------------------------------------------
  // 2. Status gate
  // -------------------------------------------------------------------------
  if (doc.status === "ready") return { done: true };
  if (doc.status !== "analyzing") return { done: true };
```

**Concurrency cap pattern to insert after status gate** (INFRA-03, D-39 discretion):
```typescript
  // -------------------------------------------------------------------------
  // 2b. Concurrency cap (INFRA-03) — max 2 concurrent LLM analysis jobs
  // Query count of documents in "analyzing" state across all docs (not just this one).
  // DB-level counter survives across serverless invocations.
  // -------------------------------------------------------------------------
  const { count: activeCount, error: countError } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "analyzing");

  if (!countError && (activeCount ?? 0) > 2) {
    // More than 2 concurrent analyzing jobs — queue this one (leave status as "analyzing")
    // The cron will re-pick it on the next tick. Caller receives done: false to signal retry.
    return { done: false };
  }
```

**Note:** The cap check queries `status = "analyzing"` (the current doc is already in "analyzing" when this function runs, so the count will include it). The threshold is `> 2` to allow up to 2 concurrent jobs (the current doc + at most 1 other). If the route triggering this is `/api/internal/analyze-batch`, the 429 with `Retry-After` response belongs in the route handler, not in `runAnalyzeBatch` — the batch function returns `{ done: false }` and the route can decide how to surface that.

---

## Shared Patterns

### `import "server-only"` directive
**Source:** `src/db/client.ts` line 1, `src/app/api/chat/route.ts` line 14, `src/lib/explain/generate-explanation.ts` line 1
**Apply to:** `src/lib/langfuse.ts`, `src/app/api/cron/keep-alive/route.ts`
```typescript
import "server-only";
```
Always the first line in any file that exports a server-only singleton or handles a server route.

### Supabase error + early return
**Source:** `src/lib/ingest/embed-document-batch.ts` lines 53-57
**Apply to:** `src/app/api/cron/keep-alive/route.ts`
```typescript
  if (docRes.error || !docRes.data) {
    return { done: false };
  }
```

### Zod request validation pattern
**Source:** `src/app/api/chat/route.ts` lines 66-80
**Apply to:** All route handlers (already established; keep consistent in keep-alive route — but keep-alive takes no body, so only path/header validation applies)
```typescript
  let parsed;
  try {
    const json: unknown = await request.json().catch(() => null);
    parsed = ChatRequestSchema.safeParse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "..." }, { status: 400 });
  }
```

### Vitest `vi.hoisted` mock pattern
**Source:** `src/lib/explain/__tests__/generate-explanation.test.ts` lines 6-14, `src/app/api/chat/__tests__/route.test.ts` lines 3-9
**Apply to:** All new test files for Phase 11
```typescript
const { flushAsync, traceEnd } = vi.hoisted(() => ({
  flushAsync: vi.fn().mockResolvedValue(undefined),
  traceEnd: vi.fn().mockReturnThis(),
}));
vi.mock("@/lib/langfuse", () => ({
  langfuse: {
    trace: vi.fn().mockReturnValue({
      generation: vi.fn().mockReturnValue({ end: traceEnd }),
      update: vi.fn(),
    }),
    flushAsync,
  },
}));
vi.mock("server-only", () => ({}));
```

### `best-effort .catch()` for non-critical async side effects
**Source:** `src/app/api/upload-complete/route.ts` line 72 (`.catch(() => {})` on storage.remove); `src/app/api/chat/route.ts` lines 140-147 (`try { await persist } catch {}`)
**Apply to:** PDF cleanup in embed-document-batch.ts (use `.catch(warn)` not silent swallow); Langfuse flushAsync should NOT use best-effort — it must be awaited so events are not lost.
```typescript
.remove([path]).catch(() => {
  console.warn(`[embed-batch] PDF cleanup failed for doc ${docId}`);
});
```

### `export const maxDuration` for route budget
**Source:** `src/app/api/chat/route.ts` line 33 (`export const maxDuration = 60`); `src/app/api/internal/analyze-batch/route.ts` line 16 (`export const maxDuration = 300`)
**Apply to:** `src/app/api/cron/keep-alive/route.ts` — set `export const maxDuration = 10` (trivial SELECT 1 should never approach this)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/langfuse.ts` (the singleton itself) | utility | — | No existing Langfuse integration in codebase; closest analog is `src/db/client.ts` (singleton client pattern), used above |

---

## Metadata

**Analog search scope:** `src/lib/`, `src/app/api/`, `src/db/`
**Files scanned:** 16 source files + 6 test files
**Pattern extraction date:** 2026-05-23
