import { describe, it, expect } from "vitest";
import { StarterQuestionsSchema } from "../starter-questions-schema";

describe("StarterQuestionsSchema (CHAT-05)", () => {
  it("accepts exactly 5 strings, each ≤120 chars", () => {
    const ok = StarterQuestionsSchema.safeParse({
      questions: [
        "What drove revenue growth in 2023?",
        "Is the company taking on debt?",
        "How is cash flow trending?",
        "What are the key risks?",
        "What is the net profit margin?",
      ],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects 4 questions (must be exactly 5)", () => {
    const r = StarterQuestionsSchema.safeParse({
      questions: ["a", "b", "c", "d"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects 6 questions", () => {
    const r = StarterQuestionsSchema.safeParse({
      questions: ["a", "b", "c", "d", "e", "f"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a question longer than 120 chars", () => {
    const long = "x".repeat(121);
    const r = StarterQuestionsSchema.safeParse({
      questions: [long, "b", "c", "d", "e"],
    });
    expect(r.success).toBe(false);
  });
});
