import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    LANGFUSE_SECRET_KEY: "sk-lf-test-1234567890abcdef1234567890",
    LANGFUSE_PUBLIC_KEY: "pk-lf-test-1234567890abcdef1234567890",
    LANGFUSE_HOST: undefined,
  },
}));

describe("langfuse singleton", () => {
  it("exports a Langfuse instance with trace + flushAsync methods", async () => {
    const { langfuse } = await import("@/lib/langfuse");
    expect(langfuse).toBeDefined();
    expect(typeof langfuse.trace).toBe("function");
    expect(typeof langfuse.flushAsync).toBe("function");
  });

  it("returns the same instance across multiple imports (singleton identity)", async () => {
    const a = (await import("@/lib/langfuse")).langfuse;
    const b = (await import("@/lib/langfuse")).langfuse;
    expect(a).toBe(b);
  });
});
