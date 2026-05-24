/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { getOnboardingSeen, setOnboardingSeen, ONBOARDING_SEEN_KEY } from "@/lib/onboarding-client";

describe("onboarding-client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when localStorage key is absent", () => {
    expect(getOnboardingSeen()).toBe(false);
  });

  it("returns true after setOnboardingSeen is called", () => {
    setOnboardingSeen();
    expect(getOnboardingSeen()).toBe(true);
  });

  it("stores '1' as the value for the key", () => {
    setOnboardingSeen();
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("1");
  });
});
