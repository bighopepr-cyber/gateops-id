import { describe, expect, it, vi } from "vitest";
import { PostgrestGpsLocationStore } from "./gps-location-store.ts";

describe("PostgrestGpsLocationStore", () => {
  const now = new Date("2026-11-27T00:00:00.000Z");
  const row = {
    id: "person-1", display_name: "Personel Satu", nrp: "NRP-1", rank: "Kapten", position: "Staf",
    gps_latitude: -6.2, gps_longitude: 106.8, gps_updated_at: "2026-11-27T00:00:00.000Z",
    gps_permission_revoked_at: null,
    activities: [{ destination: "Jakarta", purpose: "Dinas", exit_at: "2026-11-27T00:00:00.000Z" }],
  };

  it("queries only DI_LUAR personnel with complete coordinates and latest active activity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([row]));
    const store = new PostgrestGpsLocationStore("https://project.supabase.co", "secret-key", fetcher);
    const result = await store.list(now);
    expect(result).toEqual([{
      id: "person-1", displayName: "Personel Satu", nrp: "NRP-1", rank: "Kapten", position: "Staf",
      gpsLatitude: -6.2, gpsLongitude: 106.8, gpsUpdatedAt: row.gps_updated_at,
      gpsPermissionRevokedAt: null, gpsStatus: "AKTIF",
      activities: [{ destination: "Jakarta", purpose: "Dinas", exitAt: row.activities[0].exit_at }],
    }]);
    const [url, init] = fetcher.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/rest/v1/users");
    expect(parsed.searchParams.get("role")).toBe("eq.PERSONEL");
    expect(parsed.searchParams.get("presence_status")).toBe("eq.DI_LUAR");
    expect(parsed.searchParams.get("gps_latitude")).toBe("not.is.null");
    expect(parsed.searchParams.get("gps_longitude")).toBe("not.is.null");
    expect(parsed.searchParams.get("gps_updated_at")).toBe("not.is.null");
    expect(parsed.searchParams.get("activities.status")).toBe("eq.AKTIF");
    expect(parsed.searchParams.get("activities.order")).toBe("exit_at.desc");
    expect(parsed.searchParams.get("activities.limit")).toBe("1");
    expect(new Headers(init?.headers).get("apikey")).toBe("secret-key");
    expect(init?.cache).toBe("no-store");
  });

  it("preserves the 60-second GPS boundary and permission-revoked state", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([
      { ...row, gps_updated_at: new Date(now.getTime() - 60_001).toISOString() },
      { ...row, id: "person-2", gps_permission_revoked_at: now.toISOString() },
    ]));
    const store = new PostgrestGpsLocationStore("https://project.supabase.co", "secret-key", fetcher);
    const result = await store.list(now);
    expect(result.map((item) => item.gpsStatus)).toEqual(["OFFLINE", "OFFLINE"]);
  });

  it("fails when PostgREST rejects the request or returns an invalid shape", async () => {
    const rejected = new PostgrestGpsLocationStore("https://project.supabase.co", "secret-key",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(rejected.list(now)).rejects.toThrow("status 503");
    const invalid = new PostgrestGpsLocationStore("https://project.supabase.co", "secret-key",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [] })));
    await expect(invalid.list(now)).rejects.toThrow("invalid response");
  });
});
