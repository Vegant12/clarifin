import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});

import type { StockData } from "@/lib/stock/stock-schema";

import { StockWidget } from "./stock-widget";

function makeData(overrides: Partial<StockData["quote"]> = {}): StockData {
  return {
    ticker: "BBCA",
    quote: {
      price: 9275,
      pe: 12.4,
      pb: 1.8,
      dividendYieldPct: 3.2,
      ...overrides,
    },
    history: [],
    fetchedAt: "2026-05-19T08:30:00.000Z",
  };
}

describe("StockWidget (Phase 9, STOCK-01/02/04)", () => {
  it("renders the ticker in uppercase", () => {
    render(<StockWidget ticker="BBCA" data={makeData()} />);
    expect(screen.getByText("BBCA")).toBeInTheDocument();
  });

  it("renders the IDX label", () => {
    render(<StockWidget ticker="BBCA" data={makeData()} />);
    expect(screen.getByText("IDX")).toBeInTheDocument();
  });

  it("renders Price formatted via formatIDR", () => {
    render(<StockWidget ticker="BBCA" data={makeData({ price: 9275 })} />);
    // formatIDR(9275) → "Rp 9.275" (id-ID locale uses '.' as thousand sep)
    expect(screen.getByText(/Rp\s*9\.275/)).toBeInTheDocument();
  });

  it("renders P/E with '×' suffix", () => {
    render(<StockWidget ticker="BBCA" data={makeData({ pe: 12.4 })} />);
    expect(screen.getByText("12.4×")).toBeInTheDocument();
  });

  it("renders P/B with '×' suffix", () => {
    render(<StockWidget ticker="BBCA" data={makeData({ pb: 1.8 })} />);
    expect(screen.getByText("1.8×")).toBeInTheDocument();
  });

  it("renders Div. Yield with '%' suffix", () => {
    render(<StockWidget ticker="BBCA" data={makeData({ dividendYieldPct: 3.2 })} />);
    expect(screen.getByText("3.2%")).toBeInTheDocument();
  });

  it("renders '—' when a metric value is null", () => {
    render(<StockWidget ticker="BBCA" data={makeData({ pe: null })} />);
    // At least one em-dash should appear (the P/E cell)
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all four metric labels", () => {
    render(<StockWidget ticker="BBCA" data={makeData()} />);
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("P/E")).toBeInTheDocument();
    expect(screen.getByText("P/B")).toBeInTheDocument();
    expect(screen.getByText("Div. Yield")).toBeInTheDocument();
  });

  it("has aria-label 'Market Data' on the outer section", () => {
    const { container } = render(<StockWidget ticker="BBCA" data={makeData()} />);
    expect(container.querySelector('[aria-label="Market Data"]')).not.toBeNull();
  });
});
