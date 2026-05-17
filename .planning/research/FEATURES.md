# Feature Research

**Domain:** AI-powered financial document explainer (IDX / Indonesian retail investing)
**Researched:** 2026-05-02
**Confidence:** HIGH (table stakes/differentiators), MEDIUM (Indonesian-specific gap analysis)

---

## Landscape Survey

This research covers four ecosystems and maps their lessons to Clarifin's specific wedge:
*"Explain an IDX financial document in plain English to a financially-illiterate but intelligent Indonesian professional."*

| Ecosystem | Key Lesson | Gap Clarifin Exploits |
|-----------|-----------|----------------------|
| AI doc-chat (ChatPDF, NotebookLM, Humata, Adobe Acrobat AI) | Citation UX and single-doc Q&A are table stakes; users expect click-to-jump to source page | None of these understand IDX documents, IDR financials, Bahasa Indonesia filings, or Indonesian market context |
| AI financial analysis (FinChat, Quartr, Brightwave, AlphaSense) | Sentence-level citations, structured scoring, side-by-side doc viewer are the standard | All target finance professionals; zero beginner explanation layer; no IDX coverage |
| Score/insight visualization (Simply Wall St Snowflake) | Multi-dimension visual score with binary pass/fail sub-checks builds trust; "not a recommendation" label is standard | Simply Wall St doesn't explain source documents; IDX coverage is thin |
| IDX retail apps (Stockbit, RTI Business, Ajaib, IPOT, Bibit) | Comprehensive ratio data exists; community-driven; technically capable | None explain what the numbers mean; all assume user already knows finance; all Bahasa-first |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume any doc-analysis tool has. Missing these = product feels broken before it starts.

| Feature | Why Expected | Serves Core Wedge? | Complexity | Notes |
|---------|--------------|-------------------|------------|-------|
| PDF upload from local file | Every AI doc tool starts here; basic entry point | YES — upload is the entry ritual | S | Drag-and-drop + click-to-browse; handle files up to ~20MB; PDF only for v1 |
| Loading / processing feedback | Users abandon if they don't see progress after upload | YES — first moment of trust | S | Progress bar or spinner with "Analyzing document…" copy; processing can take 10-30s for large PDFs |
| Auto-detected document summary | After upload, users want "what did AI find?" before they dig in | YES — first value delivery moment | M | Single-screen overview: company name/ticker detected, document type (annual report / quarterly / balance sheet), period covered |
| Plain-English explanation of document contents | Core of every AI doc tool; users expect a readable summary | YES — this is the entire product | L | Sections: key financials, balance sheet health, profitability, cash flow narrative; aim for <5 min reading time |
| Page-level citations on all factual claims | The #1 trust mechanism in AI doc tools (ChatPDF, NotebookLM, Humata, Quartr all do this) | YES — non-negotiable for credibility | M | Every numerical claim, every "the company says…" must show [p. N]; missing citations = hallucination fear |
| Click-to-jump citation navigation | Users click [p. 12] and see that page — standard in Quartr, NotebookLM | YES — validates the explanation | M | Split-pane (PDF right, analysis left) or modal overlay; NotebookLM benchmark: hover = preview, click = navigate |
| Chat / follow-up Q&A on the document | Expected by any user who has used ChatPDF, NotebookLM, or Claude's PDF mode | YES — handles the long tail of questions explanation doesn't cover | L | Must be grounded (answers cite pages, not hallucinated); chat history preserved per session |
| "Not financial advice" disclosure | Legally and ethically non-negotiable; users understand and expect it in fintech AI tools | YES — contextual, not alarming | S | Inline micro-labels ("AI analysis · not financial advice") near each AI-generated block; NOT a popup wall |
| Mobile-readable layout | Most Indonesian users are mobile-first even if desktop is primary | YES — accessibility for the persona | M | Responsive but desktop-first; chat and split-pane can degrade gracefully on mobile |
| Error states and empty states | Users need to know when upload fails, when parsing succeeds but finds nothing, when PDF is not a financial document | YES — builds trust by being honest | S | "Couldn't find financial statements in this document. Is this a financial filing?" pattern |

