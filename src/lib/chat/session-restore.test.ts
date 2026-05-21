import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted Supabase mock chain. We assert on the .eq / .gte / .order / .limit calls
// to prove the contract: session_id AND doc_id scoping, 7-day filter, ordered ASC, limit 40.
const { supabaseFrom, selectMock, eqSessionMock, eqDocMock, gteMock, orderMock, limitMock } =
  vi.hoisted(() => {
    const limitMock = vi.fn();
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const gteMock = vi.fn(() => ({ order: orderMock }));
    const eqDocMock = vi.fn(() => ({ gte: gteMock }));
    const eqSessionMock = vi.fn(() => ({ eq: eqDocMock }));
    const selectMock = vi.fn(() => ({ eq: eqSessionMock }));
    const supabaseFrom = vi.fn(() => ({ select: selectMock }));
    return {
      supabaseFrom,
      selectMock,
      eqSessionMock,
      eqDocMock,
      gteMock,
      orderMock,
      limitMock,
    };
  });

vi.mock("@/db/client", () => ({
  supabaseAdmin: { from: supabaseFrom },
}));

import { loadInitialMessages } from "../session-restore";

const SESSION = "11111111-1111-1111-1111-111111111111";
const DOC = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-05-21T00:00:00.000Z");
const SIX_DAYS_AGO = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
const EIGHT_DAYS_AGO = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadInitialMessages (CHAT-04)", () => {
  it("returns messages within the 7-day TTL window", async () => {
    // Supabase, when given a .gte filter, will only return rows that satisfy it.
    // The mock simulates that — only the 6-day-old row comes back.
    limitMock.mockResolvedValue({
      data: [
        { id: "m1", role: "user", content: "Hello", created_at: SIX_DAYS_AGO },
        { id: "m2", role: "assistant", content: "Hi", created_at: SIX_DAYS_AGO },
      ],
      error: null,
    });

    const msgs = await loadInitialMessages({ sessionId: SESSION, documentId: DOC, now: NOW });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.content).toBe("Hello");
  });

  it("excludes messages older than 7 days (filter is applied via .gte(created_at, sevenDaysAgo))", async () => {
    // The implementation MUST request the filter. We assert on the call args below.
    limitMock.mockResolvedValue({ data: [], error: null });

    await loadInitialMessages({ sessionId: SESSION, documentId: DOC, now: NOW });

    // gteMock first call args: (column, value)
    expect(gteMock).toHaveBeenCalledWith(
      "created_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
    const cutoff = new Date(gteMock.mock.calls[0]![1] as string).getTime();
    // Cutoff must be ~7 days before NOW (allow 1s drift for non-injected Date).
    expect(Math.abs(cutoff - (NOW.getTime() - 7 * 24 * 60 * 60 * 1000))).toBeLessThan(1000);
    // Eight-days-ago must be strictly before the cutoff.
    expect(new Date(EIGHT_DAYS_AGO).getTime()).toBeLessThan(cutoff);
  });

  it("scopes the query by BOTH session_id AND doc_id (cross-document leak prevention)", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await loadInitialMessages({ sessionId: SESSION, documentId: DOC, now: NOW });

    expect(supabaseFrom).toHaveBeenCalledWith("chat_messages");
    expect(eqSessionMock).toHaveBeenCalledWith("session_id", SESSION);
    expect(eqDocMock).toHaveBeenCalledWith("doc_id", DOC);
  });

  it("orders ascending and caps at 40 rows", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await loadInitialMessages({ sessionId: SESSION, documentId: DOC, now: NOW });

    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(limitMock).toHaveBeenCalledWith(40);
  });

  it("returns [] on error without throwing", async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const msgs = await loadInitialMessages({ sessionId: SESSION, documentId: DOC, now: NOW });
    expect(msgs).toEqual([]);
  });
});
