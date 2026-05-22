import "server-only";
import type { Message } from "ai";
import { supabaseAdmin } from "@/db/client";

export interface LoadMessagesArgs {
  sessionId: string;
  documentId: string;
  /** Defaults to new Date() -- injectable for tests to make the 7-day window deterministic. */
  now?: Date;
}

/**
 * Loads up to 40 chat_messages rows for (sessionId, documentId) created in the
 * last 7 days, ordered chronologically. Maps DB rows to Vercel AI SDK Message[]
 * suitable for useChat({ initialMessages }).
 *
 * Returns [] on any error or when the query yields no rows -- callers should
 * treat this as "no prior history" rather than a hard failure (chat still works
 * for fresh sessions).
 *
 * Security: BOTH session_id AND doc_id are used in the query to prevent
 * cross-document chat leakage (T-10-25, Pitfall 6).
 */
export async function loadInitialMessages({
  sessionId,
  documentId,
  now = new Date(),
}: LoadMessagesArgs): Promise<Message[]> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, content, citations, created_at")
    .eq("session_id", sessionId)
    .eq("doc_id", documentId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true })
    .limit(40);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    role: row.role as Message["role"],
    content: row.content,
    // citations are stored alongside content; ChatMessage parses [p.N] tokens from
    // `content` at render time via parseCitations (Plan 04). The `citations` column
    // is reserved for a v2 structured-payload path and intentionally not surfaced
    // here to keep initialMessages a pure AI-SDK Message[].
  }));
}
