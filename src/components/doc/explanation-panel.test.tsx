import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";

import { ExplanationPanel } from "./explanation-panel";

afterEach(() => {
  cleanup();
});

const EXPLANATION_FIXTURE: ExplanationResult = {
  revenue: "Revenue grew 10%. [p.5]",
  profitability: "Margins expanded. [p.6]",
  balance_sheet: "Strong equity. [p.7]",
  cash_flow: "Positive free cash flow. [p.8]",
  key_risks: "FX exposure. [p.9]",
};

const STOCK_DATA: StockData = {
  ticker: "BBCA",
  quote: { price: 9275, pe: 12.4, pb: 1.8, dividendYieldPct: 3.2 },
  history: [],
  fetchedAt: "2026-05-19T08:30:00.000Z",
};

const CHART_DATA: ChartDataPoint[] = [
  { year: "2021", revenue: 80_000_000_000_000, netIncome: 14_400_000_000_000, netMarginPct: 18.0 },
  { year: "2022", revenue: 95_000_000_000_000, netIncome: 17_575_000_000_000, netMarginPct: 18.5 },
  { year: "2023", revenue: 110_000_000_000_000, netIncome: 21_450_000_000_000, netMarginPct: 19.5 },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof ExplanationPanel>> = {}) {
  return render(
    <ExplanationPanel
      documentId="doc-1"
      explanation={EXPLANATION_FIXTURE}
      score={null}
      onGoToPage={() => {}}
      ticker={null}
      stockData={null}
      chartData={null}
      stockError={false}
      {...overrides}
    />,
  );
}

describe("ExplanationPanel — Phase 9 stock + chart slots", () => {
  it("renders nothing in the stock slot when ticker is null", () => {
    const { container } = renderPanel({ ticker: null });
    expect(container.querySelector('[aria-label="Market Data"]')).toBeNull();
    expect(screen.queryByText(/Market data temporarily unavailable/i)).toBeNull();
  });

  it("renders 'Market data temporarily unavailable.' when stockError=true", () => {
    renderPanel({ ticker: "BBCA", stockError: true, stockData: null });
    expect(
      screen.getByText("Market data temporarily unavailable."),
    ).toBeInTheDocument();
  });

  it("renders StockWidget when ticker + stockData are provided and stockError=false", () => {
    const { container } = renderPanel({
      ticker: "BBCA",
      stockData: STOCK_DATA,
      stockError: false,
    });
    expect(container.querySelector('[aria-label="Market Data"]')).not.toBeNull();
  });

  it("renders TrendChartCard when chartData has entries", () => {
    const { container } = renderPanel({
      ticker: "BBCA",
      stockData: STOCK_DATA,
      chartData: CHART_DATA,
    });
    expect(container.querySelector('[aria-label="Financial Trend"]')).not.toBeNull();
  });

  it("hides TrendChartCard when chartData is null (D-02)", () => {
    const { container } = renderPanel({
      ticker: "BBCA",
      stockData: STOCK_DATA,
      chartData: null,
    });
    expect(container.querySelector('[aria-label="Financial Trend"]')).toBeNull();
  });

  it("hides TrendChartCard when chartData is empty array (D-02)", () => {
    const { container } = renderPanel({
      ticker: "BBCA",
      stockData: STOCK_DATA,
      chartData: [],
    });
    expect(container.querySelector('[aria-label="Financial Trend"]')).toBeNull();
  });

  it("still renders all 5 explanation section headings (regression guard)", () => {
    renderPanel();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Profitability")).toBeInTheDocument();
    expect(screen.getByText("Balance Sheet")).toBeInTheDocument();
    expect(screen.getByText("Cash Flow")).toBeInTheDocument();
    expect(screen.getByText("Key Risks")).toBeInTheDocument();
  });
});
