/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { StarterQuestions } from "../starter-questions";

const Q = ["What was revenue?", "Cash flow?", "Risks?", "Debt levels?", "Profit margin?"];

describe("StarterQuestions (CHAT-05)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders 5 pills when visible", () => {
    render(<StarterQuestions questions={Q} onSelect={() => undefined} visible />);
    for (const q of Q) {
      // getByText throws if not found — sufficient assertion of presence
      expect(screen.getByText(q)).toBeTruthy();
    }
  });

  it("returns null when visible=false", () => {
    const { container } = render(
      <StarterQuestions questions={Q} onSelect={() => undefined} visible={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("clicking a pill invokes onSelect with the question text", () => {
    const onSelect = vi.fn();
    render(<StarterQuestions questions={Q} onSelect={onSelect} visible />);
    // Q[0] is always defined — assert non-null to satisfy TypeScript
    fireEvent.click(screen.getByText(Q[0]!));
    expect(onSelect).toHaveBeenCalledWith(Q[0]);
  });
});
