/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Message } from "ai";

import { ChatMessage } from "../chat-message";
import { CHAT_DEFLECTION_MESSAGE } from "@/lib/prompts";

const DOC_ID = "doc-1";

function makeMessage(over: Partial<Message>): Message {
  return {
    id: over.id ?? "m1",
    role: over.role ?? "user",
    content: over.content ?? "",
    ...over,
  } as Message;
}

describe("ChatMessage", () => {
  afterEach(() => {
    cleanup();
  });

  it("user message: right-aligned bubble, no disclaimer", () => {
    const { container } = render(
      <ChatMessage
        message={makeMessage({ role: "user", content: "Hello" })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    expect(container.querySelector(".justify-end")).not.toBeNull();
    // getByText throws if not found; queryByText returns null when absent
    expect(screen.queryByText(/not investment advice/i)).toBeNull();
  });

  it("assistant message: renders disclaimer (DISCLAIM-01)", () => {
    render(
      <ChatMessage
        message={makeMessage({ role: "assistant", content: "Revenue was Rp 5T." })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    // getByText throws if element not found — sufficient assertion of presence
    expect(screen.getByText(/this is not investment advice/i)).toBeTruthy();
  });

  it("assistant message: parses [p.N] citations into clickable pills", () => {
    const onGoToPage = vi.fn();
    render(
      <ChatMessage
        message={makeMessage({
          role: "assistant",
          content: "Net profit was Rp 5T [p.12].",
        })}
        documentId={DOC_ID}
        onGoToPage={onGoToPage}
      />,
    );
    // Citation rendered as span with aria-label per CitationInline
    expect(screen.getByLabelText(/view source for page 12/i)).toBeTruthy();
  });

  it("assistant deflection message: renders GuardrailDeflection (not regular bubble)", () => {
    render(
      <ChatMessage
        message={makeMessage({ role: "assistant", content: CHAT_DEFLECTION_MESSAGE })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    expect(screen.getByText(/i can't help with that/i)).toBeTruthy();
    // Deflection bubble does NOT append the standard disclaimer line
    expect(screen.queryByText(/^this is not investment advice\.$/i)).toBeNull();
  });
});
