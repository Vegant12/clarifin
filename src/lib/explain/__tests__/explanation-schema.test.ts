import { describe, expect, test } from "vitest";

import {
  EXPLANATION_RESPONSE_SCHEMA,
  explanationSchema,
} from "../explanation-schema";

describe("explanationSchema", () => {
  test("parses a complete object", () => {
    const input = {
      revenue: "Revenue grew 18% [p.12] driven by strong retail demand.",
      profitability: "Gross margin improved to 42% [p.15] due to cost controls.",
      balance_sheet:
        "Total assets stand at Rp 50T [p.22] with a current ratio of 1.8.",
      cash_flow:
        "Operating cash flow was positive at Rp 3T [p.30], indicating quality earnings.",
      key_risks:
        "Key risks include FX exposure [p.45] and commodity price volatility [p.46].",
    };
    const result = explanationSchema.parse(input);
    expect(result).toEqual(input);
  });

  test("rejects missing key", () => {
    const inputMissingKeyRisks = {
      revenue: "Revenue grew 18% [p.12].",
      profitability: "Gross margin improved [p.15].",
      balance_sheet: "Total assets Rp 50T [p.22].",
      cash_flow: "Operating cash flow positive [p.30].",
      // key_risks intentionally omitted
    };
    expect(() => explanationSchema.parse(inputMissingKeyRisks)).toThrow();
  });

  test("rejects empty string", () => {
    const inputEmptyRevenue = {
      revenue: "",
      profitability: "Gross margin improved [p.15].",
      balance_sheet: "Total assets Rp 50T [p.22].",
      cash_flow: "Operating cash flow positive [p.30].",
      key_risks: "Key risks include FX exposure [p.45].",
    };
    expect(() => explanationSchema.parse(inputEmptyRevenue)).toThrow();
  });
});

describe("EXPLANATION_RESPONSE_SCHEMA", () => {
  test("declares all 5 keys required", () => {
    const required = [...EXPLANATION_RESPONSE_SCHEMA.required].sort();
    expect(required).toEqual(
      [
        "balance_sheet",
        "cash_flow",
        "key_risks",
        "profitability",
        "revenue",
      ].sort(),
    );
  });

  test("properties has type: string for every key", () => {
    const props = EXPLANATION_RESPONSE_SCHEMA.properties;
    expect(props.revenue).toEqual({ type: "string" });
    expect(props.profitability).toEqual({ type: "string" });
    expect(props.balance_sheet).toEqual({ type: "string" });
    expect(props.cash_flow).toEqual({ type: "string" });
    expect(props.key_risks).toEqual({ type: "string" });
  });
});
