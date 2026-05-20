import { DocumentProgressView } from "@/components/doc/document-progress-view";
import { supabaseAdmin } from "@/db/client";
import { type ExplanationResult, explanationSchema } from "@/lib/explain/explanation-schema";
import { type ScoreResult, scoreSchema } from "@/lib/explain/score-schema";
import { fetchStockDataForDocument } from "@/lib/stock/fetch-stock-data";
import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";

export default async function DocumentPage(props: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await props.params;

  let explanation: ExplanationResult | null = null;
  let score: ScoreResult | null = null;
  let pdfUrl: string | null = null;
  let stockData: StockData | null = null;
  let chartData: ChartDataPoint[] | null = null;
  let stockError = false;

  // Fetch explanation + score_breakdown in one query
  const analysisRes = await supabaseAdmin
    .from("document_analysis")
    .select("explanation, score_breakdown")
    .eq("doc_id", documentId)
    .maybeSingle();

  if (analysisRes.data?.explanation) {
    const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
    if (parsed.success) {
      explanation = parsed.data;
    }
  }

  if (analysisRes.data?.score_breakdown) {
    const parsed = scoreSchema.safeParse(analysisRes.data.score_breakdown);
    if (parsed.success) {
      score = parsed.data;
    }
  }

  // Fetch signed PDF URL (1h TTL per D-13). Look up storage_path from documents first.
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
    }
  }

  // Phase 9: derive ticker from documents row, then fetch (or read cached) stock data.
  const ticker: string | null = docRes.data?.ticker ?? null;

  if (ticker !== null) {
    stockData = await fetchStockDataForDocument(documentId);
    if (stockData === null) {
      stockError = true;
    } else if (stockData.history.length > 0) {
      chartData = stockData.history;
    }
  }

  return <DocumentProgressView documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} score={score} ticker={ticker} stockData={stockData} chartData={chartData} stockError={stockError} />;
}
