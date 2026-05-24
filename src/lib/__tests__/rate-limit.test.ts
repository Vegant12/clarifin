import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));

import { supabaseAdmin } from "@/db/client";
import { isIpRateLimited, extractClientIp } from "@/lib/rate-limit";

const mockFrom = vi.mocked(supabaseAdmin.from);

function mockCount(count: number | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count, error }),
  };
  mockFrom.mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isIpRateLimited", () => {
  it("returns true when count >= DAILY_UPLOAD_LIMIT (5)", async () => {
    mockCount(5);
    expect(await isIpRateLimited("1.2.3.4")).toBe(true);
  });

  it("returns false when count < DAILY_UPLOAD_LIMIT (4)", async () => {
    mockCount(4);
    expect(await isIpRateLimited("1.2.3.4")).toBe(false);
  });

  it("returns false (fail open) when supabase returns an error", async () => {
    mockCount(null, new Error("DB error"));
    expect(await isIpRateLimited("1.2.3.4")).toBe(false);
  });
});

describe("extractClientIp", () => {
  it("returns the first IP from x-forwarded-for header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when x-forwarded-for header is absent", () => {
    const req = new Request("http://localhost");
    expect(extractClientIp(req)).toBe("unknown");
  });
});
