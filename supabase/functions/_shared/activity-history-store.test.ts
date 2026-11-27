import { describe, expect, it, vi } from "vitest";
import { PostgrestActivityHistoryStore } from "./activity-history-store.ts";
import type { ActivityHistoryQuery } from "./activity-history-query.ts";

const baseUrl = "https://project.supabase.co";
const key = "sb_secret_test_key";
const query: ActivityHistoryQuery = { page: 2, pageSize: 10 };
const activity = (overrides: Record<string, unknown> = {}) => ({
  id: "activity-1", personnel_id: "personnel-1", exit_gate_id: "gate-1", return_gate_id: "gate-2",
  destination: "Markas Komando", purpose: "Dinas", status: "SELESAI",
  exit_at: "2026-11-27T08:00:00+00:00", return_at: "2026-11-27T10:00:00+00:00",
  duration_seconds: 7200, created_at: "2026-11-27T08:00:00+00:00", updated_at: "2026-11-27T10:00:00+00:00",
  personnel: { display_name: "Budi", nrp: "NRP-001" },
  exit_gate: { name: "Gate Keluar" }, return_gate: { name: "Gate Kembali" },
  ...overrides,
});

describe("PostgrestActivityHistoryStore", () => {
  it("applies personal scope, supported filters, exact count, sorting, and page range", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/21" } });
      return Response.json([activity()]);
    });
    const result = await new PostgrestActivityHistoryStore(baseUrl, key, fetcher).list({
      from: "2026-11-01T00:00:00.000Z", to: "2026-11-30T23:59:59.999Z",
      personnelName: "Budi", nrp: "001", destination: "Markas", status: "SELESAI", page: 2, pageSize: 10,
    }, { personnelId: "personnel-1" });
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 21, totalPages: 3 });
    expect(result.data[0]).toMatchObject({
      id: "activity-1", personnelId: "personnel-1", exitGateId: "gate-1", returnGateId: "gate-2",
      personnel: { displayName: "Budi", nrp: "NRP-001" },
      exitGate: { name: "Gate Keluar" }, returnGate: { name: "Gate Kembali" },
      exitAt: "2026-11-27T08:00:00.000Z", returnAt: "2026-11-27T10:00:00.000Z",
      durationSeconds: 7200, status: "SELESAI",
    });
    const head = fetcher.mock.calls.find(([, init]) => init?.method === "HEAD");
    const countUrl = new URL(String(head?.[0]));
    expect(countUrl.searchParams.get("personnel_id")).toBe("eq.personnel-1");
    expect(countUrl.searchParams.get("personnel.display_name")).toBe('ilike."%Budi%"');
    expect(countUrl.searchParams.get("personnel.nrp")).toBe('ilike."%001%"');
    expect(countUrl.searchParams.get("destination")).toBe('ilike."%Markas%"');
    expect(countUrl.searchParams.get("status")).toBe("eq.SELESAI");
    expect(countUrl.searchParams.get("and")).toContain("exit_at.gte.2026-11-01T00:00:00.000Z");
    const get = fetcher.mock.calls.find(([, init]) => init?.method === "GET");
    const getUrl = new URL(String(get?.[0]));
    expect(getUrl.searchParams.get("order")).toBe("exit_at.desc");
    expect(new Headers(get?.[1]?.headers).get("Range")).toBe("10-19");
  });

  it("resolves matching gate names to IDs and applies OR to exit and return gate IDs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/gates")) return Response.json([{ id: "gate-1" }, { id: "gate-2" }]);
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
      return Response.json([activity()]);
    });
    const result = await new PostgrestActivityHistoryStore(baseUrl, key, fetcher).list({ gate: "Gate Utama", page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
    const head = fetcher.mock.calls.find(([, init]) => init?.method === "HEAD");
    expect(new URL(String(head?.[0])).searchParams.get("or")).toBe("(exit_gate_id.in.(gate-1,gate-2),return_gate_id.in.(gate-1,gate-2))");
    const gateRequest = fetcher.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith("/gates"));
    expect(new URL(String(gateRequest?.[0])).searchParams.get("name")).toBe('ilike."%Gate Utama%"');
  });

  it("returns an empty page without querying activities when no gate matches", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/gates")) return Response.json([]);
      return new Response(null, { status: 200, headers: { "content-range": "*/0" } });
    });
    const result = await new PostgrestActivityHistoryStore(baseUrl, key, fetcher).list({ gate: "No gate", page: 1, pageSize: 20 });
    expect(result).toEqual({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    expect(fetcher.mock.calls.some(([input, init]) => new URL(String(input)).pathname.endsWith("/activities") && init?.method === "GET")).toBe(false);
  });

  it("returns detailed gate locations and scopes detail lookup to the personnel owner", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([activity({
      exit_gate: { name: "Gate Keluar", location: "Gerbang Utara" },
      return_gate: { name: "Gate Kembali", location: "Gerbang Selatan" },
    })]));
    const result = await new PostgrestActivityHistoryStore(baseUrl, key, fetcher).detail("activity-1", { personnelId: "personnel-1" });
    expect(result?.data.exitGate).toEqual({ name: "Gate Keluar", location: "Gerbang Utara" });
    expect(result?.data.returnGate).toEqual({ name: "Gate Kembali", location: "Gerbang Selatan" });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("id")).toBe("eq.activity-1");
    expect(url.searchParams.get("personnel_id")).toBe("eq.personnel-1");
  });

  it("returns null for an inaccessible or missing detail and rejects malformed rows", async () => {
    const missing = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
    await expect(new PostgrestActivityHistoryStore(baseUrl, key, missing).detail("missing", { personnelId: "personnel-1" })).resolves.toBeNull();
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ id: "broken" }]));
    await expect(new PostgrestActivityHistoryStore(baseUrl, key, malformed).detail("broken")).rejects.toThrow("activity row is invalid");
  });

  it("fails closed when exact count is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200, headers: { "content-range": "0-0/*" } }));
    await expect(new PostgrestActivityHistoryStore(baseUrl, key, fetcher).list(query)).rejects.toThrow("exact total");
  });
});
