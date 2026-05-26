"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import type { ScoreResult } from "@/lib/explain/score-schema";
import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";
import type { Message } from "ai";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ExplanationPanel } from "./explanation-panel";
import { MobileTabView } from "./mobile-tab-view";
import type { PdfViewerHandle } from "./pdf-viewer-panel";

// react-pdf uses pdfjs-dist which relies on browser globals.
// Next.js App Router: skip SSR to avoid "window is not defined" errors at build time.
const PdfViewerPanel = dynamic(() => import("./pdf-viewer-panel").then((m) => m.PdfViewerPanel), {
  ssr: false,
});

const PANEL_IDS = ["explanation", "pdf"] as const;

// Inner split layout — must be a separate component so hooks are not called
// conditionally (the "Explanation not ready" guard is in DocumentReaderLayout).
function DesktopSplitPane(props: {
  documentId: string;
  explanation: ExplanationResult;
  pdfUrl: string | null;
  pdfRef: React.RefObject<PdfViewerHandle | null>;
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
    pdfRef,
    score,
    ticker,
    stockData,
    chartData,
    stockError,
    sessionId,
    initialMessages,
    starterQuestions,
  } = props;

  // SSR-safe storage shim: react-resizable-panels calls storage.getItem/setItem
  // synchronously; providing a no-op on the server avoids "localStorage is not defined".
  const safeStorage = {
    getItem: (key: string) =>
      typeof window !== "undefined" ? localStorage.getItem(key) : null,
    setItem: (key: string, value: string) => {
      if (typeof window !== "undefined") localStorage.setItem(key, value);
    },
  };
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "reader-panel-group",
    panelIds: [...PANEL_IDS],
    storage: safeStorage,
  });

  const handleGoToPage = (page: number) => {
    pdfRef.current?.scrollToPage(page);
  };

  return (
    <Group
      id="reader-panel-group"
      orientation="horizontal"
      className="h-full w-full"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="explanation" defaultSize={50} minSize={20} className="flex flex-col !overflow-hidden">
        <Tabs defaultValue="explanation" className="flex h-full flex-col">
          <TabsList className="w-full shrink-0 justify-start rounded-none border-b border-border bg-muted">
            <TabsTrigger value="explanation">Explanation</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>
          <TabsContent value="explanation" className="mt-0 min-h-0 flex-1 overflow-auto">
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
          <TabsContent value="chat" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <ChatPanel
              documentId={documentId}
              sessionId={sessionId ?? ""}
              initialMessages={initialMessages}
              starterQuestions={starterQuestions}
              onGoToPage={handleGoToPage}
              className="h-full"
            />
          </TabsContent>
        </Tabs>
      </Panel>
      <Separator
        id="resize-handle"
        className="w-1 cursor-col-resize bg-border hover:bg-primary/20 data-[resize-handle-state=drag]:bg-primary/40"
        aria-label="Drag to resize panels"
      />
      <Panel id="pdf" defaultSize={50} minSize={20} className="overflow-hidden">
        <PdfViewerPanel ref={pdfRef} pdfUrl={pdfUrl} className="h-full" />
      </Panel>
    </Group>
  );
}

export function DocumentReaderLayout(props: {
  documentId: string;
  explanation: ExplanationResult | null;
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!explanation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-16">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-8">
            <p className="font-semibold text-base">Explanation not ready</p>
            <p className="text-muted-foreground text-sm">
              The analysis is still processing. Check back in a moment.
            </p>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="h-screen w-full overflow-hidden">
      {/* Mobile (≤768px): tab switcher */}
      <div className="flex h-full md:hidden">
        <MobileTabView
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
      </div>

      {/* Desktop (≥769px): resizable split — client-only to avoid SSR/hydration mismatch
          with react-resizable-panels which reads localStorage for panel sizes. */}
      <div className="hidden h-full md:flex">
        {mounted && (
          <DesktopSplitPane
            documentId={documentId}
            explanation={explanation}
            pdfUrl={pdfUrl}
            pdfRef={pdfRef}
            score={score}
            ticker={ticker}
            stockData={stockData}
            chartData={chartData}
            stockError={stockError}
            sessionId={sessionId}
            initialMessages={initialMessages}
            starterQuestions={starterQuestions}
          />
        )}
      </div>
    </main>
  );
}
