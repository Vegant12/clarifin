import { DocumentProgressView } from "@/components/doc/document-progress-view";
import { supabaseAdmin } from "@/db/client";
import { loadInitialMessages } from "@/lib/session-restore";
import { type ExplanationResult, explanationSchema } from "@/lib/explain/explanation-schema";
import { type ScoreResult, scoreSchema } from "@/lib/explain/score-schema";
import { fetchStockDataForDocument } from "@/lib/stock/fetch-stock-data";
import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";
import { StarterQuestionsSchema } from "@/lib/starter-questions-schema";
import type { Message } from "ai";
import { z } from "zod";

const sessionIdSchema = z.string().uuid();

export default async function DocumentPage(props: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { documentId } = await props.params;
  const search = await props.searchParams;
  const sessionIdParsed = search.sessionId
    ? sessionIdSchema.safeParse(search.sessionId)
    : null;
  const sessionId: string | null =
    sessionIdParsed && sessionIdParsed.success ? sessionIdParsed.data : null;

  let explanation: ExplanationResult | null = null;
  let score: ScoreResult | null = null;
  let pdfUrl: string | null = null;
  let stockData: StockData | null = null;
  let chartData: ChartDataPoint[] | null = null;
  let stockError = false;
  let initialMessages: Message[] = [];
  let starterQuestions: string[] = [];

  // 1. Document analysis (also reads starter_questions jsonb for CHAT-05 cache)
  const analysisRes = await supabaseAdmin
    .from("document_analysis")
    .select("explanation, score_breakdown, starter_questions")
    .eq("doc_id", documentId)
    .maybeSingle();

  if (analysisRes.data?.explanation) {
    const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
    if (parsed.success) explanation = parsed.data;
  }

  if (analysisRes.data?.score_breakdown) {
    const parsed = scoreSchema.safeParse(analysisRes.data.score_breakdown);
    if (parsed.success) score = parsed.data;
  }

  // 1b. CHAT-05 starter questions — prefer cached jsonb; trigger generation only if cache empty + explanation ready.
  const cached = analysisRes.data?.starter_questions;
  if (Array.isArray(cached)) {
    const v = StarterQuestionsSchema.safeParse({ questions: cached });
    if (v.success) starterQuestions = v.data.questions;
  }
  if (starterQuestions.length === 0 && explanation !== null) {
    try {
      // Vercel sets VERCEL_URL automatically on every deployment (preview + prod).
      // NEXT_PUBLIC_BASE_URL is set in production overrides. Localhost is the dev fallback.
      // Order matters: VERCEL_URL must come first or production deploys fall through to
      // localhost:3000 and the loopback fetch always fails.
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000");
      const res = await fetch(`${baseUrl}/api/starter-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as { questions?: string[] };
        const v = StarterQuestionsSchema.safeParse({ questions: body.questions });
        if (v.success) starterQuestions = v.data.questions;
      }
    } catch {
      // Starter questions are non-essential; empty array degrades to "no pills" UI state.
    }
  }

  // 2. Document row (storage path + ticker — unchanged from prior phases)
  // TODO(phase-12): validate session ownership server-side in RSC before exposing explanation + signed URL.
  const docRes = await supabaseAdmin
    .from("documents")
    .select("storage_path, ticker")
    .eq("id", documentId)
    .maybeSingle();

  if (docRes.data?.storage_path) {
    const signedRes = await supabaseAdmin.storage
      .from("pdfs")
      .createSignedUrl(docRes.data.storage_path, 3600);
    if (signedRes.data?.signedUrl) {
      pdfUrl = signedRes.data.signedUrl;
    } else if (signedRes.error) {
      console.error(
        "[doc-page] createSignedUrl failed",
        documentId,
        signedRes.error,
      );
    }
  } else if (docRes.data) {
    console.warn(
      "[doc-page] storage_path missing for document",
      documentId,
    );
  }

  // 3. Stock data (unchanged — Phase 9)
  const ticker: string | null = docRes.data?.ticker ?? null;

  if (ticker !== null) {
    stockData = await fetchStockDataForDocument(documentId);
    if (stockData === null) {
      stockError = true;
    } else if (stockData.history.length > 0) {
      chartData = stockData.history;
    }
  }

  // 4. CHAT-04 7-day session restore — only when sessionId is in the URL.
  //    Delegates to src/lib/session-restore.ts so the query is testable in isolation.
  //    chat_messages query uses BOTH session_id AND doc_id to prevent cross-document
  //    chat leakage (T-10-25, Pitfall 6).
  if (sessionId !== null) {
    initialMessages = await loadInitialMessages({ sessionId, documentId });
  }

  return (
    <DocumentProgressView
      documentId={documentId}
      explanation={explanation}
      pdfUrl={pdfUrl}
      score={score}
      ticker={ticker}
      stockData={stockData}
      chartData={chartData}
      stockError={stockError}
      sessionId={sessionId}
      initialMessages={initialMessages}
      starterQuestions={starterQuestions}
    />
  );
}