### Differentiators (Competitive Advantage)

Features where Clarifin is genuinely different. These map directly to the wedge.

| Feature | Value Proposition | Serves Core Wedge? | Complexity | Notes |
|---------|-------------------|-------------------|------------|-------|
| **Bahasa Indonesia → English financial translation** | IDX documents, especially mid/small-cap, are often fully in Bahasa. No existing consumer tool handles this accurately with financial vocabulary. | YES — the #1 technical wedge | XL | Requires: LLM with strong Bahasa-to-English financial vocab; early eval set of 20+ IDX documents; validate on real filings before launch |
| **Beginner-first explanation register** | All competitors assume finance literacy. Clarifin writes as if the reader has never seen a P/E ratio. | YES — core positioning | L | Each financial term explained inline on first use; analogies from everyday life ("revenue is what you earned before paying bills"); no jargon without definition |
| **Inline jargon glossary / tooltips** | When a term like "EBITDA" or "Current Ratio" appears, users can hover/tap for a 1-sentence plain-English definition | YES — reduces friction for the persona | M | Dictionary of ~100 Indonesian financial terms + universal finance terms; context-sensitive |
| **Holistic AI score (1-10) with reasoning** | Simply Wall St Snowflake equivalent, but built for IDX documents, beginner audience, and from the uploaded source doc | YES — gives users a quick verdict before deep-diving | L | 4-dimension breakdown: Profitability health, Balance-sheet strength, Growth trend, Valuation context; each dimension: 1-sentence plain-English rationale; score labeled "AI opinion" |
| **Score dimension drill-down** | User can tap/click a score dimension (e.g., "Balance Sheet: 6/10") and see which specific facts from the document drove that rating | YES — builds trust in the score | M | "Why did we give this a 6?" → shows 2-3 bullet points with page citations |
| **Multi-year financial trend chart** | Revenue, net income, margins over 3-5 years, built from data extracted from the uploaded document | YES — context that Stockbit shows as raw numbers; Clarifin shows with narrative | M | Simple line/bar chart; annotated with significant events if detectable; Recharts or similar |
| **Sector comparison context** | "This P/E of 12x is below the IDX consumer staples sector average of 18x" — grounded in free data | YES — answers "is this good or bad?" which beginners always ask | M | Yahoo Finance `.JK` ticker; free, delayed; sector averages from IDX sector classifications |
| **IDX-specific financial vocabulary awareness** | Indonesian companies use specific Indonesian accounting terms (PSAK vs IFRS), Indonesian tax structures (PPh 21/25), etc. | YES — no competitor handles this | L | Requires IDX-specific prompt engineering; test against BBCA, TLKM, GOTO, and 5 mid-cap filings |
| **Transparent AI labeling throughout** | Every AI-generated paragraph is visually distinguished from quoted-from-document facts | YES — fundamental to trust architecture | S | Visual treatment: "Quoted from document [p.12]" vs "AI interpretation ·" label in UI |

### Anti-Features (Deliberately NOT Building)

Features that seem natural to request but are explicitly out of scope, with reasons.

