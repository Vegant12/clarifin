"use client";

import { Fragment } from "react";
import type { Message } from "ai";

import { CitationInline } from "@/components/doc/citation-inline";
import { parseCitations } from "@/lib/citations/parse-citations";
import { CHAT_DEFLECTION_MESSAGE } from "@/lib/prompts";
import { GuardrailDeflection } from "./guardrail-deflection";

/**
 * Phase 10 chat message renderer.
 * - User: right-aligned bubble, bg-muted (UI-SPEC User Message contract verbatim).
 * - Assistant: left-aligned bubble + parsed [p.N] citations + "not investment advice"
 *   disclaimer line below (DISCLAIM-01).
 * - Guardrail deflection (content equals CHAT_DEFLECTION_MESSAGE): rendered via
 *   GuardrailDeflection with neutral info box styling.
 * - System / tool: not rendered (returns null).
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

  // Assistant: regular bubble + citations + disclaimer
  const tokens = parseCitations(message.content);
  return (
    <div className="flex justify-start gap-3">
      <div className="max-w-[90%] flex flex-col gap-2">
        <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-3">
          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
            {tokens.map((tok, idx) => {
              if (tok.kind === "citation") {
                return (
                  <CitationInline
                    key={`${message.id}.cite.${idx}`}
                    page={tok.page}
                    docId={documentId}
                    onGoToPage={onGoToPage}
                  />
                );
              }
              return (
                <Fragment key={`${message.id}.text.${idx}`}>{tok.value}</Fragment>
              );
            })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          This is not investment advice.
        </p>
      </div>
    </div>
  );
}
