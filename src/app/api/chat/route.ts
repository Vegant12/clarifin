/**
 * Phase 10 CHAT-01..06 chat route.
 *
 * Flow: validate → guardrail → retrieve → streamText → onFinish persist.
 * - Guardrail (CHAT-06) and empty-retrieval (CHAT-02) paths SKIP the LLM entirely
 *   (0 quota cost, <50ms latency).
 * - Happy path uses Vercel AI SDK v4 streamText + toDataStreamResponse (NOT
 *   toUIMessageStreamResponse — that is v5+).
 * - User message is persisted BEFORE streaming so a mid-stream failure does not
 *   lose the user's question (Pitfall — RESEARCH.md §Anti-Patterns).
 * - Every chat_messages insert includes BOTH session_id AND doc_id (Pitfall 6).
 */

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

export const runtime = "nodejs";
// Vercel Hobby cap is 60s; chat budget per RESEARCH.md §Pitfall 7 is ~12s p50.
export const maxDuration = 60;

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  documentId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

async function persistMessages(
  sessionId: string,
  documentId: string,
  rows: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  // CHAT-04: every row has doc_id populated (Pitfall 6 — otherwise session restore
  // scoped by doc_id returns empty).
  await supabaseAdmin.from("chat_messages").insert(
    rows.map((r) => ({
      session_id: sessionId,
      doc_id: documentId,
      role: r.role,
      content: r.content,
    })),
  );
}

export async function POST(request: Request): Promise<Response> {
  let parsed;
  try {
    const json: unknown = await request.json().catch(() => null);
    parsed = ChatRequestSchema.safeParse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Expected {messages, documentId, sessionId}." },
      { status: 400 },
    );
  }
  const { messages, documentId, sessionId } = parsed.data;
  const lastUser = messages[messages.length - 1];
  if (!lastUser || lastUser.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user." },
      { status: 400 },
    );
  }
  const lastMessage = lastUser.content;

  // 1. CHAT-06 pre-LLM guardrail. Zero quota cost, <1ms.
  if (isInvestmentAdviceQuery(lastMessage)) {
    await persistMessages(sessionId, documentId, [
      { role: "user", content: lastMessage },
      { role: "assistant", content: CHAT_DEFLECTION_MESSAGE },
    ]);
    return NextResponse.json(
      { role: "assistant", content: CHAT_DEFLECTION_MESSAGE },
      { status: 200 },
    );
  }

  // 2. CHAT-02 retrieve — top 5 chunks scoped to this document.
  const chunks = await matchDocumentChunks({
    docId: documentId,
    query: lastMessage,
    matchCount: 5,
  });

  if (chunks.length === 0) {
    await persistMessages(sessionId, documentId, [
      { role: "user", content: lastMessage },
      { role: "assistant", content: CHAT_EMPTY_RETRIEVAL_MESSAGE },
    ]);
    return NextResponse.json(
      { role: "assistant", content: CHAT_EMPTY_RETRIEVAL_MESSAGE },
      { status: 200 },
    );
  }

  // 3. Build grounded context block. Format MUST be `[Page N]: ...` so the
  //    prompt rule about [p.N] citations maps directly onto the visible page tags.
  const context = chunks
    .map((c) => `[Page ${c.page_number}]: ${c.content}`)
    .join("\n\n");

  // 4. Persist user message BEFORE streaming starts (Pitfall — if stream fails
  //    mid-way, the user's question is still in the history).
  await persistMessages(sessionId, documentId, [
    { role: "user", content: lastMessage },
  ]);

  // 5. CHAT-03 streamText + CHAT-04 onFinish persist.
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
}
