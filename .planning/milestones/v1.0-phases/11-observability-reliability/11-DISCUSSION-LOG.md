# Phase 11: Observability & Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 11-observability-reliability
**Areas discussed:** Langfuse wiring strategy, Prompt versioning approach

---

## Langfuse Wiring Strategy

### GoogleGenAI call wrapping

| Option | Description | Selected |
|--------|-------------|----------|
| Manual trace/generation spans | Call langfuse.trace() and trace.generation() before/after each GoogleGenAI call. Explicit, full control. ~10 lines per call site. | ✓ |
| Shared wrapper function | One withLangfuse(fn, traceOpts) helper wrapping any async LLM call. All 4 call sites use the same pattern. | |
| You decide | Claude picks the cleaner approach during planning. | |

**User's choice:** Manual trace/generation spans

---

### Vercel AI SDK call wrapping (streamText)

| Option | Description | Selected |
|--------|-------------|----------|
| Langfuse callbacks via onFinish | Open generation before streamText, close inside onFinish with token counts. Native to the existing pattern in chat/route.ts. | ✓ |
| Manual span around the stream | Open trace before streamText, close in try/finally. Simpler but loses token count granularity. | |
| You decide | Claude picks during planning. | |

**User's choice:** Langfuse callbacks via onFinish

---

### Trace metadata

| Option | Selected |
|--------|----------|
| Input prompt + output | ✓ |
| Latency + token counts | ✓ |
| Document ID + phase tag | ✓ |
| Model ID + temperature/settings | ✓ |

**User's choice:** All four metadata categories

---

### Langfuse client initialization

| Option | Description | Selected |
|--------|-------------|----------|
| Shared singleton in src/lib/langfuse.ts | One file exports a pre-configured Langfuse client. Mirrors src/db/client.ts pattern. | ✓ |
| Per-call initialization | Each call site creates its own Langfuse instance. | |

**User's choice:** Shared singleton

---

## Prompt Versioning Approach

### Version tracking mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Git SHA tag on each trace | Attach VERCEL_GIT_COMMIT_SHA to every trace. Each deploy = new prompt version. Zero latency, no extra API calls. | ✓ |
| Langfuse native prompt management | Upload prompts to Langfuse. Fetch at runtime. Enables non-deploy prompt changes. Adds cold-start latency. | |
| Manual version constant in code | PROMPT_VERSION constant in each prompt file. Simple but requires discipline to bump manually. | |

**User's choice:** Git SHA tag on each trace

---

### Prompt storage location

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in code, mirrored to traces | Prompts remain in src/lib/explain/. Langfuse stores what was sent (trace input). | ✓ |
| Move to Langfuse as source of truth | Prompts in Langfuse dashboard. Code fetches at runtime. | |

**User's choice:** Stay in code

---

## Claude's Discretion

- Concurrency cap mechanism (INFRA-03) — DB-level counter/semaphore approach suggested; exact implementation left to planner
- PDF cleanup timing (INFRA-04) — anchor in embed-document-batch.ts; preserve PDF on partial failure
- Vercel Cron setup (INFRA-05) — standard GET /api/cron/keep-alive + SELECT 1 pattern

## Deferred Ideas

None
