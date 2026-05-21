"use client";

/**
 * Phase 10 CHAT-01..06 client surface.
 * - useChat IMPORT MUST be from 'ai/react' (v4) — NOT '@ai-sdk/react' (v5+) per RESEARCH §Pitfall 1.
 * - body MUST include documentId and sessionId (Pitfall 4) — server uses them for retrieval scope + persistence.
 * - initialMessages restores prior chat from Supabase (Plan 05 RSC populates this prop).
 */

import { useChat, type Message } from "ai/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ChatLoadingSkeleton } from "./chat-loading-skeleton";
import { ChatMessage } from "./chat-message";
import { StarterQuestions } from "./starter-questions";

interface ChatInterfaceProps {
  documentId: string;
  sessionId: string;
  initialMessages: Message[];
  starterQuestions: string[];
  onGoToPage: (page: number) => void;
  className?: string;
}

export function ChatInterface(props: ChatInterfaceProps) {
  const {
    documentId,
    sessionId,
    initialMessages,
    starterQuestions,
    onGoToPage,
    className,
  } = props;

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, append } =
    useChat({
      api: "/api/chat",
      id: documentId,
      body: { documentId, sessionId },
      initialMessages,
    });

  // Auto-grow textarea: reset height, then set to scrollHeight capped at 112px (4 rows × 28px line height per UI-SPEC).
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [input]);

  // Auto-scroll: only when user is at the bottom (don't yank them away from history).
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (isAtBottom) sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading, isAtBottom]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  }

  function onStarterSelect(q: string) {
    // Per UI-SPEC: auto-submit, do not just populate
    append({ role: "user", content: q });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex flex-col gap-4"
      >
        <StarterQuestions
          questions={starterQuestions}
          onSelect={onStarterSelect}
          visible={messages.length === 0}
        />
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            documentId={documentId}
            onGoToPage={onGoToPage}
          />
        ))}
        {isLoading ? <ChatLoadingSkeleton /> : null}
        <div ref={sentinelRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Ask about this document"
            aria-required="true"
            placeholder="Ask anything about this document…"
            disabled={isLoading}
            className={cn(
              "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2",
              "text-base leading-relaxed",
              "min-h-[44px] max-h-[112px] overflow-y-auto",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          />
          <Button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            className="min-h-[44px]"
          >
            Send Message
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-destructive px-1" role="alert">
            Connection error — please try again.
          </p>
        ) : null}
      </form>
    </div>
  );
}
