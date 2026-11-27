import { describe, expect, it, vi } from "vitest";
import { PostgrestAuditLogStore } from "./audit-log-store.ts";

const baseUrl = "https://project.supabase.co";
const key = "sb_secret_test_key";
const row = (overrides: Record<string, unknown> = {}) => ({
  id: "audit-1", actor_username: "admin", actor_display_name: "Super Admin",
  actor_role: "SUPER_ADMIN", action: "ACCOUNT_CREATED", entity_type: "ACCOUNT",
  entity_id: "account-1", metadata: { role: "KOMANDAN", enabled: true, note: null },
  created_at: "2026-11-27T08:00:00+00:00", ...overrides,
});

describe("PostgrestAuditLogStore", () => {
  it("returns exact pagination, maps only the existing audit fields, and sorts deterministically", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/51" } });
      return Response.json([row()]);
    });
    const result = await new PostgrestAuditLogStore(baseUrl, key, fetcher).get({ page: 3, pageSize: 25 });
    expect(result.pagination).toEqual({ page: 3, pageSize: 25, total: 51, totalPages: 3 });
    expect(result.data[0]).toEqual({
      id: "audit-1", actorUsername: "admin", actorDisplayName: "Super Admin",
      actorRole: "SUPER_ADMIN", action: "ACCOUNT_CREATED", entityType: "ACCOUNT",
      entityId: "account-1", metadata: { role: "KOMANDAN", enabled: true, note: null },
      createdAt: "2026-11-27T08:00:00.000Z",
    });
    const get = fetcher.mock.calls.find(([, init]) => init?.method === "GET");
    const url = new URL(String(get?.[0]));
    expect(url.pathname).toBe("/rest/v1/audit_logs");
    expect(url.searchParams.get("order")).toBe("created_at.desc,id.desc");
    expect(new Headers(get?.[1]?.headers).get("Range")).toBe("50-74");
    expect(url.searchParams.get("select")).toContain("actor_username");
    expect(url.searchParams.get("select")).not.toContain("actor_user_id");
  });

  it("does not query rows when requested page is beyond the exact total", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200, headers: { "content-range": "*/0" } }));
    const result = await new PostgrestAuditLogStore(baseUrl, key, fetcher).get({ page: 1, pageSize: 25 });
    expect(result).toEqual({ data: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed rows and nested metadata", async () => {
    const malformed = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
      return Response.json([row({ metadata: { nested: { token: "not-allowed" } } })]);
    });
    await expect(new PostgrestAuditLogStore(baseUrl, key, malformed).get({ page: 1, pageSize: 25 }))
      .rejects.toThrow("audit metadata is invalid");
  });

  it("rejects metadata keys that could expose credentials or secrets", async () => {
    const sensitive = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
      return Response.json([row({ metadata: { passwordChanged: true } })]);
    });
    await expect(new PostgrestAuditLogStore(baseUrl, key, sensitive).get({ page: 1, pageSize: 25 }))
      .rejects.toThrow("audit metadata is invalid");
  });

  it("rejects a page whose row count conflicts with the exact total", async () => {
    const shortPage = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/26" } });
      return Response.json([row()]);
    });
    await expect(new PostgrestAuditLogStore(baseUrl, key, shortPage).get({ page: 1, pageSize: 25 }))
      .rejects.toThrow("does not match the exact count");
  });

  it("fails closed when exact count is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200, headers: { "content-range": "0-0/*" } }));
    await expect(new PostgrestAuditLogStore(baseUrl, key, fetcher).get({ page: 1, pageSize: 25 }))
      .rejects.toThrow("exact total");
  });
});
