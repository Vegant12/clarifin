"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Message } from "ai";

import { ChatPanel } from "@/components/chat/chat-panel";
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
  sessionId: string | null;
  initialMessages: Message[];
  starterQuestions: string[];
}) {
  const {
    documentId,
    explanation,
    pdfUrl,
    score,
    ticker,
    stockData,
    chartData,
    stockError,
    sessionId,
    initialMessages,
    starterQuestions,
  } = props;
  const pdfRef = useRef<PdfViewerHandle>(null);
  const [tab, setTab] = useState<"explanation" | "pdf" | "chat">("explanation");

  const handleGoToPage = (page: number) => {
    pdfRef.current?.scrollToPage(page);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex h-screen w-full flex-col">
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
        <TabsTrigger
          value="chat"
          className="data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:font-semibold"
        >
          Chat
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
      {/* CHAT-01 mobile: Chat tab rendered UNCONDITIONALLY — no sessionId !== null guard.
          Citation clicks switch to "pdf" tab then scroll, per UI-SPEC Citation Click in Chat. */}
      <TabsContent value="chat" className="flex-1 overflow-hidden">
        <ChatPanel
          documentId={documentId}
          sessionId={sessionId ?? ""}
          initialMessages={initialMessages}
          starterQuestions={starterQuestions}
          onGoToPage={(p) => {
            setTab("pdf");
            // Defer scroll to next tick so the PDF panel is mounted/visible.
            setTimeout(() => pdfRef.current?.scrollToPage(p), 0);
          }}
          className="h-full"
        />
      </TabsContent>
    </Tabs>
  );
}
