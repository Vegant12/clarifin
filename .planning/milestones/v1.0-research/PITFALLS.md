# Pitfalls Research

**Domain:** AI-powered IDX financial document explainer for Indonesian retail investors
**Researched:** 2026-05-02
**Confidence:** HIGH (critical areas verified against multiple sources)

---

## Critical Pitfalls

### Pitfall 1: LLM Numerical Hallucination on Financial Tables

**Severity:** CRITICAL

**What goes wrong:**
LLMs invent, transpose, or scale numbers when summarizing financial tables. Common failure modes:
- **Scale errors**: Reporting Rp 12.5 billion when the source says Rp 12.5 trillion (off by 1,000x). FAITH benchmark shows that fixing scale errors alone in Llama-3.3-70B would improve accuracy from 37.0% to 57.7%.
- **Transposition**: Swapping two rows or two periods (e.g., 2023 revenue stated as 2022 value).
- **Multivariate calculation collapse**: Accuracy of most models drops to near 0% on calculations requiring 3+ financial figures. Claude Sonnet-4 achieves 95.6% on direct lookup but fails dramatically on multivariate tasks.
- **Stale context bleed**: When context window is large and earlier sections of the PDF contain similar numbers, the model cites the wrong instance.

**Why it happens:**
LLMs do not parse tables as structured data — they perceive tables as prose with spatial relationships. Number tokens are under-represented in training relative to prose. Free-tier models (Gemini 2.5 Flash) show markedly higher error rates on numerical reasoning than frontier models.

**How to avoid:**
1. **Extract tables as structured data first, then inject into prompt.** Never feed raw PDF text containing financial tables directly; pre-parse tables with pdfplumber or a dedicated table extractor and inject them as JSON/CSV with explicit row/column labels.
2. **Implement post-generation numeric verification**: After generation, extract all numeric claims and cross-verify against the structured JSON you already extracted. Flag mismatches for human review or regeneration.
3. **Use atomic claim decomposition** (FinGround approach): Break generated output into individual numeric claims and verify each against source data. At $0.003/query with an 8B verifier model, this is practical even at free-tier budgets.
4. **Prompt constraint**: Instruct the model explicitly: "Every number you state must come verbatim from the provided data. Do not calculate, infer, or aggregate unless explicitly asked."
5. **IDR unit normalization**: Standardize all numbers to a single unit (e.g., "in billions of IDR") before injecting into prompt to prevent scale confusion.

**Warning signs:**
- During eval, numbers don't match source PDF even once
- User feedback: "It said the wrong revenue number"
- Spot-checking 5 documents shows >10% numeric mismatch rate
- Model generates Rp figures without the "in millions" / "in billions" qualifier that appears in source tables

**Phase to address:** PDF Parsing & Ingestion phase (tables extracted as structured data); AI Explanation phase (numeric verification step); Eval phase (numeric accuracy as primary eval dimension)

---

### Pitfall 2: Indonesian Financial Vocabulary Mistranslation

**Severity:** CRITICAL

**What goes wrong:**
LLMs mis-translate or misinterpret Bahasa Indonesia accounting terms when source documents are in Indonesian. Specific failure modes identified for IDX financial documents:

- **False cognates**: "Beban" (expense/burden) may be translated as "burden" (emotionally loaded) instead of "expense." "Persediaan" = Inventory, not "preparation." "Piutang" = Receivables, not "debt of others."
- **Direction confusion**: "Kenaikan" (increase) vs. "Penurunan" (decrease) in cash flow statements can be inverted in prose summaries.
- **PSAK vs IFRS alignment**: Indonesia uses PSAK (Pernyataan Standar Akuntansi Keuangan), which partially diverges from IFRS. LLMs trained mostly on IFRS English documents may mismap PSAK-specific line items. E.g., "Penghasilan komprehensif lain" = Other Comprehensive Income, but the PSAK categorization of what goes there differs from IFRS.
- **Indonesian number-word confusion**: "Miliar" = Billion (10^9), NOT "millions" as false-cognate English readers assume. "Juta" = Million. Documents reporting in "miliar rupiah" need explicit handling.
- **Negative presentation**: Some Indonesian financial statements present expenses and losses as positive numbers in parentheses following Indonesian accounting convention — the model may misread these as positive cash flows.

**Why it happens:**
Training data for Indonesian financial documents is sparse relative to English SEC filings. The model relies on general Indonesian language understanding, which doesn't capture accounting-specific semantic precision. Mid/small-cap IDX companies often use Bahasa-only documents with no English parallel corpus.

**How to avoid:**
1. **Build a domain glossary**: Create a canonical Bahasa Indonesia → English financial term map (50-100 key terms) and inject it into every system prompt when processing Indonesian-language documents.
2. **Detect document language early**: Use langdetect or simple heuristic (presence of "Laporan Keuangan", "Laba Rugi") to flag Indonesian-language documents and apply the specialized prompt path.
3. **Number-unit normalization layer**: Before LLM sees numbers, run a preprocessing step that identifies the reporting unit from the document header ("disajikan dalam jutaan rupiah" = "amounts in millions of IDR") and standardizes all figures.
4. **Validate on bilingual documents first**: Several large-cap IDX companies (BBCA, TLKM, BBRI) publish bilingual annual reports. Use these for eval — the English side gives you the ground truth for every Indonesian term.

