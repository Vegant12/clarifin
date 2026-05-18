"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getBrowserSessionToken } from "@/lib/session-client";

// Module-level cache shared across all CitationPopover instances (per D-07).
// Key: `${docId}:${page}` → verbatim chunk text.
const pageTextCache = new Map<string, string>();

type FetchState = "idle" | "loading" | "loaded" | "error";

export function CitationPopover(props: {
  docId: string;
  page: number;
  open: boolean;
  onGoToPage: (page: number) => void;
}) {
  const { docId, page, open, onGoToPage } = props;
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [pageText, setPageText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const cacheKey = `${docId}:${page}`;
    const cached = pageTextCache.get(cacheKey);
    if (cached !== undefined) {
      setPageText(cached);
      setFetchState("loaded");
      return;
    }

    const sessionToken = getBrowserSessionToken();
    if (!sessionToken) {
      setFetchState("error");
      return;
    }

    let cancelled = false;
    setFetchState("loading");

    const qs = new URLSearchParams({
      doc_id: docId,
      session_token: sessionToken,
      page: String(page),
    });

    fetch(`/api/page-text?${qs.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("unavailable");
        return (await res.json()) as { text: string };
      })
      .then((body) => {
        if (cancelled) return;
        pageTextCache.set(cacheKey, body.text);
        setPageText(body.text);
        setFetchState("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setFetchState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open, docId, page]);

  return (
    <div role="dialog" aria-label={`Source text for page ${page}`} className="flex flex-col gap-3">
      {fetchState === "loading" ? (
        <p aria-live="polite" className="animate-pulse text-muted-foreground text-sm">
          Loading source text…
        </p>
      ) : null}

      {fetchState === "error" ? (
        <p className="text-muted-foreground text-sm">Source text unavailable for this page.</p>
      ) : null}

      {fetchState === "loaded" && pageText !== null ? (
        <p className="line-clamp-4 text-foreground text-sm leading-relaxed">{pageText}</p>
      ) : null}

      {fetchState === "loaded" || fetchState === "error" ? (
        <Button size="sm" onClick={() => onGoToPage(page)}>
          {`Go to page ${page} →`}
        </Button>
      ) : null}
    </div>
  );
}

// Exported for tests only — allows clearing the module cache between specs.
export function __clearPageTextCacheForTests(): void {
  pageTextCache.clear();
}
