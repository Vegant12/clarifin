import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ChartDataPoint } from "@/lib/stock/stock-schema";

import { TrendChartCard } from "./trend-chart-card";

afterEach(() => {
  cleanup();
});

const FIXTURE: ChartDataPoint[] = [
  { year: "2021", revenue: 80_000_000_000_000, netIncome: 14_400_000_000_000, netMarginPct: 18.0 },
  { year: "2022", revenue: 95_000_000_000_000, netIncome: 17_575_000_000_000, netMarginPct: 18.5 },
  { year: "2023", revenue: 110_000_000_000_000, netIncome: 21_450_000_000_000, netMarginPct: 19.5 },
];

describe("TrendChartCard (Phase 9, CHART-01/02)", () => {
  it("renders without crashing with 3-year fixture", () => {
    const { container } = render(<TrendChartCard ticker="BBCA" data={FIXTURE} />);
    expect(container.querySelector('[aria-label="Financial Trend"]')).not.toBeNull();
  });

  it("renders title 'Financial Trend'", () => {
    render(<TrendChartCard ticker="BBCA" data={FIXTURE} />);
    expect(screen.getByText("Financial Trend")).toBeInTheDocument();
  });

  it("renders subtitle with ticker and year range", () => {
    render(<TrendChartCard ticker="BBCA" data={FIXTURE} />);
    // Subtitle: "(BBCA · 2021–2023)" — match flexibly on the substring
    expect(screen.getByText(/BBCA\s*·\s*2021\s*[–-]\s*2023/)).toBeInTheDocument();
  });

  it("renders aria-label on the outer section", () => {
    const { container } = render(<TrendChartCard ticker="BBCA" data={FIXTURE} />);
    expect(container.querySelector('section[aria-label="Financial Trend"]')).not.toBeNull();
  });

  it("renders a Recharts surface element (svg) inside ResponsiveContainer", () => {
    // jsdom doesn't lay out, but Recharts still creates the wrapper div.
    // ResponsiveContainer renders a div with class 'recharts-responsive-container'.
    const { container } = render(<TrendChartCard ticker="BBCA" data={FIXTURE} />);
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });
});
