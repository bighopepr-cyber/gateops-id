import { describe, expect, it, vi } from "vitest";
import { proxyGateopsEdgeRequest } from "./edge-function-proxy";

const config = {
  supabaseUrl: "https://project.supabase.co",
  publishableKey: "sb_publishable_test_key",
  serviceKey: "s".repeat(40),
};
const session = "a".repeat(43);
const request = (path: string, cookie = `gateops_session=${session}`) =>
  new Request(`https://gateops.test/api/edge/${path}`, { headers: { cookie } });

describe("proxyGateopsEdgeRequest", () => {
  it("forwards only the application session and server credentials to the allowlisted Edge Function", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { role: "PERSONEL" } }));
    const response = await proxyGateopsEdgeRequest(
      request("whoami", `other=secret; gateops_session=${session}; theme=dark`),
      ["whoami"], config, { fetcher },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { role: "PERSONEL" } });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://project.supabase.co/functions/v1/gateops-api/whoami");
    expect(init?.method).toBe("GET");
    const headers = new Headers(init?.headers);
    expect(headers.get("cookie")).toBe(`gateops_session=${session}`);
    expect(headers.get("x-gateops-service-key")).toBe(config.serviceKey);
    expect(headers.get("apikey")).toBe(config.publishableKey);
    expect(headers.get("cookie")).not.toContain("other=");
  });

  it("forwards only the validated permission query parameter", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { allowed: true } }));
    const incoming = new Request(`https://gateops.test/api/edge/permission?name=gate-manage&extra=ignored`, {
      headers: { cookie: `gateops_session=${session}` },
    });
    await proxyGateopsEdgeRequest(incoming, ["permission"], config, { fetcher });
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://project.supabase.co/functions/v1/gateops-api/permission?name=gate-manage",
    );
  });

  it("allows the GPS locations endpoint through the same authenticated server bridge", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [] }));
    const response = await proxyGateopsEdgeRequest(request("gps-locations"), ["gps-locations"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
    expect(String(fetcher.mock.calls[0][0])).toBe("https://project.supabase.co/functions/v1/gateops-api/gps-locations");
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.get("cookie")).toBe(`gateops_session=${session}`);
    expect(headers.get("x-gateops-service-key")).toBe(config.serviceKey);
  });

  it("allows the command dashboard endpoint through the authenticated Edge bridge", async () => {
    const data = { statistics: { totalPersonnel: 1, insidePersonnel: 1, outsidePersonnel: 0 }, outsidePersonnel: [], latestActivities: [] };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data }));
    const response = await proxyGateopsEdgeRequest(request("command-dashboard"), ["command-dashboard"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data });
    expect(String(fetcher.mock.calls[0][0])).toBe("https://project.supabase.co/functions/v1/gateops-api/command-dashboard");
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.get("cookie")).toBe(`gateops_session=${session}`);
    expect(headers.get("x-gateops-service-key")).toBe(config.serviceKey);
  });


  it("allows report data through the authenticated Edge bridge", async () => {
    const data = { statistics: { totalPersonnel: 3 }, activities: [] };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data }));
    const response = await proxyGateopsEdgeRequest(request("reports-data"), ["reports-data"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data });
    expect(String(fetcher.mock.calls[0][0])).toBe("https://project.supabase.co/functions/v1/gateops-api/reports-data");
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.get("cookie")).toBe(`gateops_session=${session}`);
    expect(headers.get("x-gateops-service-key")).toBe(config.serviceKey);
  });


  it("forwards only validated activity history query parameters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }));
    const incoming = new Request("https://gateops.test/api/edge/activities?page=2&pageSize=10&status=SELESAI&personnelName=Budi", {
      headers: { cookie: `gateops_session=${session}` },
    });
    const response = await proxyGateopsEdgeRequest(incoming, ["activities"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    const upstream = new URL(String(fetcher.mock.calls[0][0]));
    expect(upstream.pathname).toBe("/functions/v1/gateops-api/activities");
    expect(upstream.searchParams.get("page")).toBe("2");
    expect(upstream.searchParams.get("pageSize")).toBe("10");
    expect(upstream.searchParams.get("status")).toBe("SELESAI");
    expect(upstream.searchParams.get("personnelName")).toBe("Budi");
  });

  it("fails closed when the Edge activity response has invalid pagination metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], pagination: { page: 0, pageSize: 20, total: 0, totalPages: 0 } }));
    const request = new Request("https://gateops.test/api/edge/activities", { headers: { cookie: `gateops_session=${session}` } });
    const response = await proxyGateopsEdgeRequest(request, ["activities"], config, { fetcher });
    expect(response.status).toBe(502);
  });

  it("forwards an activity detail ID and rejects unknown or duplicate history parameters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { id: "activity-1" } }));
    const detail = new Request("https://gateops.test/api/edge/activity-detail?id=activity-1", { headers: { cookie: `gateops_session=${session}` } });
    const response = await proxyGateopsEdgeRequest(detail, ["activity-detail"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("id")).toBe("activity-1");
    for (const [url, path] of [
      ["https://gateops.test/api/edge/activities?unknown=value", "activities"],
      ["https://gateops.test/api/edge/activities?page=1&page=2", "activities"],
      ["https://gateops.test/api/edge/activity-detail?id=", "activity-detail"],
    ]) {
      const invalid = await proxyGateopsEdgeRequest(new Request(url, { headers: { cookie: `gateops_session=${session}` } }), [path], config, { fetcher });
      expect(invalid.status).toBe(400);
    }
  });

  it("forwards bounded audit log pagination and preserves validated metadata", async () => {
    const payload = { data: [{ id: "audit-1" }], pagination: { page: 2, pageSize: 25, total: 51, totalPages: 3 } };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
    const incoming = new Request("https://gateops.test/api/edge/audit-logs?page=2&pageSize=25", { headers: { cookie: `gateops_session=${session}` } });
    const response = await proxyGateopsEdgeRequest(incoming, ["audit-logs"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    const upstream = new URL(String(fetcher.mock.calls[0][0]));
    expect(upstream.pathname).toBe("/functions/v1/gateops-api/audit-logs");
    expect(upstream.searchParams.get("page")).toBe("2");
    expect(upstream.searchParams.get("pageSize")).toBe("25");
  });

  it("rejects malformed audit log pagination from the Edge response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], pagination: { page: 1, pageSize: 101, total: 0, totalPages: 0 } }));
    const response = await proxyGateopsEdgeRequest(request("audit-logs"), ["audit-logs"], config, { fetcher });
    expect(response.status).toBe(502);
  });

  it("rejects unknown and duplicate audit log query parameters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }));
    for (const url of ["https://gateops.test/api/edge/audit-logs?unknown=x", "https://gateops.test/api/edge/audit-logs?page=1&page=2"]) {
      const response = await proxyGateopsEdgeRequest(new Request(url, { headers: { cookie: `gateops_session=${session}` } }), ["audit-logs"], config, { fetcher });
      expect(response.status).toBe(400);
    }
  });

  it("forwards account and personnel list reads without accepting query parameters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ data: [{ id: "user-1" }] }));
    for (const path of ["accounts", "personnel"]) {
      const incoming = new Request(`https://gateops.test/api/edge/${path}`, { headers: { cookie: `gateops_session=${session}` } });
      const response = await proxyGateopsEdgeRequest(incoming, [path], config, { fetcher });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [{ id: "user-1" }] });
      const invalid = new Request(`https://gateops.test/api/edge/${path}?unexpected=1`, { headers: { cookie: `gateops_session=${session}` } });
      expect((await proxyGateopsEdgeRequest(invalid, [path], config, { fetcher })).status).toBe(400);
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });


  it("forwards Gate creation to Edge and exposes only the one-time credential response", async () => {
    const token = "q".repeat(43);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { id: "gate-1", name: "Gerbang Utama" }, qrCredential: token }, { status: 201 }));
    const incoming = new Request("https://gateops.test/api/edge/gates", {
      method: "POST", headers: { cookie: `gateops_session=${session}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Gerbang Utama", location: "Depan", status: "AKTIF" }),
    });
    const response = await proxyGateopsEdgeRequest(incoming, ["gates"], config, { fetcher });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: "gate-1", name: "Gerbang Utama" }, qrCredential: token });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://project.supabase.co/functions/v1/gateops-api/gates");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Gerbang Utama", location: "Depan", status: "AKTIF" });
    expect(new Headers(init?.headers).get("cookie")).toBe(`gateops_session=${session}`);
  });

  it("forwards Gate updates only to the validated Gate item path", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: { id: "gate-1", status: "NONAKTIF" } }));
    const incoming = new Request("https://gateops.test/api/edge/gates/gate-1", {
      method: "PATCH", headers: { cookie: `gateops_session=${session}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Gerbang Utama", location: "Depan", status: "NONAKTIF" }),
    });
    const response = await proxyGateopsEdgeRequest(incoming, ["gates", "gate-1"], config, { fetcher });
    expect(response.status).toBe(200);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://project.supabase.co/functions/v1/gateops-api/gates/gate-1");
    expect(fetcher.mock.calls[0][1]?.method).toBe("PATCH");
  });

  it("rejects invalid Gate paths, query strings, content types, and oversized bodies", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const invalidId = new Request("https://gateops.test/api/edge/gates/../users", { method: "PATCH", headers: { cookie: `gateops_session=${session}`, "content-type": "application/json" }, body: "{}" });
    expect((await proxyGateopsEdgeRequest(invalidId, ["gates", ".."], config, { fetcher })).status).toBe(404);
    const query = new Request("https://gateops.test/api/edge/gates?all=1", { method: "POST", headers: { cookie: `gateops_session=${session}`, "content-type": "application/json" }, body: "{}" });
    expect((await proxyGateopsEdgeRequest(query, ["gates"], config, { fetcher })).status).toBe(400);
    const contentType = new Request("https://gateops.test/api/edge/gates", { method: "POST", headers: { cookie: `gateops_session=${session}` }, body: "{}" });
    expect((await proxyGateopsEdgeRequest(contentType, ["gates"], config, { fetcher })).status).toBe(400);
    const large = new Request("https://gateops.test/api/edge/gates", { method: "POST", headers: { cookie: `gateops_session=${session}`, "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(9000) }) });
    expect((await proxyGateopsEdgeRequest(large, ["gates"], config, { fetcher })).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects unsupported paths and methods without contacting the upstream", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect((await proxyGateopsEdgeRequest(request("admin"), ["admin"], config, { fetcher })).status).toBe(404);
    expect((await proxyGateopsEdgeRequest(new Request("https://gateops.test", {
      method: "POST", headers: { cookie: `gateops_session=${session}` },
    }), ["whoami"], config, { fetcher })).status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed for missing, malformed, or duplicate session cookies", async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const cookie of [null, "gateops_session=bad", `gateops_session=${session}; gateops_session=${session}`]) {
      const response = await proxyGateopsEdgeRequest(request("whoami", cookie ?? ""), ["whoami"], config, { fetcher });
      expect(response.status).toBe(401);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when server environment is incomplete", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await proxyGateopsEdgeRequest(request("whoami"), ["whoami"], {
      ...config, serviceKey: undefined,
    }, { fetcher });
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sanitizes upstream failures and does not expose internal payloads", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("stack trace", {
      status: 500, headers: { "content-type": "text/plain" },
    }));
    const response = await proxyGateopsEdgeRequest(request("whoami"), ["whoami"], config, { fetcher });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Respons backend tidak valid." });
  });

  it("forwards the upstream authorization status without forwarding headers", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "Akses ditolak." }, { status: 403 }));
    const response = await proxyGateopsEdgeRequest(request("permission?name=gate-manage"), ["permission"], config, { fetcher });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Akses ditolak." });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a gateway timeout when the upstream aborts", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const response = await proxyGateopsEdgeRequest(request("whoami"), ["whoami"], config, { fetcher, timeoutMs: 1 });
    expect(response.status).toBe(504);
  });
});