**Warning signs:**
- Test on a BBCA or TLKM bilingual report and find discrepancies between the AI's English output and the official English translation
- "Miliar" numbers appear as the wrong scale in output
- Parenthetical negative numbers appear as positive values in summary

**Phase to address:** Prompt Engineering phase (glossary injection, language detection); Eval phase (bilingual document comparison tests)

---

### Pitfall 3: PDF Parsing Failures on IDX Documents

**Severity:** CRITICAL

**What goes wrong:**
IDX financial documents have several layout patterns that break naive PDF parsers:

1. **Multi-column layouts**: Annual reports commonly use 2-column layouts for management discussion sections. Naive text extraction reads across columns, creating incoherent prose. pdfplumber's default extraction merges columns when whitespace is insufficient.
2. **Embedded financial tables with invisible borders**: Balance sheets and income statements often use whitespace alignment rather than visible lines. Tabula's Lattice mode fails; Stream mode produces column-shifted data.
3. **Scanned / image PDFs**: Small and mid-cap IDX companies (outside LQ45) frequently submit scanned documents. No text layer exists — pdfplumber returns empty pages. The system silently processes empty content and generates hallucinated responses.
4. **Footnote text bleeding into table extraction**: Financial statement footnotes appear on the same page as tables and get mixed into the extracted table data, corrupting numeric context.
5. **Multi-page tables without repeated headers**: A balance sheet spanning 3 pages has column headers only on page 1. Parser loses column labels on pages 2-3.
6. **Page-number stamping corruption**: IDX documents often have watermarks or page stamps at footer positions that appear in text extraction as orphaned strings between table rows.

**Why it happens:**
PDFs store positioned text fragments, not semantic structure. The parser's job is to reconstruct structure from geometry. Financial documents have no standard layout — each company uses its own template.

**How to avoid:**
1. **Detect document type before choosing parser**: Use PyMuPDF to check if pages have a text layer. Route image-only pages to OCR (Tesseract or cloud OCR). Never silently process empty-page extractions.
2. **Validate extraction completeness**: After extraction, check that key financial statement keywords ("Total Aset", "Laba Bersih", or their English equivalents) are present. If not, surface a user-visible warning rather than generating from empty context.
3. **pdfplumber for structured statements, PyMuPDF for detection**: Use PyMuPDF to characterize page layout (has text layer? column count?), then route to pdfplumber with appropriate `snap_tolerance` / `join_tolerance` parameters for table extraction.
4. **Chunk with page boundaries preserved**: Assign `page_number` metadata to every chunk at extraction time. Never chunk across page breaks without retaining the originating page range.
5. **Test against document diversity from day 1**: Collect 10 real IDX documents (2 large-cap bilingual, 3 mid-cap Bahasa-only digital, 3 mid-cap Bahasa-only scanned, 2 quarterly statements) and run parser validation before any AI work.

**Warning signs:**
- Extraction returns < 100 characters per page on a document you know has content
- Financial totals are missing from extracted text
- Table extraction produces rows with misaligned column counts
- Document with "Rp" amounts returns no numeric content

**Phase to address:** PDF Parsing & Ingestion phase (day-one priority); OCR fallback in Parsing phase

---

### Pitfall 4: Citation Drift — Page Metadata Lost at Chunk Boundaries

**Severity:** CRITICAL

**What goes wrong:**
The system generates explanations with citations to page numbers, but the cited page is wrong. Root causes:
- Chunks don't carry page number metadata, so the RAG retrieval layer has no page provenance to attach to retrieved chunks.
- Post-hoc citation assignment: The LLM generates text first, then a separate step tries to attribute sources — this is structurally unable to produce faithful attribution (research shows max F1 of 58.9% for post-hoc attribution).
- Cross-page chunks: A chunk spanning pages 47-48 gets labelled "page 47" and the cited claim actually appears on page 48.
- Vector DB schema omits page metadata fields, and citation is bolted on later.

**Why it happens:**
Citation is typically an afterthought. Developers build the pipeline (parse → chunk → embed → retrieve → generate) and only realize citations are broken at demo time. Re-architecturing the pipeline post-build is expensive.

**How to avoid:**
1. **Design page metadata into the schema on day one**: Every chunk schema must include `source_page_start`, `source_page_end`, `source_file`, and `chunk_id`. These fields are non-negotiable from the first line of code.
2. **Use inline citation during generation, not post-hoc**: Instruct the model to produce citations inline as it generates: "Revenue grew 15% (page 42)." Provide retrieved chunks with their page labels clearly tagged in the prompt context.
3. **Never chunk across major section boundaries**: A chunk should not span a page where financial statement A ends and statement B begins.
4. **Citation verification test in eval set**: Include test cases where you verify not just the factual claim but the page number cited. This is the only way to catch citation drift early.

**Warning signs:**
- In testing, clicking a cited page number shows unrelated content
- The same page number appears for 80% of all citations (metadata defaulting)
- Retrieval returns chunks with `page_number: null` or `page_number: 0`

**Phase to address:** PDF Parsing & Ingestion phase (metadata schema); RAG Architecture phase (inline citation design); Eval phase (citation accuracy as a test dimension)

---

### Pitfall 5: AI Score Appearing Arbitrary — User Disengagement

**Severity:** HIGH

