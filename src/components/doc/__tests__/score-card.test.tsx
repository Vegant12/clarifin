import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ScoreCard } from "../score-card";
import type { ScoreResult } from "@/lib/explain/score-schema";

const fixture: ScoreResult = {
  overall_score: 7,
  dimensions: [
    { name: "Profitability", score: 8, reasoning: "Margins are stable year over year.",
      snippets: [{ text: "Net profit rose 12% to Rp 48 triliun.", page: 47 }] },
    { name: "Balance Sheet", score: 7, reasoning: "Current ratio is healthy.",
      snippets: [{ text: "Current ratio 1.8 vs sector 1.5.", page: 23 }] },
    { name: "Growth Trend", score: 6, reasoning: "Revenue grew 8% CAGR over 3 years.",
      snippets: [{ text: "Revenue Rp 100T to Rp 125T (2021-2023).", page: 12 }] },
    { name: "Valuation Context", score: 5, reasoning: "P/E above sector median.",
      snippets: [{ text: "P/E ratio 18x vs sector 14x.", page: 89 }] },
  ],
};

describe("ScoreCard", () => {
  afterEach(() => {
    cleanup();
  });
  it("SCORE-06: renders 'AI Assessment · not financial advice' disclaimer", () => {
    render(<ScoreCard documentId="doc-1" score={fixture} onGoToPage={() => {}} />);
    expect(screen.getByText("AI Assessment · not financial advice")).toBeDefined();
  });
  it("SCORE-06: disclaimer is in the same parent block as the score number", () => {
    render(<ScoreCard documentId="doc-1" score={fixture} onGoToPage={() => {}} />);
    const scoreEl = screen.getByLabelText("Overall AI assessment score: 7 out of 10");
    const disclaimerEl = screen.getByText("AI Assessment · not financial advice");
    expect(scoreEl.parentElement).toBe(disclaimerEl.parentElement);
  });
  it("SCORE-01: renders overall_score number", () => {
    render(<ScoreCard documentId="doc-1" score={fixture} onGoToPage={() => {}} />);
    expect(screen.getByLabelText("Overall AI assessment score: 7 out of 10")).toBeDefined();
  });
  it("SCORE-02: renders all 4 dimension names", () => {
    render(<ScoreCard documentId="doc-1" score={fixture} onGoToPage={() => {}} />);
    for (const n of ["Profitability", "Balance Sheet", "Growth Trend", "Valuation Context"]) {
      expect(screen.getByText(n)).toBeDefined();
    }
  });
  it("SCORE-02: renders [N/10] chips for each dimension", () => {
    render(<ScoreCard documentId="doc-1" score={fixture} onGoToPage={() => {}} />);
    expect(screen.getByText("[8/10]")).toBeDefined();
    expect(screen.getByText("[7/10]")).toBeDefined();
    expect(screen.getByText("[6/10]")).toBeDefined();
    expect(screen.getByText("[5/10]")).toBeDefined();
  });
  it("SCORE-04: clicking a dimension reveals snippet text", async () => {
    const user = userEvent.setup();
    const goToPage = vi.fn();
    render(<ScoreCard documentId="doc-1" score={fixture} onGoToPage={goToPage} />);
    const trigger = screen.getByLabelText("Expand Profitability details");
    await user.click(trigger);
    expect(await screen.findByText(/Net profit rose 12%/)).toBeDefined();
  });
});
