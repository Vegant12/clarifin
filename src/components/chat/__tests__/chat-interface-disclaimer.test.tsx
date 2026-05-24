/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatInterface } from "../chat-interface";

// jsdom does not implement scrollIntoView — stub it to prevent TypeError
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

vi.mock("ai/react", () => ({
  useChat: () => ({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
    append: vi.fn(),
  }),
}));

describe("ChatInterface — DISCLAIM-01 disclaimer", () => {
  it("renders the chat disclaimer paragraph", () => {
    render(
      <ChatInterface
        documentId="doc-1"
        sessionId="session-1"
        initialMessages={[]}
        starterQuestions={[]}
        onGoToPage={() => {}}
      />,
    );
    const el = screen.getByTestId("chat-disclaimer");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("AI analysis · not financial advice");
  });
});