**What goes wrong:**
The 1-10 holistic score is shown without sufficient reasoning, and users either:
- **Over-trust it**: Treat the score as a buy/sell signal (regulatory risk + ethical risk)
- **Distrust it**: See no connection between score and the explanation, dismiss the feature entirely
- **Lose calibration**: Learn that a score of 7 doesn't consistently mean anything relative to a score of 5

Research shows only 1 in 3 users trust AI financial advice, and trust collapses permanently after one visible error ("algorithm aversion").

**Why it happens:**
Developers focus on generating a score and assume users will trust it. The score generation prompt doesn't systematically enforce rubric consistency across different documents. A 7/10 for BBCA may be calibrated differently than a 7/10 for a mid-cap manufacturing company because the prompt doesn't normalize for sector.

**How to avoid:**
1. **Show the rubric, not just the score**: Every score display must show the 4-5 sub-dimensions that contributed (profitability, balance sheet health, growth trend, valuation context) with individual sub-scores or ratings. A score of 7/10 means nothing; "Profitability: Strong / Balance Sheet: Moderate / Growth: Declining" is meaningful.
2. **Enforce consistency with structured output**: Use structured JSON output from the LLM (`{"profitability_score": 7, "rationale": "...", "debt_health_score": 5, ...}`) rather than free-text score extraction. This forces the model to fill each dimension explicitly.
3. **Label clearly as AI opinion**: Score display must use visual language that signals opinion, not fact: "AI Assessment," "Clarifin's Take," not "Score" or "Rating."
4. **Show cross-document context**: "This company scores 7/10. For reference, the 10 documents processed this week scored between 4 and 8." Prevents false precision.
5. **Never convert to a buy/sell signal**: The UI must never use language like "strong buy," "hold," or "sell" in proximity to the score.

**Warning signs:**
- User asks "So should I buy this stock?" immediately after seeing the score
- Score is the same (e.g., 7/10) for documents that are clearly different quality
- No sub-dimension breakdown visible in the UI

**Phase to address:** AI Scoring phase (structured rubric prompt); UI Design phase (score presentation UX)

---

### Pitfall 6: OJK Regulatory Exposure — Unlicensed Investment Advice

**Severity:** HIGH

**What goes wrong:**
OJK defines a "Penasihat Investasi" (Investment Advisor) as "a party that provides advice to another party regarding the sale or purchase of securities in exchange for service fees" (Kep-26/PM/1996). Products that cross this line without OJK licensing face shutdown risk.

The risk is more subtle than an outright "buy this stock" statement. High-risk patterns include:
- Score of 8/10 displayed prominently + positive financial summary = implicit buy signal in OJK's view
- Chat feature answering "Should I buy BBCA?" without explicit deflection
- Any UI that could be construed as personalized investment advice (even indirectly)
- Future monetization (any form of payment) that turns "analysis" into "advice for fee"

**Why it happens:**
Solo developers building analysis tools underestimate how broadly "advice" is defined. The free-tier, no-auth v1 has low immediate risk, but patterns set now become regulatory liabilities if the product grows or monetizes.

**How to avoid:**
1. **Establish clear functional boundaries now**: The product explains and contextualizes, it does not recommend. This distinction must be hard-coded into every LLM system prompt: "You are a financial document explainer. Do not make buy, sell, or hold recommendations. Do not advise the user on investment decisions."
2. **Hard-block buy/sell language in chat**: Add a post-processing filter that intercepts any response containing buy/sell signal words and replaces them with an explanation deflection.
3. **Prominent, contextual disclaimers — not just footer text**: Disclaimers must appear adjacent to scores and explanations, not just in a terms page. OJK guidance consistently emphasizes consumer protection through visible disclosure.
4. **Do not name competitors or make comparative stock recommendations**: "BBCA vs BBRI which is better" should be declined.
5. **If monetizing v2**: Consult OJK compliance before adding any subscription or fee model. The "service fee" threshold in the definition is where the regulatory line sharpens.

**Warning signs:**
- The chat feature answers "Should I invest?" with anything other than a clear deflection
- The score appears without an explicit "AI opinion, not financial advice" label
- Users share the product on social media framed as "a stock recommendation tool"

**Phase to address:** AI System Prompt phase (behavioral constraints); UI Design phase (disclaimer placement); Chat feature phase (hard-block filter)

---

## High Pitfalls

### Pitfall 7: Free-Tier Cost Blowup

**Severity:** HIGH

**What goes wrong:**
The "free-tier only" constraint breaks in predictable ways:

1. **Annual reports are long**: A 200-page annual report generates 150,000-300,000 input tokens per analysis. Free-tier Gemini 2.5 Flash allows 250 RPD (requests per day) but with a 250,000 TPM (tokens per minute) shared limit. A single large document analysis can consume 1-2 minutes of the TPM quota, throttling all concurrent users.
2. **Rate limit collisions**: At 10 RPM, two simultaneous users processing large documents trigger 429 errors. Without graceful queue management, users see broken experiences.
3. **Context window mismanagement**: Developers pass the entire extracted document as context "to be safe" instead of using RAG retrieval. A 200-page annual report in full context costs 10-30x more tokens than necessary.
4. **Billing cap gaps**: Google's April 2026 billing cap system has a 10-minute detection gap — charges continue for 10 minutes after hitting the cap. A runaway loop (e.g., retry storm on 429) can generate unexpected charges during the gap.
5. **yfinance instability**: Yahoo Finance rate-limited yfinance users with 429 errors starting in 2024-2025, specifically affecting Indonesian `.JK` ticker data. Fetching stock prices fails silently, breaking the valuation context feature.

