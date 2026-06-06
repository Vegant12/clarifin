---
status: partial
phase: 08-ai-score-drill-down
source: [08-VERIFICATION.md]
started: 2026-05-19T21:00:00Z
updated: 2026-05-19T21:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Score card renders correctly on a real document
expected: Accordion shows overall_score in 48px emerald, disclaimer beneath, 4 dimension rows — clicking a trigger expands snippets with [p.N] citations that scroll the PDF viewer; clicking another collapses the first
result: [pending]

### 2. Null score fallback visible
expected: When score_breakdown is null but document is ready, "AI Assessment unavailable" muted section renders above explanation sections
result: [pending]

### 3. Mobile layout (375px viewport)
expected: Full-width score card, tap-to-expand accordion, no horizontal overflow
result: [pending]

### 4. Keyboard accessibility
expected: Focus ring on accordion triggers, Enter/Space toggles, Arrow key navigation between dimensions
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
