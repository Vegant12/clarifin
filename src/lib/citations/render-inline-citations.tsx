import React, { Fragment } from "react";

import { CitationInline } from "@/components/doc/citation-inline";
import { parseCitations } from "@/lib/citations/parse-citations";

/**
 * Options for `renderInlineWithCitations`.
 *
 * - `keyPrefix`: unique scope for generated React keys (e.g. message id, section key).
 * - `docId` / `onGoToPage`: forwarded to each emitted `<CitationInline>`.
 * - `transformText`: optional hook applied to every TEXT leaf before emission.
 *   Used by `ExplanationPanel` to wrap glossary terms in `JargonTooltip`.
 *   Omit for chat-message (plain text leaves pass through).
 */
export interface RenderInlineCitationsOptions {
  keyPrefix: string;
  docId: string;
  onGoToPage: (page: number) => void;
  transformText?: (text: string, key: string) => React.ReactNode;
}

/**
 * Walk inline children from react-markdown and substitute `<CitationInline>`
 * pills for every `[p.N]` (or `[p.N, p.M, ...]`) token found in any string leaf.
 *
 * Non-string children (already-rendered React elements from nested markdown
 * like `<strong>` inside a `<p>`) pass through unchanged — react-markdown's
 * recursive descent means the caller's `strong` / `em` / etc. overrides will
 * run on them in turn.
 *
 * Shared between `chat-message` and `explanation-panel` (extracted in
 * quick-260526-c5k after multi-page citation bug). When a third consumer
 * appears, this is already the right seam — extend `transformText` rather
 * than forking the helper.
 */
export function renderInlineWithCitations(
  children: React.ReactNode,
  opts: RenderInlineCitationsOptions,
): React.ReactNode {
  const { keyPrefix, docId, onGoToPage, transformText } = opts;
  return React.Children.map(children, (child, childIdx) => {
    if (typeof child !== "string") return child;
    const tokens = parseCitations(child);
    if (tokens.length === 0) return child;
    return tokens.map((tok, tokIdx) => {
      const key = `${keyPrefix}.c${childIdx}.t${tokIdx}`;
      if (tok.kind === "citation") {
        return (
          <CitationInline
            key={key}
            page={tok.page}
            docId={docId}
            onGoToPage={onGoToPage}
          />
        );
      }
      return (
        <Fragment key={key}>
          {transformText ? transformText(tok.value, key) : tok.value}
        </Fragment>
      );
    });
  });
}
