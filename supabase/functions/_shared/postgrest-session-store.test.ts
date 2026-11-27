import { describe, expect, it } from "vitest";
import { PostgrestSessionStore } from "./postgrest-session-store";

describe("PostgrestSessionStore", () => {
  it("queries active sessions and users using the server-only API key", async () => {
    const requests: Array<{ url: URL; headers: Headers }> = [];
    const responses = [
      [{ id: "session-1", user_id: "user-1", expires_at: "2026-11-27T10:00:00.000Z" }],
      [{ id: "user-1", username: "komandan", display_name: "Komandan", role: "KOMANDAN", must_change_password: false }],
    ];
    const store = new PostgrestSessionStore(
      "https://project.supabase.co/",
      "server-only-secret",
      async (input, init) => {
        requests.push({ url: new URL(String(input)), headers: new Headers(init?.headers) });
        return Response.json(responses[requests.length - 1]);
      },
    );
    const record = await store.findActiveSession("a".repeat(64), new Date("2026-11-27T09:00:00.000Z"));

    expect(record).toMatchObject({ sessionId: "session-1", userId: "user-1", username: "komandan", role: "KOMANDAN" });
    expect(requests).toHaveLength(2);
    expect(requests[0].url.pathname).toBe("/rest/v1/sessions");
    expect(requests[0].url.searchParams.get("token_hash")).toBe(`eq.${"a".repeat(64)}`);
    expect(requests[0].url.searchParams.get("expires_at")).toBe("gt.2026-11-27T09:00:00.000Z");
    expect(requests[1].url.pathname).toBe("/rest/v1/users");
    expect(requests[1].url.searchParams.get("id")).toBe("eq.user-1");
    expect(requests.every(item => item.headers.get("apikey") === "server-only-secret")).toBe(true);
    expect(requests.every(item => item.headers.get("authorization") === null)).toBe(true);
  });

  it("fails closed when Supabase rejects the database request", async () => {
    const store = new PostgrestSessionStore(
      "https://project.supabase.co",
      "server-only-secret",
      async () => new Response("denied", { status: 403 }),
    );
    await expect(store.findActiveSession("b".repeat(64), new Date())).rejects.toThrow("status 403");
  });
});
