import { describe, expect, it, vi } from "vitest";
import { PostgrestReportDataStore } from "./report-data-store.ts";

const baseUrl = "https://project.supabase.co";
const key = "sb_secret_test_key";
const row = (id: string, exitAt = "2026-11-27T08:00:00.000Z") => ({
  id, destination: "Markas", purpose: "Dinas", status: "SELESAI",
  exit_at: exitAt, return_at: "2026-11-27T10:00:00+00:00", duration_seconds: 7200,
  personnel: { display_name: "Personel Satu", nrp: "NRP-001" },
  exit_gate: { name: "Gate Keluar" }, return_gate: { name: "Gate Kembali" },
});

function countResponse(url: URL): Response {
  const table = url.pathname.split("/").pop();
  const presence = url.searchParams.get("presence_status");
  const count = table === "users"
    ? presence === "eq.DI_DALAM" ? 3 : presence === "eq.DI_LUAR" ? 2 : 5
    : url.searchParams.has("return_at") ? 1 : 1;
  return new Response(null, { status: 200, headers: { "content-range": `0-0/${count}` } });
}

describe("PostgrestReportDataStore", () => {
  it("returns the existing report contract with exact counts and normalized timestamps", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return countResponse(url);
      return Response.json([row("activity-1")]);
    });
    const result = await new PostgrestReportDataStore(baseUrl, key, fetcher).get();
    expect(result.statistics).toEqual({
      totalPersonnel: 5, insidePersonnel: 3, outsidePersonnel: 2, exitTransactions: 1, returnTransactions: 1,
    });
    expect(result.activities).toEqual([{
      id: "activity-1", personnelName: "Personel Satu", nrp: "NRP-001",
      exitGate: "Gate Keluar", returnGate: "Gate Kembali",
      exitAt: "2026-11-27T08:00:00.000Z", returnAt: "2026-11-27T10:00:00.000Z",
      destination: "Markas", purpose: "Dinas", durationSeconds: 7200, status: "SELESAI",
    }]);
    const activityRequest = fetcher.mock.calls.find(([input, init]) =>
      new URL(String(input)).pathname.endsWith("/activities") && init?.method === "GET");
    expect(activityRequest).toBeTruthy();
    expect(new URL(String(activityRequest?.[0])).searchParams.get("order")).toBe("exit_at.desc,id.desc");
    expect(new Headers(activityRequest?.[1]?.headers).get("Range")).toBe("0-999");
  });

  it("fetches every report row in stable pages rather than truncating at the API page limit", async () => {
    const allRows = Array.from({ length: 1001 }, (_, index) => row(`activity-${index}`, new Date(2026, 0, 1, 0, index).toISOString()));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") {
        const table = url.pathname.split("/").pop();
        const count = table === "users" ? 0 : url.searchParams.has("return_at") ? 0 : allRows.length;
        return new Response(null, { status: 200, headers: { "content-range": `0-0/${count}` } });
      }
      const range = new Headers(init?.headers).get("Range")!;
      const [start, end] = range.split("-").map(Number);
      return Response.json(allRows.slice(start, end + 1));
    });
    const result = await new PostgrestReportDataStore(baseUrl, key, fetcher).get();
    expect(result.activities).toHaveLength(1001);
    const pages = fetcher.mock.calls.filter(([input, init]) =>
      new URL(String(input)).pathname.endsWith("/activities") && init?.method === "GET");
    expect(pages).toHaveLength(2);
    expect(new Headers(pages[1][1]?.headers).get("Range")).toBe("1000-1999");
  });

  it("fails closed when the database does not return an exact count", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200, headers: { "content-range": "0-0/*" } }),
    );
    await expect(new PostgrestReportDataStore(baseUrl, key, fetcher).get()).rejects.toThrow("exact total");
  });

  it("rejects malformed activity rows and incomplete pagination", async () => {
    const malformed = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `0-0/${url.pathname.endsWith("/users") ? 0 : 1}` } });
      return Response.json([{ id: "bad" }]);
    });
    await expect(new PostgrestReportDataStore(baseUrl, key, malformed).get()).rejects.toThrow("activity row is invalid");

    const incomplete = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `0-0/${url.pathname.endsWith("/users") ? 0 : 2}` } });
      const offset = Number(new Headers(init?.headers).get("Range")?.split("-")[0] ?? 0);
      return Response.json(offset === 0 ? [row("only-one")] : []);
    });
    await expect(new PostgrestReportDataStore(baseUrl, key, incomplete).get()).rejects.toThrow("pagination ended before the exact count");
  });

  it("sends secret API keys only as apikey and does not forward browser credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return countResponse(url);
      return Response.json([row("activity-1")]);
    });
    await new PostgrestReportDataStore(baseUrl, key, fetcher).get();
    const request = fetcher.mock.calls[0];
    const headers = new Headers(request[1]?.headers);
    expect(headers.get("apikey")).toBe(key);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
  });
});