**How to avoid:**
1. **Always use RAG retrieval, never full-document context**: Never pass more than ~20,000 tokens per LLM call. Retrieve the 5-10 most relevant chunks for each question.
2. **Implement request queuing at the edge**: Use a simple in-memory queue with concurrency limit of 1-2 simultaneous LLM calls. Return a "processing" status immediately and poll for results.
3. **Set absolute token guards**: Track token consumption per request. If a document would exceed 50,000 input tokens in a single call, truncate or split.
4. **yfinance retry + fallback**: Wrap all yfinance calls in exponential backoff with a maximum of 3 retries. If all fail, display the valuation section with a "market data unavailable" notice rather than breaking the page.
5. **Cache stock data aggressively**: Cache ticker data for 24 hours. The user uploaded a filing from last quarter — today's price within 24 hours is sufficient precision.
6. **Set a Gemini API spending cap**: Even on free tier, configure a project budget alert. Know the cap gap exists.

**Warning signs:**
- Single document analysis takes > 60 seconds (likely running full-context)
- 429 errors in logs for >5% of requests
- yfinance returns `None` or empty DataFrame more than occasionally
- Monthly token usage spike with no corresponding user spike

**Phase to address:** AI Architecture phase (RAG design, context limits); Stock Data Integration phase (yfinance fallback); Infrastructure phase (queue, caching)

---

### Pitfall 8: Beginner UX Failures — "We Simplified It" But Didn't

**Severity:** HIGH

**What goes wrong:**
Developers assume plain English means "no jargon." But beginner failures go deeper:
1. **Jargon replaced with other jargon**: "Revenue" replaced with "top-line income" — no improvement.
2. **Disclaimer noise overwhelming content**: Placing 200-word disclaimers before the explanation means users read the disclaimer instead of the insight. They either ignore disclaimers entirely (habituation) or feel the product is "too risky to use."
3. **Number magnitude without intuition**: "Revenue of Rp 85 trillion" is meaningless to a beginner. They need relative context: "That's roughly 10x the annual revenue of the largest Indonesian consumer goods company."
4. **Missing the "so what"**: Explaining "the current ratio is 1.8" without explaining whether 1.8 is good, bad, or normal for this sector.
5. **Wall-of-text structure**: Long paragraphs of financial explanation without section headers, callouts, or visual hierarchy. Beginners scan, not read.
6. **Passive voice financial writing**: Financial statements encourage passive voice; LLMs inherit this and produce dense, formal prose that beginners find alienating.
7. **Indonesia-specific**: The target user (PwC consultant, Jakarta) reads English fluently but financial English feels formal and institutional. The tone needs to be like a smart friend explaining, not a prospectus.

**How to avoid:**
1. **Reading level target**: Aim for US Grade 8-9 reading level (Flesch-Kincaid). Test generated output against this. Tools like Hemingway App or a simple Flesch scoring library can be run in CI.
2. **Mandatory "so what" rule in prompt**: Every financial metric mentioned must be followed by its implication. "Current Ratio of 1.8 — this means the company has Rp 1.80 in short-term assets for every Rp 1.00 it owes in the next year. That's healthy."
3. **Contextual disclaimers, not block disclaimers**: Replace a pre-explanation disclaimer wall with a single-line inline attribution at the score: "⚠️ AI opinion — not financial advice." Full disclaimer lives one tap away, not before the content.
4. **Section structure by default**: Prompt must require structured output with headers (Financial Health, Profitability, Growth, Key Risks) rather than a wall of prose.
5. **Test with actual non-finance professionals**: Recruit 2-3 people matching the target persona and watch them read the output. Where they pause or re-read, the explanation failed. Don't test with developers.

**Warning signs:**
- Financial jargon appears in output without inline definition
- Output has paragraphs exceeding 150 words without a break
- User testing: participants read the explanation once and can't summarize the "so what"
- Flesch-Kincaid grade level > 12 on generated text

**Phase to address:** Prompt Engineering phase (tone, structure, readability rules); UI Design phase (disclaimer UX, visual hierarchy); Beta Testing phase (non-developer user testing)

---

### Pitfall 9: Yahoo Finance / yfinance IDX-Specific Failures

**Severity:** HIGH

