"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { PdfLoadingSkeleton } from "./pdf-loading-skeleton";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type LoadState = "loading" | "loaded" | "error";

export type PdfViewerHandle = {
  scrollToPage: (page: number) => void;
};

export const PdfViewerPanel = forwardRef<
  PdfViewerHandle,
  { pdfUrl: string | null; className?: string }
>(function PdfViewerPanel(props, ref) {
  const { pdfUrl, className } = props;
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const containerRef = useRef<HTMLElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadState("loaded");
  }, []);

  const handleLoadError = useCallback((_err: Error) => {
    setLoadState("error");
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const target = pageRefs.current.get(page);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentPage(page);
    }
  }, []);

  useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

  if (pdfUrl === null) {
    return (
      <div className={className} role="status" aria-label="PDF unavailable">
        <p className="p-4 text-muted-foreground text-sm">
          PDF preview unavailable. The source file may not be stored for older
          uploads — try re-uploading the document.
        </p>
      </div>
    );
  }

  return (
    <section
      ref={containerRef}
      className={className}
      aria-label="Source document viewer"
      aria-busy={loadState === "loading"}
    >
      {loadState === "error" ? (
        <div
          role="alert"
          className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm"
        >
          Could not load PDF. Try refreshing the page.
        </div>
      ) : null}

      <div className="relative h-full overflow-auto">
        <Document
          file={pdfUrl}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={<PdfLoadingSkeleton />}
          error={null}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => {
                if (el !== null) {
                  pageRefs.current.set(pageNum, el);
                } else {
                  pageRefs.current.delete(pageNum);
                }
              }}
              data-page={pageNum}
              className="flex justify-center border-border border-b py-4"
            >
              <Page pageNumber={pageNum} width={600} renderAnnotationLayer renderTextLayer />
            </div>
          ))}
        </Document>

        {loadState === "loaded" && numPages > 0 ? (
          <div className="sticky bottom-2 mr-2 ml-auto w-fit rounded-full bg-white/80 px-2 py-1 text-muted-foreground text-xs shadow-sm">
            {`Page ${currentPage} / ${numPages}`}
          </div>
        ) : null}
      </div>
    </section>
  );
});
