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

  // --- Markdown rendering (quick-260525-eq2) ---

  it("assistant message: renders bold markdown as <strong>", () => {
    const { container } = render(
      <ChatMessage
        message={makeMessage({
          role: "assistant",
          content: "**Net profit** was Rp 5T.",
        })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain("Net profit");
  });

  it("assistant message: renders bulleted list as <li> items", () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: "assistant",
          content: "- Revenue: Rp 5T\n- Net profit: Rp 1T",
        })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("Revenue");
    expect(items[1]?.textContent).toContain("Net profit");
  });

  it("assistant message: preserves citation pills inside list items", () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: "assistant",
          content: "Highlights:\n- Revenue grew [p.4].\n- Margin held [p.7].",
        })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    const pill4 = screen.getByLabelText(/view source for page 4/i);
    const pill7 = screen.getByLabelText(/view source for page 7/i);
    expect(pill4).toBeTruthy();
    expect(pill7).toBeTruthy();
    // Each pill should be inside an <li>
    expect(pill4.closest("li")).not.toBeNull();
    expect(pill7.closest("li")).not.toBeNull();
  });

  it("assistant message: preserves citation pill inside bold span", () => {
    const { container } = render(
      <ChatMessage
        message={makeMessage({
          role: "assistant",
          content: "**Important [p.12]** finding.",
        })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain("Important");
    // Citation still rendered
    expect(screen.getByLabelText(/view source for page 12/i)).toBeTruthy();
  });

  it("user message: does NOT process markdown (asterisks are literal)", () => {
    const { container } = render(
      <ChatMessage
        message={makeMessage({ role: "user", content: "**Hello**" })}
        documentId={DOC_ID}
        onGoToPage={() => undefined}
      />,
    );
    // No <strong> rendered from a user message
    expect(container.querySelector("strong")).toBeNull();
  });
});
