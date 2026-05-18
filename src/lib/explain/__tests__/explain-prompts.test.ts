import { describe, expect, test } from "vitest";

import {
  EXPLANATION_MODEL_ID,
  PSAK_GLOSSARY,
  buildExplanationPrompt,
} from "../explain-prompts";

describe("EXPLANATION_MODEL_ID", () => {
  test("is gemini-2.5-flash", () => {
    expect(EXPLANATION_MODEL_ID).toBe("gemini-2.5-flash");
  });
});

describe("PSAK_GLOSSARY", () => {
  test("contains required PSAK terms", () => {
    expect(PSAK_GLOSSARY).toContain("laba bersih");
    expect(PSAK_GLOSSARY).toContain("laba kotor");
    expect(PSAK_GLOSSARY).toContain("ekuitas");
    expect(PSAK_GLOSSARY).toContain("aset lancar");
    expect(PSAK_GLOSSARY).toContain("arus kas");
    expect(PSAK_GLOSSARY).toContain("pendapatan komprehensif lain");
    expect(PSAK_GLOSSARY).toContain("beban pokok penjualan");
  });
});

describe("buildExplanationPrompt", () => {
  test("injects no-recommendation clause (DISCLAIM-02)", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain("Do NOT make buy/sell recommendations");
  });

  test("injects grade-9 reading instruction (EXPLAIN-03)", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain("grade 9 reading level");
  });

  test("injects total_pages upper bound (Pitfall 3)", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain("200 total pages");
  });

  test("with isIndonesian=true injects PSAK_GLOSSARY", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain(PSAK_GLOSSARY);
  });

  test("with isIndonesian=false omits PSAK_GLOSSARY", () => {
    const prompt = buildExplanationPrompt(200, false);
    expect(prompt).not.toContain("laba bersih → net income");
  });

  test("instructs [p.N] citation format (EXPLAIN-02)", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain("[p.N]");
  });

  test("instructs ID-term translation rule (TRANSLATE-02)", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain("Bahasa Indonesia financial term");
  });

  test("requires 5-section JSON keys (EXPLAIN-01)", () => {
    const prompt = buildExplanationPrompt(200, true);
    expect(prompt).toContain("revenue");
    expect(prompt).toContain("profitability");
    expect(prompt).toContain("balance_sheet");
    expect(prompt).toContain("cash_flow");
    expect(prompt).toContain("key_risks");
  });

  test("total_pages upper bound reflects provided page count", () => {
    const prompt50 = buildExplanationPrompt(50, false);
    expect(prompt50).toContain("50 total pages");
    const prompt300 = buildExplanationPrompt(300, false);
    expect(prompt300).toContain("300 total pages");
  });
});
