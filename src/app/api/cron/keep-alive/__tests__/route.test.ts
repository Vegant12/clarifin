import { beforeEach, describe, expect, it, vi } from "vitest";

const { limitMock } = vi.hoisted(() => ({ limitMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ limit: limitMock })),
    })),
  },
}));

import { GET } from "@/app/api/cron/keep-alive/route";

describe("GET /api/cron/keep-alive", () => {
  beforeEach(() => {
    limitMock.mockReset();
  });

  it("returns 200 with { ok: true } when Supabase query succeeds", async () => {
    limitMock.mockResolvedValueOnce({ data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("returns 500 with { ok: false, error } when Supabase returns an error", async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: "connection refused" } });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("connection refused");
  });

  it("returns 500 with { ok: false, error } when the query throws", async () => {
    limitMock.mockRejectedValueOnce(new Error("network down"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.error)).toContain("network down");
  });
});