**What goes wrong:**
Beyond general rate limiting (covered in Pitfall 7), IDX-specific yfinance issues:
1. **`.JK` suffix unreliability**: Indonesian tickers require the `.JK` suffix (e.g., `BBCA.JK`). Several Indonesian stocks fail to return data even with correct suffix, particularly for small/mid caps.
2. **Missing small-cap data**: Stocks below a certain market cap threshold have sparse or missing historical data on Yahoo Finance. Many IDX-listed companies (especially recently IPO'd) have < 2 years of price history.
3. **IDR number formatting in yfinance output**: yfinance returns prices in IDR without explicit currency labeling. The system may display "12500" without "IDR" and users mistake this for a per-lot price or a misquoted figure.
4. **Stale or incorrect P/E ratios**: Yahoo Finance's P/E for Indonesian stocks frequently reflects non-Indonesian accounting standards or uses TTM earnings that lag the document the user just uploaded.
5. **Currency/locale confusion**: Python's locale handling for IDR (using periods as thousand separators) conflicts with international standards (commas). `format_currency(85000000000000, 'IDR', locale='id_ID')` requires the `babel` library and Indonesian locale support.

**How to avoid:**
1. **Validate ticker before use**: After resolving the ticker, call `yf.Ticker(ticker).info` and check for a `regularMarketPrice` key before displaying any data. If absent, show "data unavailable."
2. **Hardcode IDR formatting**: Do not rely on system locale. Implement a dedicated IDR formatter: `Rp` + number with period thousand separators.
3. **Cap historical data fetch at 5 years**: Don't request more history than is likely available; handle partial data gracefully.
4. **Label all financial figures with explicit currency and unit**: "Rp 12,500 per share (IDR)" not just "12500."
5. **Alternative: use IHSG/IDX API as fallback**: For market context (index-level data), the IDX open API or Investing.com provides more reliable Indonesian market data than yfinance for `.JK` tickers.

**Warning signs:**
- `ticker.info` returns `{}` or raises exception for a valid ticker
- Price displayed without "IDR" or "per share" label
- Historical chart shows gap or flat line for a recently-listed company

**Phase to address:** Stock Data Integration phase

---

## Moderate Pitfalls

### Pitfall 10: Eval Set Construction Mistakes

**Severity:** MEDIUM

**What goes wrong:**
1. **Eval set is too clean**: Using only large-cap bilingual documents (BBCA, TLKM) that LLMs handle well. The real failure cases are mid-cap Bahasa-only scanned documents.
2. **Eval tests "can it generate text" not "is the text accurate"**: Testing with automated LLM-as-judge on fluency misses numeric hallucinations entirely.
3. **Data leakage**: Using documents published before the LLM's training cutoff means the model may have memorized the answers. Recent quarterly filings (< 6 months old) avoid this.
4. **Eval doesn't cover citation accuracy**: Most LLM evals test factual accuracy; none test whether the cited page number is correct. For Clarifin, citation accuracy is equally important.
5. **Eval set is too small for variance**: < 10 documents means one outlier document skews all metrics.

**How to avoid:**
1. **Minimum eval set composition**: 2 large-cap bilingual digital PDFs, 3 mid-cap Bahasa-only digital PDFs, 2 small-cap Bahasa-only scanned PDFs (OCR'd), 1 quarterly report, 1 annual report with >150 pages. That's 9 documents — achievable before launch.
2. **Primary eval dimension: numeric accuracy**: For each document, manually extract 5-10 key figures (revenue, net income, total assets, D/E ratio). Check AI output against these. This is the ground truth.
3. **Secondary eval dimension: citation page accuracy**: Cite 3 specific claims and verify the page cited actually contains that claim in the PDF.
4. **Tertiary eval dimension: readability + "so what"**: Does the output explain the implication of each number? Test with a reading-level scorer.
5. **Use recent filings**: Q1 2026 or FY2025 filings are unlikely to be in any model's training data.
6. **Document your eval rubric before running it**: Write down what "pass" and "fail" mean for each dimension before looking at output — avoid motivated reasoning.

**Warning signs:**
- Eval set has 0 scanned documents
- Eval only measures BLEU/ROUGE or LLM-as-judge fluency
- All eval documents are from companies with English Wikipedia pages (likely in training data)

**Phase to address:** Eval Design phase (pre-implementation); should be built before AI Explanation phase is declared "done"

---

### Pitfall 11: Latency / UX Death-Spiral with Free-Tier Models

**Severity:** MEDIUM

**What goes wrong:**
Free-tier models (Gemini 2.5 Flash, GPT-4o-mini) have:
- Slower inference than paid tiers under load
- Time-to-first-token (TTFT) of 2-5 seconds on complex prompts
- No priority queue access — requests sit behind paid-tier traffic

Without streaming, users see a blank loading spinner for 15-30 seconds while a 200-page annual report is processed. Research shows bounce rates jump from ~5% to ~40% once loading exceeds 8 seconds with no visual feedback.

**Why it happens:**
Developers build and test locally with API keys that have different performance characteristics than free-tier public access. Streaming is often implemented as a v2 feature. The document processing pipeline (parse → chunk → embed → retrieve → generate) has multiple sequential steps, all of which add latency before any user-visible output.

**How to avoid:**
1. **Implement streaming from day one, not as an afterthought**: SSE (Server-Sent Events) or WebSockets for streaming LLM tokens to the browser. Streaming makes a 25-second total generation feel acceptable because users see tokens in < 2 seconds.
2. **Show pipeline progress indicators**: "Parsing document... Extracting key sections... Generating explanation..." — visible stages reassure users the system is working, even without token streaming.
3. **Decouple parsing from generation**: Parse the PDF synchronously (fast), show a "document ready" confirmation, then start async generation. User sees intermediate progress.
4. **Optimize TTFT specifically**: TTFT is dominated by the prompt size. Keep retrieved context chunks small and relevant. A 50K-token prompt will have 3x higher TTFT than a 5K-token prompt.
5. **Cache document processing**: If the same PDF is uploaded again (same hash), skip parsing and retrieval — serve from cache.

**Warning signs:**
- Local dev testing shows 5+ seconds with no output
- Loading spinner is the only UI feedback during generation
- Production logs show TTFT > 3 seconds consistently

**Phase to address:** AI Architecture phase (streaming architecture decision); UI Design phase (progress indicators)

---

### Pitfall 12: Indonesian Cultural/UX Mismatches

**Severity:** MEDIUM

**What goes wrong:**
1. **"Saham gorengan" mental model**: A significant segment of Indonesian retail investors have been burned by pump-and-dump manipulation. Any AI scoring feature that gives a high score to a volatile small-cap will be blamed when the stock crashes, even though the score was about fundamentals, not price prediction. This creates trust collapse and potential viral negative coverage.
2. **IPO mania expectations**: Indonesian retail investors show strong IPO excitement ("all IPOs go up on day 1"). They may upload IPO prospectuses expecting the AI to validate their excitement. The system needs to handle prospectus documents differently — they lack historical financial data, making trend analysis impossible.
3. **English-fluent but not English-comfortable for emotional content**: The target user reads English professionally but may find financial conclusions in English feel "foreign" or "cold." Indonesian financial content often uses warmer, more relational framing ("Perusahaan ini menunjukkan kinerja yang baik" — "This company shows good performance"). Pure English financial prose can feel distancing.
4. **Stockbit community comparison expectations**: Users of Stockbit (dominant Indonesian investing app) are accustomed to community-written stock "thesis" posts — narrative-heavy, with a clear bullish/bearish stance. Clarifin's deliberately neutral explanations may feel unsatisfying compared to the confident community posts users are used to.
5. **Desktop-first assumption vs. actual device mix**: While PROJECT.md establishes desktop-first, Jakarta professionals frequently use mobile during commutes. A product that breaks on mobile will lose a meaningful usage window.
6. **IDR psychological scaling**: Rp numbers in financial statements are often in "miliar" (billions) or "triliun" (trillions). When displayed as raw numbers (85,000,000,000,000), they're cognitively overwhelming. Even for users who understand IDR, the scale needs visual anchoring.

**How to avoid:**
1. **Explicitly scope what the score measures**: Score UI must state: "This score reflects financial fundamentals (profitability, debt, growth) as reported in the document. It does not predict stock price movement."
2. **Handle IPO prospectus documents specially**: Detect prospectus (by "Prospektus" keyword or absence of multi-year historical statements) and show a specific UI state: "This is a prospectus — historical performance data is limited. Here's what we can analyze..."
3. **Warm the tone without losing precision**: Prompt for warm professional tone: "Explain as a knowledgeable friend, not a financial advisor. Use 'they' for the company. Be direct about both strengths and concerns."
4. **Never show raw 13-digit Rp numbers**: Format all currency with appropriate scale suffix: "Rp 85 triliun" not "Rp 85,000,000,000,000." Use the Indonesian convention (miliar, triliun) not the English (billion, trillion) when displaying alongside Indonesian-language source excerpts.
5. **Mobile responsiveness as MVP requirement**: Even for a desktop-first product, responsive layout at 375px width prevents accidental breakage.

**Warning signs:**
- Score is high for a stock later identified as saham gorengan and users blame the product
- User uploads a prospectus and AI generates multi-year trend charts with fabricated data
- Social media feedback describes the product as "too cold" or "feels like a robot"

**Phase to address:** UI Design phase (IDR formatting, score framing); AI Explanation phase (tone guidelines); Document Type Detection phase (prospectus handling)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Pass full document as LLM context (no RAG) | Simpler code, no vector DB setup | Cost blowup at scale, token limit failures on 200+ page docs | Never — even for MVP |
| Post-hoc citation assignment | Skip citation architecture complexity | Citations wrong >40% of the time; trust collapse | Never |
| Skip OCR fallback for scanned PDFs | Simpler parse pipeline | Silent empty-page processing; AI hallucination with zero source | Only if you block scanned PDF uploads explicitly |
| Hardcode the ticker from filename/user input without validation | Faster v1 | Wrong stock data displayed when ticker resolved incorrectly | Acceptable in v1 if you surface ticker for user confirmation |
| Use LLM-as-judge for eval (no manual ground truth) | Faster eval | Misses numeric errors, citation errors entirely | Only as a secondary eval dimension, never primary |
| Single-model pipeline (no numeric verification layer) | Less code | Financial hallucinations ship to users undetected | Acceptable only if eval shows < 5% numeric error rate |
| Disclaimer only in footer / terms page | Cleaner UI | OJK compliance risk; users don't register the disclaimer exists | Never for a financial product |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| yfinance / Yahoo Finance | Request historical data without existence check | Always check `.info["regularMarketPrice"]` exists; wrap in try/except; implement 24h cache |
| yfinance `.JK` tickers | Assume all IDX tickers work | Validate against a known-working ticker list; expose manual ticker input as fallback |
| Gemini API free tier | Send large documents synchronously | Queue requests; implement streaming; never exceed 50K tokens per call |
| pdfplumber table extraction | Use default settings for all documents | Tune `snap_tolerance` per document type; validate extracted row/column counts |
| PyMuPDF (fitz) | Use for table extraction | Use only for page characterization (text vs image); use pdfplumber for actual tables |
| Vector DB (local/free tier) | Store chunks without page metadata | Schema must include `page_start`, `page_end`, `source_file` from day one |
| LangChain / LlamaIndex chunking | Use default chunk size (512 tokens) | For financial docs, use 1,000-1,500 tokens to avoid cutting table rows across chunks |
| Gemini API key exposure | API key in client-side JS for "simplicity" | Key must be server-side only; free-tier key exposure can result in quota exhaustion by bots |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full document context injection | 30-60s generation time; 429 rate limit errors | RAG retrieval; hard token caps per call | First user with a 150+ page annual report |
| Synchronous PDF parsing on request | UI hangs for 5-15s before any feedback | Async parsing + progress indicator | First user uploading a multi-column 200-page report |
| yfinance per-request with no cache | 5-10s delay for stock data; 429 on concurrent users | 24h Redis/memory cache; request batching | 3+ concurrent users |
| Embedding full document at upload (no chunking) | Out-of-memory on large reports; embedding API limit exceeded | Chunk first (1,000-1,500 tokens), embed chunks in batches | 200-page annual reports |
| Streaming disabled until v2 | High bounce rate on first public URL | SSE streaming from day one | First real user with slow connection |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Gemini/OpenAI API key in frontend JS | Key stolen, quota exhausted, unexpected billing | API calls via server-side proxy only |
| User-uploaded PDFs stored unencrypted with predictable paths | User A can access User B's financial documents | Random UUID filenames; no public directory listing; auto-delete after session |
| No file size limit on PDF uploads | Denial-of-service via 500MB PDF; token quota exhaustion | Enforce 50MB upload limit; validate MIME type server-side |
| Prompt injection via malicious PDF content | Attacker embeds "Ignore previous instructions" in PDF; model leaks system prompt | Sanitize extracted text; use structured output (JSON schema) so injection affects format, not behavior |
| Caching responses tied to document hash without user isolation | User B's identical-document analysis leaks User A's analysis result | Only cache parsed/embedded representations, never LLM-generated explanations (they may contain user-specific framing) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Disclaimer wall before explanation | Users skip disclaimer entirely (habituation) or feel the product is "dangerous" | Inline micro-disclaimer adjacent to score; full disclaimer one tap away |
| Score shown without sub-dimensions | Users don't know what drove the score; distrust or over-trust | Always show score breakdown (4-5 dimensions minimum) |
| Financial numbers without units | "12500" displayed — is this per share? per lot? in millions? | Every number: amount + unit + scale + currency |
| Chat that doesn't deflect investment advice questions | Regulatory exposure; user takes response as buy/sell signal | Hard-block filter; friendly deflection: "I can explain the financials, but can't advise on whether to invest." |
| Empty loading state during PDF processing | Users assume the app is broken after 5 seconds | Pipeline progress: "Parsing... Analyzing... Done." with timing estimate |
| Raw IDR numbers (12+ digits) | Cognitively overwhelming; users mentally check out | Format as "Rp 85 triliun" or "Rp 85T" with full number available on hover |
| English-only output with no language context switch | Bilingual users who read the source doc in Bahasa find the English explanation disconnected | Include key financial terms in both languages: "Revenue (Pendapatan): ..." |

---

## "Looks Done But Isn't" Checklist

- [ ] **PDF Parser**: Tested on a scanned (image-only) PDF — verify OCR fallback activates, not silent empty processing
- [ ] **Citations**: Clicked every generated page citation — verify each lands on the correct page in the actual PDF
- [ ] **Numeric accuracy**: Manually verified 5 key figures from AI explanation against the source PDF for 3 different documents
- [ ] **Score labels**: Score display shows "AI opinion, not financial advice" in visible text (not just in terms)
- [ ] **Chat filter**: Sent "Should I buy this stock?" to chat — verify response deflects without answering
- [ ] **yfinance failure**: Disconnected from internet, ran yfinance fetch — verify graceful "data unavailable" state, not crash
- [ ] **Large document**: Uploaded a 200-page annual report — verified no 429 error, no timeout, no truncated analysis
- [ ] **Streaming**: Opened browser network tab — verified first token arrives within 3 seconds of submission
- [ ] **IDR formatting**: All displayed financial figures include "Rp" prefix, scale suffix, and "IDR" currency label
- [ ] **Mobile layout**: Opened on 375px viewport — verify no horizontal overflow, score readable, upload works
- [ ] **Scanned PDF warning**: Uploaded a scanned PDF — verify system surfaces "OCR processing" indicator, not silent failure
- [ ] **Eval**: Run eval set of 9+ documents, measure numeric accuracy and citation accuracy — do not ship with < 90% numeric accuracy

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Numeric hallucination found post-launch | HIGH | Add post-generation numeric verifier; re-run eval; add disclaimer "verify numbers against source PDF" to all outputs |
| Citation drift discovered at scale | HIGH | Requires pipeline re-architecture to add page metadata; existing embeddings must be re-indexed |
| OJK contact / compliance challenge | HIGH | Immediate: add explicit disclaimers, remove score if challenged; longer: legal consultation, modify scoring framing |
| yfinance wholesale failure (Yahoo breaks API) | MEDIUM | Switch to IDX open data API or Investing.com scrape; valuation section degrades gracefully |
| Cost blowup on Gemini free tier | MEDIUM | Implement request queuing immediately; add per-user daily request limit; switch to smaller model for non-critical steps |
| User data (PDFs) exposed | HIGH | Rotate storage paths; implement access controls; notify users; audit access logs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| LLM numeric hallucination | PDF Parsing phase (structured table extraction) + AI Explanation phase (verification layer) | Eval: 5 key figures per document, < 5% mismatch |
| Indonesian vocabulary mistranslation | Prompt Engineering phase (glossary injection) | Eval: bilingual document comparison, zero false translations |
| PDF parsing failures | PDF Parsing phase (OCR detection + routing) | Test suite: 9-document matrix covering all layout types |
| Citation drift | PDF Parsing phase (page metadata schema) + RAG Architecture | Click-test: 100% of cited pages contain the claimed fact |
| Arbitrary AI score | AI Scoring phase (structured rubric) + UI Design | User test: 3 non-developers can explain what drove the score |
| OJK regulatory exposure | AI System Prompt phase + UI Design | Manual review: no buy/sell language in any generated output |
| Free-tier cost blowup | AI Architecture phase (RAG, context limits, caching) | Load test: 10 concurrent users, 0 budget alerts triggered |
| Beginner UX failures | Prompt Engineering + UI Design phases | Reading level test: Flesch-Kincaid ≤ 9; user test: 3/3 non-finance users can summarize "so what" |
| yfinance IDX failures | Stock Data Integration phase | Test: disconnect from internet → graceful degradation |
| Eval set mistakes | Eval Design phase (before AI Explanation declared done) | Eval set includes scanned PDFs, recent filings, numeric + citation dimensions |
| Latency / streaming | AI Architecture phase (streaming from day 1) | TTFT < 3 seconds in production environment |
| Indonesian cultural mismatches | UI Design phase + AI Explanation tone guidelines | User test with 2 Jakarta-based non-finance professionals |

---

## "You Don't Know What You Don't Know" — Naive First-Timer Traps

These are areas where a solo developer building their first financial AI product is systematically likely to be overconfident:

**1. "The LLM will figure out the Indonesian terms."**
It won't — consistently. Training data for Indonesian financial documents is thin. You need the domain glossary from day one, not as a v2 fix.

**2. "PDFs are just text."**
No. Each company has its own PDF template. The annual report for BBRI looks completely different from TLKM. Extraction logic that works on one will fail on another. Budget 3-4x more time on PDF parsing than you expect.

**3. "Citations are easy — just return the page number with the chunk."**
Chunks don't automatically have page numbers. You have to design the metadata schema before ingestion. Retrofitting it after means rebuilding the entire vector index.

**4. "yfinance is free and reliable."**
yfinance is an unofficial scraper with no SLA. It broke for Indonesian stocks in 2024-2025 and can break again at any time. Design your stock data layer with a fallback from day one.

**5. "Disclaimers are a legal formality."**
For OJK, a disclaimer buried in a footer may be insufficient. The threshold for what constitutes "investment advice" in Indonesian regulations is broader than US regulations. Get clarity on this before launch, not after viral distribution.

**6. "Beginners will trust a confident AI explanation."**
Indonesian retail investors have been burned by pump-and-dump schemes and financial misinformation. Trust is earned, not assumed. A product that's right 95% of the time but wrong in a memorable way (cites wrong page, gets revenue wrong) will be remembered for the 5%.

**7. "Eval is just 'does it generate something coherent'."**
Coherent output with wrong numbers is worse than no output at all. Numeric accuracy and citation accuracy are first-class eval dimensions for this product.

**8. "The free tier will be fine for a side project with low traffic."**
One viral tweet from a Stockbit influencer could bring 500 users in an hour. At that scale, free-tier Gemini's 250 RPD is exhausted in minutes. Design the queuing and graceful degradation before you seek any distribution.

---

## Sources

- FAITH benchmark (Cognaptus, 2025): LLM stress-testing on financial number extraction from 10-K filings
- FinGround paper (OpenReview, 2025): Atomic claim verification for financial hallucinations
- GraphRAG + RLFKV papers (ACL, 2025): RAG hallucination mitigation approaches
- Particula Tech (October 2025): RAG citation metadata best practices
- Citation and Attribution in RAG (wiki.charleschen.ai, 2025): Post-hoc attribution failure analysis
- pdfplumber GitHub issues #1335: Multi-column table extraction failures
- BSWEN blog (March 2026): PDF library comparison for financial documents
- yfinance GitHub issues #2411, #2422, #2442 (2025): Rate limiting and `.JK` ticker failures
- OJK Kep-26/PM/1996: Licensing of Investment Advisors definition
- OJK POJK No. 5/POJK.04/2019: Prohibited conduct for investment advisors
- Tianpan.co (April 2026): TTFT latency perception, streaming UX impact
- Redis blog (2025): Streaming LLM responses UX
- Gemini API free tier guide (aifreeapi.com, 2026): Rate limit and pricing changes
- TokenCost.app (April 2026): Gemini billing cap analysis
- CNBC Indonesia (2025): Saham gorengan documentation and OJK SID data
- Stockbit / Ajaib competitive analysis (Mashable ID, 2025)
- Bank Indonesia / PUEBI: IDR number formatting standards
- PSAK (Indonesian GAAP): Accounting terminology standards

---
*Pitfalls research for: AI-powered IDX financial document explainer (Clarifin)*
*Researched: 2026-05-02*
