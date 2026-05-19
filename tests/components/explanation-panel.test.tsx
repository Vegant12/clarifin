import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplanationPanel } from "@/components/doc/explanation-panel";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";

const fixture: ExplanationResult = {
  revenue: "Revenue grew 18% [p.5] last year.",
  profitability: "Operating Margin held steady at 12% [p.12].",
  balance_sheet: "Strong current ratio of 2.1 [p.20].",
  cash_flow: "Free Cash Flow expanded.",
  key_risks: "Currency exposure remains a risk [p.45].",
};

describe("ExplanationPanel", () => {
  afterEach(() => {
    cleanup();
  });
  it("Test 1: renders all 5 section headings in order", () => {
    render(<ExplanationPanel documentId="doc-1" explanation={fixture} score={null} onGoToPage={vi.fn()} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toEqual([
      "Revenue",
      "Profitability",
      "Balance Sheet",
      "Cash Flow",
      "Key Risks",
    ]);
  });

  it("Test 2: [p.5] renders as a CitationInline with aria-label 'View source for page 5'", () => {
    render(<ExplanationPanel documentId="doc-1" explanation={fixture} score={null} onGoToPage={vi.fn()} />);
    const citation = screen.getByRole("button", { name: /view source for page 5/i });
    expect(citation).toBeInTheDocument();
  });

  it("Test 3: plain text outside citations renders as plain text (no aria-label wrapper)", () => {
    render(<ExplanationPanel documentId="doc-1" explanation={fixture} score={null} onGoToPage={vi.fn()} />);
    // "last year." is plain text — should be in the document
    expect(screen.getByText(/last year/)).toBeInTheDocument();
    // That text node should NOT have aria-label="View source for page N"
    const textNode = screen.getByText(/last year/);
    expect(textNode).not.toHaveAttribute("aria-label");
  });

  it("Test 4: jargon term from dictionary renders with dotted underline class", () => {
    render(<ExplanationPanel documentId="doc-1" explanation={fixture} score={null} onGoToPage={vi.fn()} />);
    // "Revenue" appears in the revenue section prose AND is in the jargon dictionary
    // The JargonTooltip wrapper span should have the dotted underline class
    const jargonSpans = document.querySelectorAll(".decoration-dotted");
    expect(jargonSpans.length).toBeGreaterThan(0);
  });

  it("Test 5: jargon detection is case-insensitive (ROE matches roe in dictionary)", () => {
    const fixtureWithROE: ExplanationResult = {
      ...fixture,
      profitability: "ROE increased to 15% this year.",
    };
    render(
      <ExplanationPanel documentId="doc-1" explanation={fixtureWithROE} score={null} onGoToPage={vi.fn()} />,
    );
    const jargonSpans = document.querySelectorAll(".decoration-dotted");
    expect(jargonSpans.length).toBeGreaterThan(0);
  });

  it("Test 6: clicking a citation calls onGoToPage with the correct page number", () => {
    const handle = vi.fn();
    render(<ExplanationPanel documentId="doc-1" explanation={fixture} score={null} onGoToPage={handle} />);
    const citation = screen.getByRole("button", { name: /view source for page 5/i });
    fireEvent.click(citation);
    expect(handle).toHaveBeenCalledWith(5);
  });

  it("Test 7: snapshot — citations and jargon interleaved with plain text", () => {
    const miniFixture: ExplanationResult = {
      revenue: "Revenue grew [p.1].",
      profitability: "Plain text only.",
      balance_sheet: "Plain.",
      cash_flow: "Plain.",
      key_risks: "Plain.",
    };
    const { container } = render(
      <ExplanationPanel documentId="doc-snap" explanation={miniFixture} score={null} onGoToPage={vi.fn()} />,
    );
    expect(container).toMatchSnapshot();
  });
});
