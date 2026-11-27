import { describe, expect, it, vi } from "vitest";
import { PostgrestCommandDashboardStore } from "./command-dashboard-store.ts";

describe("PostgrestCommandDashboardStore", () => {
  const now = new Date("2026-11-27T00:00:00.000Z");
  const outside = [{
    id: "p1", display_name: "Personel Satu", nrp: "NRP1", rank: "Kapten", position: "Staf",
    gps_latitude: -6.2, gps_longitude: 106.8, gps_updated_at: now.toISOString(), gps_permission_revoked_at: null,
    activities: [{ destination: "Semarang", purpose: "Dinas", exit_at: now.toISOString(), exit_gate: { name: "Gate A" } }],
  }];
  const activities = [{
    id: "a1", status: "AKTIF", exit_at: now.toISOString(), return_at: null,
    personnel: { display_name: "Personel Satu", nrp: "NRP1" },
    exit_gate: { name: "Gate A" }, return_gate: null,
  }];

  it("returns exact counts, DI_LUAR personnel, and ten latest activities with dashboard contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") {
        const count = url.searchParams.get("presence_status") === "eq.DI_DALAM" ? 3 :
          url.searchParams.get("presence_status") === "eq.DI_LUAR" ? 2 : 5;
        return new Response(null, { status: 200, headers: { "content-range": `0-0/${count}` } });
      }
      return Response.json(url.pathname.endsWith("/activities") ? activities : outside);
    });
    const store = new PostgrestCommandDashboardStore("https://project.supabase.co", "secret", fetcher);
    const result = await store.get(now);
    expect(result.statistics).toEqual({ totalPersonnel: 5, insidePersonnel: 3, outsidePersonnel: 2 });
    expect(result.outsidePersonnel[0]).toMatchObject({
      id: "p1", displayName: "Personel Satu", exitGate: "Gate A", destination: "Semarang",
      purpose: "Dinas", exitAt: now.toISOString(), gpsStatus: "AKTIF",
    });
    expect(result.latestActivities[0]).toEqual({
      id: "a1", personnelName: "Personel Satu", nrp: "NRP1", gate: "Gate A",
      type: "KELUAR", occurredAt: now.toISOString(), status: "AKTIF",
    });
    const calls = fetcher.mock.calls;
    expect(calls.filter(([, init]) => init?.method === "HEAD")).toHaveLength(3);
    expect(calls.some(([url]) => String(url).includes("activities.status=eq.AKTIF"))).toBe(true);
    expect(calls.some(([url]) => String(url).includes("order=updated_at.desc") && String(url).includes("limit=10"))).toBe(true);
  });

  it("preserves null GPS and the exact 60-second active boundary", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "0-0/0" } });
      const url = new URL(String(input));
      if (url.pathname.endsWith("/activities")) return Response.json([]);
      return Response.json([{
        ...outside[0], gps_updated_at: new Date(now.getTime() - 60_001).toISOString(),
        activities: [],
      }, { ...outside[0], id: "p2", gps_latitude: null, gps_longitude: null, gps_updated_at: null },
      { ...outside[0], id: "p3", gps_updated_at: new Date(now.getTime() - 60_000).toISOString(), activities: [] }]);
    });
    const store = new PostgrestCommandDashboardStore("https://project.supabase.co", "secret", fetcher);
    const result = await store.get(now);
    expect(result.outsidePersonnel.map((item) => item.gpsStatus)).toEqual(["OFFLINE", null, "AKTIF"]);
    expect(result.outsidePersonnel[0].exitGate).toBe("—");
  });

  it("fails closed on count, row query, and malformed count responses", async () => {
    const failed = new PostgrestCommandDashboardStore("https://project.supabase.co", "secret",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(failed.get(now)).rejects.toThrow("status 503");
    const malformed = new PostgrestCommandDashboardStore("https://project.supabase.co", "secret",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { headers: { "content-range": "0-0/*" } })));
    await expect(malformed.get(now)).rejects.toThrow("exact total");
  });
});
