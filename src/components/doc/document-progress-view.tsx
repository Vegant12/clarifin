"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { DocumentReaderLayout } from "@/components/doc/document-reader-layout";
import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";
import { useSessionReady } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PipelineStepper } from "@/components/upload/pipeline-stepper";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import type { ScoreResult } from "@/lib/explain/score-schema";
import { useDocumentStatus } from "@/lib/hooks/use-document-status";
import { getBrowserSessionToken } from "@/lib/session-client";
import type { Message } from "ai";

const uuidSchema = z.string().uuid();

export function DocumentProgressView(props: {
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
  const { isSessionReady, sessionError } = useSessionReady();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const pathname = usePathname();

  // CHAT-04: URL-sync effect — if the RSC rendered without ?sessionId= in the URL
  // (first visit), fetch the session_id row id from /api/session and append it.
  // On next navigation/refresh the RSC can query chat_messages for session restore.
  useEffect(() => {
    if (!mounted || !isSessionReady || sessionId !== null) return;
    let cancelled = false;
    void (async () => {
      const token = getBrowserSessionToken();
      if (!token) return;
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: token }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { session_id?: string };
        if (cancelled || !body.session_id) return;
        router.replace(`${pathname}?sessionId=${body.session_id}`, { scroll: false });
      } catch {
        // Non-fatal: chat will work without restore on first visit; refresh will resync.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, isSessionReady, sessionId, router, pathname]);

  const sessionToken = mounted ? getBrowserSessionToken() : null;
  const hasToken = Boolean(sessionToken && sessionToken.length > 0);
  const docIdParse = uuidSchema.safeParse(documentId);
  const docIdValid = docIdParse.success;

  const { data, error } = useDocumentStatus({
    docId: documentId,
    sessionToken,
    enabled: mounted && hasToken && isSessionReady && docIdValid,
  });

  const terminal = data?.status === "ready" || data?.status === "failed";

  // Bug 1 fix: once polling reaches a terminal status and the SSR-supplied
  // explanation is still null (the user is still on the progress view because the
  // RSC was rendered BEFORE the pipeline completed), trigger router.refresh()
  // exactly once. The refresh re-runs the doc page RSC which fetches the now-ready
  // explanation, score, signed pdfUrl, etc., and the WR-04 fast-path below renders
  // the reader. hasRefreshedRef guards against re-firing every poll tick during
  // the (brief) interval between the status flip and the RSC response.
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (hasRefreshedRef.current) return;
    if (explanation !== null) return;
    if (data?.status !== "ready" && data?.status !== "failed") return;
    hasRefreshedRef.current = true;
    router.refresh();
  }, [data?.status, explanation, router]);

  // WR-04: fast-path — if the RSC parent already fetched the explanation (document is ready),
  // render the reader immediately without waiting for the polling hook to resolve.
  // Polling continues in the background and would only matter for stale SSR edge cases.
  if (explanation) {
    return (
      <DocumentReaderLayout
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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col gap-4">
        <p className="font-mono font-semibold text-2xl tracking-tight">Clarifin</p>
        <h1 className="text-balance font-semibold text-3xl leading-tight">
          Processing your document
        </h1>
        <p className="text-muted-foreground text-sm">
          This usually takes a minute. You can keep this tab open.
        </p>
      </section>

      {mounted && sessionError ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-8">
            <p className="text-destructive text-sm">{sessionError}</p>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {mounted && !docIdValid ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-8">
            <p className="text-muted-foreground text-sm">
              This document link is not valid. Open the link from your upload, or start again from
              the homepage.
            </p>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!mounted ? <p className="text-muted-foreground text-sm">Loading…</p> : null}

      {mounted && !sessionError && docIdValid && !hasToken ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-8">
            <p className="text-muted-foreground text-sm">
              We could not restore your browsing session on this device. Start an upload from the
              homepage.
            </p>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {mounted && !sessionError && docIdValid && hasToken ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-8 pt-8">
              <PipelineStepper status={data?.status ?? "parsing"} />
              {!error && !terminal ? (
                <p aria-live="polite" className="text-muted-foreground text-sm">
                  {!isSessionReady ? "Starting your session…" : "Checking progress…"}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {error ? (
            <div
              role="alert"
              className="flex flex-col gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
            >
              <p className="text-destructive text-sm">{error}</p>
              <Button asChild className="h-11 self-start" variant="outline">
                <Link href="/">Back to upload</Link>
              </Button>
            </div>
          ) : null}

          {data?.status === "failed" ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm"
            >
              <p className="mb-4 font-medium">
                {data.error_message && data.error_message.trim().length > 0
                  ? data.error_message
                  : "Something went wrong processing this document."}
              </p>
              <Button asChild className="h-11" variant="outline">
                <Link href="/">Upload a different file</Link>
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <Separator />

      <footer className="text-muted-foreground text-sm">
        <p>{`© ${new Date().getFullYear()} Clarifin · Built for IDX investors.`}</p>
      </footer>
    </main>
  );
}
