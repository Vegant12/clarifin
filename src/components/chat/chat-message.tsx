"use client";

import React from "react";
import type { Message } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { renderInlineWithCitations } from "@/lib/citations/render-inline-citations";
import { CHAT_DEFLECTION_MESSAGE } from "@/lib/prompts";
import { GuardrailDeflection } from "./guardrail-deflection";

/**
 * Phase 10 chat message renderer.
 * - User: right-aligned bubble, bg-muted (UI-SPEC User Message contract verbatim).
 * - Assistant: left-aligned bubble + markdown (bold, lists, headings, code) +
 *   parsed [p.N] citations rendered as CitationInline pills inside any markdown
 *   context (paragraph, list item, bold span, heading) + "not investment advice"
 *   disclaimer line below (DISCLAIM-01).
 * - Guardrail deflection (content equals CHAT_DEFLECTION_MESSAGE): rendered via
 *   GuardrailDeflection with neutral info box styling.
 * - System / tool: not rendered (returns null).
 *
 * quick-260525-eq2: Markdown via react-markdown + remark-gfm. The
 * renderInlineWithCitations helper walks each inline element's children, parses
 * [p.N] tokens on every string leaf, and substitutes a CitationInline pill in
 * place of the token. This preserves the existing CitationInline → HoverCard
 * popover behavior regardless of markdown context.
 */
export function ChatMessage(props: {
  message: Message;
  documentId: string;
  onGoToPage: (page: number) => void;
}) {
  const { message, documentId, onGoToPage } = props;

  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-4 py-3">
          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Assistant: deflection short-circuit
  if (message.content.trim() === CHAT_DEFLECTION_MESSAGE.trim()) {
    return <GuardrailDeflection message={message.content} />;
  }

  const renderInline = (children: React.ReactNode): React.ReactNode =>
    renderInlineWithCitations(children, {
      keyPrefix: message.id,
      docId: documentId,
      onGoToPage,
    });

  const components: Components = {
    p: ({ children }) => (
      <p className="text-base text-foreground leading-relaxed">{renderInline(children)}</p>
    ),
    strong: ({ children }) => <strong>{renderInline(children)}</strong>,
    em: ({ children }) => <em>{renderInline(children)}</em>,
    ul: ({ children }) => (
      <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{renderInline(children)}</li>,
    h1: ({ children }) => (
      <h1 className="text-lg font-semibold mt-2">{renderInline(children)}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-semibold mt-2">{renderInline(children)}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold mt-1">{renderInline(children)}</h3>
    ),
    code: ({ children }) => (
      <code className="bg-muted px-1 rounded text-sm font-mono">{children}</code>
    ),
    pre: ({ children }) => (
      <pre className="bg-muted p-2 rounded my-2 overflow-x-auto text-sm">{children}</pre>
    ),
  };

  // Assistant: regular bubble + markdown + citations + disclaimer
  return (
    <div className="flex justify-start gap-3">
      <div className="max-w-[90%] flex flex-col gap-2">
        <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {message.content}
          </ReactMarkdown>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          This is not investment advice.
        </p>
      </div>
    </div>
  );
}

