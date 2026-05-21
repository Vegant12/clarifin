import { describe, it, expect } from "vitest";
import { CHAT_SYSTEM_PROMPT } from "../prompts";

describe("CHAT_SYSTEM_PROMPT (CHAT-02, CHAT-06, DISCLAIM-01)", () => {
  const sampleContext = "[Page 12]: Net profit was Rp 5 trillion in 2023.";

  it("CHAT-02: includes the retrieved context verbatim", () => {
    expect(CHAT_SYSTEM_PROMPT(sampleContext)).toContain(sampleContext);
  });

  it("CHAT-02: instructs the model to cite using [p.N] (matches existing parseCitations regex)", () => {
    expect(CHAT_SYSTEM_PROMPT(sampleContext)).toContain("[p.N]");
  });

  it("CHAT-02: instructs the model to answer ONLY from context", () => {
    expect(CHAT_SYSTEM_PROMPT(sampleContext).toLowerCase()).toContain("only from the context");
  });

  it("CHAT-06: hard-codes no-recommendation clause (DISCLAIM-02 carryover)", () => {
    const p = CHAT_SYSTEM_PROMPT(sampleContext);
    expect(p.toLowerCase()).toContain("buy");
    expect(p.toLowerCase()).toContain("sell");
    expect(p.toLowerCase()).toMatch(/not (able to give|provide) (investment )?advice|no.*recommendation/);
  });

  it("DISCLAIM-01: requires inline 'not investment advice' disclaimer", () => {
    expect(CHAT_SYSTEM_PROMPT(sampleContext).toLowerCase()).toContain("not investment advice");
  });
});
