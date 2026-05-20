import { describe, it } from "vitest";

// ExplanationPanel will gain ticker/stockData/chartData/stockError props in Plan 04
// import { ExplanationPanel } from "./explanation-panel";

describe("ExplanationPanel — Phase 9 stock + chart slots", () => {
  it.todo("renders nothing in the stock slot when ticker === null");
  it.todo("renders 'Market data temporarily unavailable.' when stockError === true (STOCK-03)");
  it.todo("renders <StockWidget> when stockData is non-null and ticker is non-null");
  it.todo("renders <TrendChartCard> only when chartData has length > 0 (CHART-01 null-guard)");
  it.todo("renders no chart card when chartData is null or empty array (D-02)");
  it.todo("preserves existing ScoreCard + SECTION_ORDER rendering (Phase 7/8 regression guard)");
});
