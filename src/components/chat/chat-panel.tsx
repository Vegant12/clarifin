"use client";

import type { Message } from "ai";

import { cn } from "@/lib/utils";

import { ChatInterface } from "./chat-interface";

/**
 * Phase 10 chat panel container.
 * Mounted by:
 *  - DocumentReaderLayout (desktop): appended to the left scrollable panel
 *  - MobileTabView (mobile): inside the "Chat" tab content
 */
export function ChatPanel(props: {
  documentId: string;
  sessionId: string;
  initialMessages: Message[];
  starterQuestions: string[];
  onGoToPage: (page: number) => void;
  className?: string;
}) {
  const { documentId, sessionId, initialMessages, starterQuestions, onGoToPage, className } =
    props;

  return (
    <section
      aria-label="Chat about this document"
      className={cn("flex flex-col gap-3 px-6 pt-4 pb-4", className)}
    >
      <h2 className="shrink-0 text-xl font-semibold text-foreground">Chat</h2>
      <ChatInterface
        documentId={documentId}
        sessionId={sessionId}
        initialMessages={initialMessages}
        starterQuestions={starterQuestions}
        onGoToPage={onGoToPage}
        className="flex-1 min-h-0"
      />
    </section>
  );
}