| Feature | Why It Gets Requested | Why We're NOT Building It | What We Do Instead |
|---------|----------------------|--------------------------|-------------------|
| **Buy / sell recommendation ("Should I buy?")** | Users naturally want a verdict after reading analysis | Regulatory line (OJK); ethical responsibility; AI analysis ≠ investment advice; destroys trust if wrong | Score shows financial document quality; disclaimer: "This tells you about the document, not whether to buy" |
| **Auto-fetch IDX filings by ticker** | Frictionless alternative to upload; saves 30 seconds | Requires scraping idx.co.id (legal gray area); brittle; different IR page structures per company; delay v1 indefinitely | Upload-first is fine for v1; users who found this product are willing to upload |
| **Real-time or live stock price feed** | Users want to see current price alongside analysis | Paid data feeds; delayed data fine for research; real-time creates live-trading mental model that conflicts with "sit-down research" positioning | Yahoo Finance delayed price via `.JK` suffix is sufficient; clearly labeled "Delayed" |
| **Technical analysis (RSI, MACD, candlesticks, Bandarmology)** | Power users of Stockbit Pro will ask for this | Different mental model (trader vs fundamental investor); out of scope by design; misleads the beginner persona | Explicit copy: "Clarifin is for fundamental analysis. For charts and technical indicators, use Stockbit." |
| **Multi-stock comparison side-by-side** | Investors often compare 2-3 stocks | Multiplies document-handling complexity; UX becomes unwieldy for beginners; scope creep | Competitor context comes via sector benchmarks, not user-uploaded peer comparison |
| **Portfolio tracking / watchlists / alerts** | Users will naturally want to "save" analysis results | Portfolio management is a different product category; creates retention hooks that distract from core mission | Session history (what I've analyzed) is fine; not portfolio management |
| **Social / community features (sharing, comments, "what do others think?")** | Indonesian investors are community-driven (Stockbit's moat is social) | Building community takes years; our wedge is explanation quality, not social proof | Private sessions; optional share-link of analysis output only |
| **DCF or complex valuation models** | Sophisticated users want intrinsic value calculation | Too complex for beginner audience; DCF requires many assumptions the user can't verify from one document; creates false precision | Light valuation context: current P/E, P/B, dividend yield vs sector median |
| **Bahasa Indonesia UI** | Indonesia is primarily Bahasa-speaking | The persona is English-fluent specifically; English UI is the wedge; bilingual UI doubles content maintenance | English-only v1 with a clear positioning statement; ID UI is a future expansion if traction confirms |
| **Native mobile app (iOS/Android)** | Indonesian retail investors are mobile-first | Desktop-first product is a deliberate design choice ("sit-down research session"); native app is huge scope increase | Responsive web that works on mobile; desktop experience is primary |
| **Paywalls / gated features** | Monetization | Side project v1; paywalls kill early adoption and experimentation; no commercial pressure | Fully open for v1; rate-limiting only (e.g., 5 uploads/day per IP) if abuse appears |
| **Multi-user accounts / teams** | Enterprise use cases | Single-user product; teams add auth complexity, permissions, sharing workflows | No auth for v1; revisit at v2 if enterprise interest emerges |

---

## Feature Dependencies

```
[PDF Upload & Processing]
    └──required by──> [Plain-English Explanation]
    └──required by──> [Page-Level Citations]
    └──required by──> [AI Score + Reasoning]
    └──required by──> [Chat / Q&A]
    └──required by──> [Multi-Year Trend Chart]

[Plain-English Explanation]
    └──required by──> [Chat / Q&A]  (chat is follow-up to explanation)
    └──required by──> [AI Score Drill-Down]

[Page-Level Citations]
    └──required by──> [Click-to-Jump Navigation]
    └──required by──> [Chat / Q&A]  (cited answers depend on citations infrastructure)

[AI Score + Reasoning]
    └──required by──> [Score Dimension Drill-Down]

[Ticker / Company Detection]
    └──required by──> [Sector Comparison Context]  (need ticker to fetch Yahoo Finance data)
    └──required by──> [Multi-Year Trend Chart]  (prior-period data from external source)

[Inline Jargon Glossary]
    └──enhances──> [Plain-English Explanation]
    └──enhances──> [Chat / Q&A]

[Sector Comparison Context]
    └──enhances──> [AI Score + Reasoning]  (valuation dimension uses sector benchmarks)
```

### Dependency Notes

- **PDF Upload must precede everything:** All features depend on successful PDF parsing with page-boundary preservation. If parsing fails, nothing else works. This is the highest-risk infrastructure step.
- **Citations infrastructure enables Chat:** The chat grounding layer (ensuring chat answers cite pages, not hallucinate) reuses the same citation infrastructure as the explanation. Build citations once, use everywhere.
- **Ticker detection unlocks data features:** Sector comparison, delayed price, and multi-year prior-period enrichment all require knowing the company. Ticker detection from the document (or manual entry) is a prerequisite gate.
- **Score drill-down requires score:** Phase ordering must build AI score first, then add drill-down as an enhancement layer.
- **Jargon tooltips are independent:** Can be shipped as a simple frontend feature (hover-to-define) without backend changes. Dictionary can be a static JSON file.

---

## UX Pattern Deep-Dives

### Citation UX: Best-in-Class Patterns

Based on survey of ChatPDF, NotebookLM, Quartr, Brightwave, Adobe Acrobat AI, and UX pattern research (ShapeOfAI citations patterns, 2025):

| Pattern | Description | Used By | Recommendation |
|---------|-------------|---------|---------------|
| **Inline superscript [N]** | Citations appear as numbered superscripts inline in text | ChatPDF, NotebookLM | ✅ Use this as base layer |
| **Hover preview** | Hovering [N] shows a popover with the exact quoted text from the source page | NotebookLM, Granola | ✅ Add as enhancement; high trust signal |
| **Click-to-jump** | Clicking [N] scrolls the PDF viewer to that exact page and highlights the relevant passage | Quartr, Adobe Acrobat, NotebookLM | ✅ Must have; this is the "prove it" moment |
| **Split-pane layout** | Chat/explanation on left; PDF viewer on right | Quartr Pro, Adobe Acrobat | ✅ Best for desktop; gracefully degrades to tab-switch on mobile |
| **Source metadata in citation** | [p. 42 · Balance Sheet] tells user the section too, not just the page | Brightwave (sentence-level citations) | ✅ Add section label where extractable |
| **Inline quotation block** | Pull the actual quoted sentence from the source into the explanation | Granola, AlphaSense | Consider for key facts in the explanation summary |

**Recommended citation UX for Clarifin:**
1. Inline `[p. N]` superscripts in all AI-generated text.
2. Hover on `[p. N]` → popover with the quoted sentence from that page.
3. Click `[p. N]` → PDF viewer panel jumps to that page and highlights the passage.
4. Split-pane on desktop (explanation left, PDF right); tab-switch on mobile.
5. Chat answers follow the same pattern — all grounded answers show `[p. N]` inline.

**What to avoid:**
- Footnote-only citations at the bottom of a long explanation (users don't scroll back to verify)
- Document-level citations ("source: annual-report.pdf") without page precision
- Citations on every word (visual noise) — one citation per factual claim is right

---

### Score Presentation: Best-in-Class Patterns

Based on Simply Wall St Snowflake analysis and AI scoring visualization research:

| Element | Simply Wall St Approach | Recommendation for Clarifin |
|---------|------------------------|----------------------------|
| **Dimensions** | 5 dimensions: Valuation, Future Growth, Past Performance, Financial Health, Dividend | 4 dimensions: Profitability, Balance Sheet Health, Growth Trend, Valuation Context |
| **Sub-checks** | 6 binary pass/fail checks per dimension | 3-5 evidence items per dimension from the document (not binary — weighted by AI) |
| **Visual metaphor** | Radar chart "snowflake" that grows as score improves | Score gauge (1-10) with 4 dimension cards below; each card color-coded red→amber→green |
| **Color coding** | Red (low) → orange → yellow → green (high) | Same: red (1-4) → amber (5-6) → green (7-10) |
| **"Not a recommendation" label** | Prominent disclaimer on every snowflake | "AI opinion · not financial advice" label next to every score; on hover: tooltip explaining what it is |
| **Drill-down** | Expand to see which sub-checks passed/failed | Click dimension card → expands to show 2-3 document quotes with `[p. N]` that drove the rating |
| **Open methodology** | Published model on GitHub | Link to a plain-English "How we score" page |
| **Score range context** | Color coding is self-explanatory | Add a sentence: "7/10 — Healthy financials with some leverage concerns" |

**Score labeling best practice:**
- Label the number: "Holistic Score" not just "Score" (avoids confusion with price)
- Always show the breakdown — a single 7/10 number without explanation feels arbitrary; 4 dimension cards build trust
- "Why this score" is the most important UX element — users don't trust black-box scores

---

### Explanation Density: Right Level for the Persona

Based on Silmarl, Veilscope, and AI financial explanation research:

| Signal | Finding | Implication |
|--------|---------|-------------|
| Silmarl: 47,000-word 10-K → <60 second read | Users want aggressive summarization | Keep overall explanation to 800-1,200 words for a full annual report |
| Veilscope: "risk scorecard" with plain-English categories | Structured sections beat free-form prose | Use named sections: Revenue, Profitability, Balance Sheet, Cash Flow, Key Risks |
| Simply Wall St: "a company with a lower PE than peers" | Context comparisons in plain English | Always explain ratios relative to something: "compared to sector," "vs. last year" |
| Persona: "read financial jargon, bounced" | Dense is bad; but too thin loses credibility | Aim for smart-friend-explaining-at-dinner density, not analyst-report density |

**Recommended explanation structure per document section:**
1. **Lead sentence** (what this section shows in one sentence — no jargon)
2. **2-3 key findings** (bullet points; each has a `[p. N]` citation; numbers in plain English: "Revenue grew 23% to Rp 4.2 trillion")
3. **What this means** (1-2 sentences of AI interpretation, visually labeled as AI commentary)
4. **Jargon encountered** (if section uses terms like EBITDA, Current Ratio — tooltip appears automatically)

Total explanation target: 5-8 minutes reading time for a 200-page annual report. 2-3 minutes for a quarterly filing. Users should feel "I understand this company" not "I read all the details."

---

### Onboarding Flow: Upload-Then-Analyze Pattern

Based on survey of ChatPDF, Humata, Silmarl, and document intelligence pipeline research:

**Recommended flow for Clarifin:**

```
[Landing page with clear value prop]
    → "Upload an IDX financial document to understand it in plain English"
    → [Drag-and-drop upload zone — large, prominent, no login required]

[Upload triggered]
    → Immediate feedback: "Uploading… 43%" (progress bar)
    → Processing: "Analyzing your document… extracting financials…"
    → ~10-30s processing (show progress copy; don't show spinner-only — users abandon)

[Processing complete]
    → Auto-detect: "Detected: Bank BCA (BBCA) · Annual Report 2024"
    → [Confirm or correct ticker/company name — simple text field]

[Analysis revealed]
    → Hero: AI Score (1-10 with 4 dimension breakdown)
    → Below: Section-by-section plain-English explanation with inline citations
    → Sidebar/sticky: PDF viewer (split-pane on desktop)
    → Bottom: Chat input pre-seeded with suggested questions:
       "What were the biggest risks mentioned?"
       "How did revenue change compared to last year?"
       "Is the debt level concerning?"
```

**Key onboarding UX principles:**
- No login for v1 (reduces friction to zero)
- First interaction = instant value (explanation loads without user asking for it)
- Seeded chat questions reduce "blank prompt" paralysis for beginners
- Error copy is friendly: "We couldn't find financial statements in this document — is this a financial filing? Try a balance sheet, income statement, or annual report."

---

### Disclaimer UX: Non-Alarming But Present

Based on fintech disclaimer research (Intuit, Singapore MAS framework, AI trust research):

**What works:**
- **Inline micro-label** near each AI-generated block: small gray text "AI analysis · not financial advice"
- **Tooltip on hover**: explains in 1-2 sentences what "AI analysis" means and what the user should do to verify
- **One-time contextual prompt** on first session: "Clarifin explains financial documents. It doesn't tell you whether to buy or sell. Always verify important numbers in the original document." (then dismissible)
- **Score-specific disclaimer**: next to the 1-10 score: "This score reflects document quality, not a buy/sell recommendation"

**What doesn't work:**
- Full-page modal disclaimers before viewing content (kills experience, users stop reading after 3 words)
- Repeated pop-ups (users click through without reading)
- Legalese in disclaimers (users don't read it anyway, and it feels scary)
- Hiding disclaimers in footer (regulatory risk; must be visible)

**Formula (from research):** Trust = Transparency + Guidance - Drama

---

## MVP Definition

### Launch With (v1)

The minimum required to deliver "make IDX financial documents understandable."

- [ ] **PDF upload** (drag-and-drop, up to ~20MB, PDF only) — gateway to everything
- [ ] **Document parsing with page boundary preservation** — required for citations
- [ ] **Auto-detect company/ticker** (or manual entry fallback) — needed for sector context
- [ ] **Plain-English explanation** (5 structured sections: Revenue, Profitability, Balance Sheet, Cash Flow, Key Findings) — the core value
- [ ] **Page-level citations [p. N] on all factual claims** — non-negotiable trust mechanism
- [ ] **Click-to-jump PDF viewer** (split-pane on desktop, tab-switch fallback on mobile) — proves citations
- [ ] **Hover citation preview** (popover with source quote) — completes the trust loop
- [ ] **Bahasa Indonesia → English translation** for Bahasa source documents — the primary technical wedge
- [ ] **Inline jargon tooltips** (hover/tap term → 1-sentence plain-English definition) — serves the beginner persona
- [ ] **AI holistic score (1-10)** with 4-dimension breakdown and rationale — quick verdict for time-strapped users
- [ ] **Score dimension drill-down** (click dimension → see document evidence with citations) — builds score trust
- [ ] **Delayed stock price + P/E, P/B, dividend yield** via Yahoo Finance `.JK` — sector context
- [ ] **Multi-year revenue/net income trend chart** (from extracted document data) — visual context
- [ ] **Chat / follow-up Q&A** (grounded, cited answers) — handles questions the explanation doesn't cover
- [ ] **Inline "AI analysis · not financial advice" labels** — non-negotiable for compliance
- [ ] **Loading states and error states** with friendly copy — basic quality bar

### Add After Validation (v1.x)

Add when v1 shows traction and specific user feedback emerges.

- [ ] **Saved session history** (browser localStorage, no auth required) — "go back to that BBCA analysis"
- [ ] **Suggested follow-up questions** seeded in chat at session start — reduces beginner blank-prompt anxiety
- [ ] **Share link** for a read-only view of analysis output — organic distribution
- [ ] **Sector comparison table** (company ratios vs sector median, 5 peers) — richer context than current single-line comparison
- [ ] **Auto-fetch prior-period data** for multi-year charts (supplement what's in the uploaded doc)
- [ ] **"How we score" methodology page** — transparency for skeptics and power users

### Future Consideration (v2+)

Defer until product-market fit is confirmed and the core is solid.

- [ ] **Auto-fetch IDX filings by ticker** from idx.co.id — frictionless alternative to upload; requires scraping infra
- [ ] **Bahasa Indonesia UI** — expand from English-fluent persona to full Indonesian market
- [ ] **Multi-document analysis** (upload Q1 + Q2 + Q3 + annual and analyze together) — richer longitudinal view
- [ ] **User accounts + saved analysis library** — if users want to return across sessions
- [ ] **Native mobile app** — if mobile usage patterns from analytics justify it
- [ ] **Email digest** of new filings for tracked companies — crosses into portfolio-management territory; revisit at v2

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PDF upload + parsing | HIGH | LOW | P1 |
| Plain-English explanation | HIGH | HIGH | P1 |
| Page-level citations | HIGH | MEDIUM | P1 |
| Click-to-jump PDF viewer | HIGH | MEDIUM | P1 |
| Bahasa Indonesia → English translation | HIGH | XL (validation-heavy) | P1 |
| Inline jargon tooltips | HIGH | LOW | P1 |
| AI score (1-10) + dimension breakdown | HIGH | HIGH | P1 |
| Chat / follow-up Q&A (grounded) | HIGH | HIGH | P1 |
| Not-financial-advice inline labels | HIGH | LOW | P1 |
| Loading + error states | MEDIUM | LOW | P1 |
| Hover citation preview | MEDIUM | LOW | P1 |
| Score dimension drill-down | MEDIUM | MEDIUM | P2 |
| Multi-year trend chart | MEDIUM | MEDIUM | P2 |
| Delayed price + ratio context | MEDIUM | LOW | P2 |
| Ticker auto-detection | MEDIUM | MEDIUM | P2 |
| Suggested chat questions (seeded) | MEDIUM | LOW | P2 |
| Sector comparison context | LOW | MEDIUM | P3 |
| Saved session history | LOW | LOW | P3 |
| Share link | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch — missing these = product doesn't work
- P2: Should have — missing these = product feels incomplete
- P3: Nice to have — adds polish; add when P1+P2 are solid

---

## Competitor Feature Analysis

| Feature | ChatPDF / Humata / NotebookLM | Stockbit Pro / RTI Business | Quartr / Brightwave | **Clarifin (our approach)** |
|---------|-------------------------------|------------------------------|--------------------|-----------------------------|
| PDF upload | ✅ Core feature | ❌ No upload | ✅ Upload + database | ✅ Upload-first |
| Plain-English explanation | ⚠️ Generic summarization; not finance-aware | ❌ Raw numbers, no explanation | ❌ Finance-professional output | ✅ Beginner-first, IDX-aware |
| Page citations | ✅ Page numbers | ❌ N/A | ✅ Sentence-level | ✅ Page citations + hover preview |
| Click-to-jump to source | ✅ Basic | ❌ N/A | ✅ Side-by-side | ✅ Split-pane on desktop |
| Chat / Q&A | ✅ Core feature | ❌ None | ✅ Core feature | ✅ Grounded Q&A |
| Bahasa Indonesia support | ⚠️ Token-level but no financial vocab awareness | ✅ Native Bahasa UI | ❌ English-only | ✅ **Key wedge — ID→EN financial translation** |
| Holistic AI score | ❌ None | ⚠️ Ratio data only, user must interpret | ❌ None | ✅ 1-10 score with rationale |
| Beginner jargon handling | ❌ Assumes literacy | ❌ Assumes literacy | ❌ Assumes literacy | ✅ **Key wedge — inline tooltips + plain-English register** |
| IDX-specific context | ❌ None | ✅ IDX-native | ❌ No IDX coverage | ✅ IDX-specific prompt engineering |
| Stock price / ratio context | ❌ None | ✅ Real-time data | ✅ Earnings data | ✅ Delayed via Yahoo Finance |
| Multi-year trend charts | ❌ None | ✅ 10-year historical | ✅ Yes | ✅ From document data + enrichment |
| Not-financial-advice labeling | ⚠️ Minimal | ❌ None | ✅ Enterprise disclaimers | ✅ Inline micro-labels throughout |

---

## Sources

- **AI doc-chat landscape**: ChatPDF review (aipedia.wiki, April 2026); Atlas Workspace AI PDF tool comparison; aiflowreview.com Best AI PDF Chat Tools 2026; Humata AI Review (computertech.co, 2026)
- **Citation UX patterns**: ShapeOfAI Citation Patterns (shapeof.ai/patterns/citations); Glean Deep Linked Citations developer guide; DevRev inline citations documentation; Lampi granular citations blog
- **Score visualization**: Simply Wall St Snowflake documentation (support.simplywall.st); SimplyWallSt open-source model (github.com/SimplyWallSt); AI confidence visualization patterns (aiuxdesign.guide)
- **AI financial analysis tools**: Brightwave docs (docs.brightwave.io); Quartr Pro 2025 key updates (quartr.com); FinChat review (aichief.com); AlphaSense vs Simply Wall St comparison (findmymoat.com)
- **Beginner financial explainers**: Silmarl (silmarl.com); Veilscope (veilscope.tech); DocTalk (doctalk.site); pdf.ai financial statement analysis guide
- **Indonesian investing apps**: Stockbit Pro features (stockbit.com/info/pro-tools, help.stockbit.com); Bibit product teardown (nextsprints.com); Stockbit product teardown (nextsprints.com); Indonesian investment app comparison (hosteko.com)
- **Indonesian market data**: IDX investor count reaching 19M (en.tempo.co, 2025); Jakarta Daily retail investor base 2025
- **Disclaimer UX**: Quaxel AI Disclaimers article (medium.com); Intuit Content Design AI UX Patterns (contentdesign.intuit.com/ai/ux-patterns); procreator.design AI finance app design practices
- **Explanation density**: v7labs financial statement analysis guide; emergewithai.com AI financial analysis guide 2025

---
*Feature research for: AI-powered IDX financial document explainer (Clarifin)*
*Researched: 2026-05-02*
