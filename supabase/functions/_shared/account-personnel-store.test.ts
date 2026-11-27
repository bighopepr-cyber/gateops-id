import { describe, expect, it, vi } from "vitest";
import { PostgrestAccountPersonnelStore } from "./account-personnel-store.ts";

const baseUrl = "https://project.supabase.co";
const key = "sb_secret_test_key";
const user = (id: string, role?: string) => ({
  id, username: id, ...(role ? { role } : {}), display_name: "User " + id,
  nrp: role === "SUPER_ADMIN" ? null : "NRP-" + id, rank: role === "SUPER_ADMIN" ? null : "Kapten",
  position: role === "SUPER_ADMIN" ? null : "Komandan", must_change_password: false,
  created_at: "2026-11-27T08:00:00+00:00", updated_at: "2026-11-27T08:00:00+00:00",
});

describe("PostgrestAccountPersonnelStore", () => {
  it("lists all account roles in role/name order without sensitive fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/2" } });
      return Response.json([user("admin", "SUPER_ADMIN"), user("persit", "PERSIT")]);
    });
    const result = await new PostgrestAccountPersonnelStore(baseUrl, key, fetcher).listAccounts();
    expect(result.data.map(row => row.role)).toEqual(["SUPER_ADMIN", "PERSIT"]);
    expect(result.data[0]).toMatchObject({ id: "admin", username: "admin", displayName: "User admin", role: "SUPER_ADMIN" });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|password_hash|session|token/i);
    const get = fetcher.mock.calls.find(([, init]) => init?.method === "GET");
    const url = new URL(String(get?.[0]));
    expect(url.searchParams.get("order")).toBe("role.asc,display_name.asc");
    expect(url.searchParams.get("select")).toContain("role");
    expect(url.searchParams.get("select")).not.toContain("password_hash");
  });

  it("lists only PERSONEL and preserves display-name ordering", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
      return Response.json([user("personnel-1")]);
    });
    const result = await new PostgrestAccountPersonnelStore(baseUrl, key, fetcher).listPersonnel();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty("role");
    const get = fetcher.mock.calls.find(([, init]) => init?.method === "GET");
    const url = new URL(String(get?.[0]));
    expect(url.searchParams.get("role")).toBe("eq.PERSONEL");
    expect(url.searchParams.get("order")).toBe("display_name.asc");
  });

  it("paginates beyond the PostgREST default row cap", async () => {
    const users = Array.from({ length: 1001 }, (_, i) => user("personnel-" + i, "PERSONEL"));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1001" } });
      const [start, end] = new Headers(init?.headers).get("Range")!.split("-").map(Number);
      return Response.json(users.slice(start, end + 1));
    });
    const result = await new PostgrestAccountPersonnelStore(baseUrl, key, fetcher).listAccounts();
    expect(result.data).toHaveLength(1001);
    const pages = fetcher.mock.calls.filter(([, init]) => init?.method === "GET");
    expect(pages).toHaveLength(2);
    expect(new Headers(pages[1][1]?.headers).get("Range")).toBe("1000-1999");
  });

  it("fails closed on missing exact count and malformed rows", async () => {
    const noCount = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200, headers: { "content-range": "0-0/*" } }));
    await expect(new PostgrestAccountPersonnelStore(baseUrl, key, noCount).listAccounts()).rejects.toThrow("exact total");
    const malformed = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
      return Response.json([{ id: "bad" }]);
    });
    await expect(new PostgrestAccountPersonnelStore(baseUrl, key, malformed).listAccounts()).rejects.toThrow("user row is invalid");
  });
});
