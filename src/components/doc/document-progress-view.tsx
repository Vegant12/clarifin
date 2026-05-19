"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { DocumentReaderLayout } from "@/components/doc/document-reader-layout";
import { useSessionReady } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PipelineStepper } from "@/components/upload/pipeline-stepper";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import type { ScoreResult } from "@/lib/explain/score-schema";
import { useDocumentStatus } from "@/lib/hooks/use-document-status";
import { getBrowserSessionToken } from "@/lib/session-client";

const uuidSchema = z.string().uuid();

export function DocumentProgressView(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
  score: ScoreResult | null;
}) {
  const { documentId, explanation, pdfUrl, score } = props;
  const { isSessionReady, sessionError } = useSessionReady();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (mounted && !sessionError && docIdValid && hasToken && data?.status === "ready") {
    return (
      <DocumentReaderLayout documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} score={score} />
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
