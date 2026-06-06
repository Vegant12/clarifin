---
phase: 9
slug: stock-data-trend-chart
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run src/lib/stock/ src/lib/utils.test.ts src/components/doc/`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | STOCK-04 | — | formatIDR returns "Rp X triliun/miliar", never raw integer | unit | `pnpm test src/lib/utils.test.ts` | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 0 | TICKER-01 | — | detectTicker returns null on PSAK/IFRS/GAAP false positives | unit | `pnpm test src/lib/stock/detect-ticker.test.ts` | ❌ W0 | ⬜ pending |
| 9-01-03 | 01 | 0 | STOCK-03 | — | fetchStockData returns null (not throws) when yahoo-finance2 errors | unit (mocked) | `pnpm test src/lib/stock/fetch-stock-data.test.ts` | ❌ W0 | ⬜ pending |
| 9-01-04 | 01 | 0 | STOCK-01,STOCK-02 | — | StockWidget renders price/P/E/P/B/yield from props | unit (jsdom) | `pnpm test src/components/doc/stock-widget.test.tsx` | ❌ W0 | ⬜ pending |
| 9-01-05 | 01 | 0 | CHART-01 | — | TrendChartCard renders without crashing with valid chartData | unit (jsdom) | `pnpm test src/components/doc/trend-chart-card.test.tsx` | ❌ W0 | ⬜ pending |
| 9-01-06 | 01 | 0 | STOCK-03 | — | ExplanationPanel shows "Market data temporarily unavailable" on stockError | unit (jsdom) | `pnpm test src/components/doc/explanation-panel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/utils.test.ts` — stubs for STOCK-04 `formatIDR` + `formatIDRShort`
- [ ] `src/lib/stock/detect-ticker.test.ts` — stubs for TICKER-01 regex patterns and false-positive blocklist
- [ ] `src/lib/stock/fetch-stock-data.test.ts` — stubs for STOCK-03 error boundary (mocked yahoo-finance2)
- [ ] `src/components/doc/stock-widget.test.tsx` — stubs for STOCK-01, STOCK-02 rendering
- [ ] `src/components/doc/trend-chart-card.test.tsx` — stubs for CHART-01 rendering
- [ ] `src/components/doc/explanation-panel.test.tsx` — stubs for STOCK-03 fallback text, CHART-01 null-guard

*Wave 0: Install `yahoo-finance2` and `recharts` before any stubs can import them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ticker auto-detected from real BBCA annual report PDF | TICKER-01 | Requires real PDF upload flow end-to-end | Upload BBCA PDF; verify ticker chip shows "BBCA" without manual entry |
| StockWidget shows live delayed price for BBCA.JK | STOCK-01 | yahoo-finance2 is a live external call; cannot stub in CI | Trigger document analysis for BBCA; verify price panel appears |
| Trend chart renders with historical data from document | CHART-01 | Requires AI-extracted chartData from real document | Inspect ExplanationPanel in browser; verify multi-year chart renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
