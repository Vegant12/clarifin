/**
 * Phase 10 CHAT-05 starter-questions route.
 *
 * Cache-then-generate pattern (per RESEARCH.md §Pattern 4 / AI-SPEC §4 cost budget):
 * - Free-tier Gemini RPD = 250; generating 5 questions per session open would
 *   burn the quota fast. Generate ONCE per document, persist to
 *   document_analysis.starter_questions jsonb (column added in Plan 01).
 * - generateObject is v4 API; the AI-SPEC notes it's deprecated in v5+ but the
 *   project pins ai@4.3.19 (Plan 01).
 */

import "server-only";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { CHAT_MODEL_ID } from "@/lib/prompts";
import { StarterQuestionsSchema } from "@/lib/starter-questions-schema";

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z.object({
  documentId: z.string().uuid(),
});

type ExplanationLike = {
  revenue?: unknown;
  profitability?: unknown;
  balance_sheet?: unknown;
  cash_flow?: unknown;
  key_risks?: unknown;
} | null;

function summarizeExplanation(explanation: unknown): string {
  const e = explanation as ExplanationLike;
  if (!e || typeof e !== "object") return "";
  const sections = [
    typeof e.revenue === "string" ? e.revenue : "",
    typeof e.profitability === "string" ? e.profitability : "",
    typeof e.balance_sheet === "string" ? e.balance_sheet : "",
    typeof e.cash_flow === "string" ? e.cash_flow : "",
    typeof e.key_risks === "string" ? e.key_risks : "",
  ].filter(Boolean);
  return sections.join("\n\n").slice(0, 3000);
}

export async function POST(request: Request): Promise<Response> {
  let parsed;
  try {
    const json: unknown = await request.json().catch(() => null);
    parsed = RequestSchema.safeParse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Expected {documentId}." },
      { status: 400 },
    );
  }
  const { documentId } = parsed.data;

  // 1. Cache lookup — same scoping (doc_id) used by all other document_analysis reads.
  const row = await supabaseAdmin
    .from("document_analysis")
    .select("starter_questions, explanation")
    .eq("doc_id", documentId)
    .maybeSingle();

  if (row.error) {
    return NextResponse.json(
      { error: "Could not load document analysis." },
      { status: 500 },
    );
  }

  const cached = row.data?.starter_questions;
  if (Array.isArray(cached) && cached.length === 5) {
    // Validate cached shape — guards against legacy bad data.
    const validated = StarterQuestionsSchema.safeParse({ questions: cached });
    if (validated.success) {
      return NextResponse.json({ questions: validated.data.questions });
    }
  }

  // 2. Need explanation to summarize from.
  const summary = summarizeExplanation(row.data?.explanation);
  if (summary.length === 0) {
    return NextResponse.json(
      { error: "Explanation not ready. Try again once analysis completes." },
      { status: 409 },
    );
  }

  // 3. Generate.
  const { object } = await generateObject({
    model: google(CHAT_MODEL_ID),
    schema: StarterQuestionsSchema,
    prompt: `Given this plain-English summary of an IDX-listed company's financial document, generate exactly 5 plain-English follow-up questions a non-finance Indonesian retail investor would want to ask. Each question MUST be ≤120 characters. Do NOT ask questions about buying, selling, or investing. Focus on the company's revenue, profitability, debt, cash flow, and risks.

SUMMARY:
${summary}`,
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
}
