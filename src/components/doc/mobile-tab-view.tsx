"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import type { ScoreResult } from "@/lib/explain/score-schema";
import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";

import { ExplanationPanel } from "./explanation-panel";
import type { PdfViewerHandle } from "./pdf-viewer-panel";

const PdfViewerPanel = dynamic(() => import("./pdf-viewer-panel").then((m) => m.PdfViewerPanel), {
  ssr: false,
});

export function MobileTabView(props: {
  documentId: string;
  explanation: ExplanationResult;
  pdfUrl: string | null;
  score: ScoreResult | null;
  ticker: string | null;
  stockData: StockData | null;
  chartData: ChartDataPoint[] | null;
  stockError: boolean;
}) {
  const { documentId, explanation, pdfUrl, score, ticker, stockData, chartData, stockError } = props;
  const pdfRef = useRef<PdfViewerHandle>(null);

  const handleGoToPage = (page: number) => {
    pdfRef.current?.scrollToPage(page);
  };

  return (
    <Tabs defaultValue="explanation" className="flex h-screen w-full flex-col">
      <TabsList className="w-full justify-start rounded-none border-border border-b bg-muted">
        <TabsTrigger
          value="explanation"
          className="data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:font-semibold"
        >
          Explanation
        </TabsTrigger>
        <TabsTrigger
          value="pdf"
          className="data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:font-semibold"
        >
          Source PDF
        </TabsTrigger>
      </TabsList>
      <TabsContent value="explanation" className="flex-1 overflow-auto">
        <ExplanationPanel
          documentId={documentId}
          explanation={explanation}
          score={score}
          onGoToPage={handleGoToPage}
          ticker={ticker}
          stockData={stockData}
          chartData={chartData}
          stockError={stockError}
        />
      </TabsContent>
      <TabsContent value="pdf" className="flex-1 overflow-hidden">
        <PdfViewerPanel ref={pdfRef} pdfUrl={pdfUrl} className="h-full" />
      </TabsContent>
    </Tabs>
  );
}
