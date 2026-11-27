import { describe, expect, it, vi } from "vitest";
import { createHashedGateCredential, hashGateCredential, PostgrestGateStore } from "./gate-store.ts";
const baseUrl = "https://project.supabase.co";
const key = "sb_secret_test_key";
const actor = { id: "admin-1", username: "admin", displayName: "Admin", role: "SUPER_ADMIN" as const };
const gate = { id: "gate-1", name: "Gerbang Utama", location: "Depan", status: "AKTIF", created_at: "2026-11-27T08:00:00.000Z", updated_at: "2026-11-27T08:00:00.000Z" };
describe("Gate Edge store", () => {
  it("creates a 256-bit URL-safe credential and stores only its SHA-256 digest", async () => {
    const first = await createHashedGateCredential();
    const second = await createHashedGateCredential();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toBe(await hashGateCredential(first.token));
    expect(first.tokenHash).not.toBe(first.token);
  });
  it("lists Gate rows in the established order and validates returned fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-range": "0-0/1" } }) : Response.json([gate]));
    const result = await new PostgrestGateStore(baseUrl, key, fetcher).list();
    expect(result.data[0]).toMatchObject({ id: "gate-1", name: "Gerbang Utama", status: "AKTIF" });
    const get = fetcher.mock.calls.find(([, init]) => init?.method !== "HEAD");
    const url = new URL(String(get?.[0]));
    expect(url.searchParams.get("order")).toBe("created_at.desc,name.asc");
    expect(url.searchParams.get("select")).not.toContain("qr_token_hash");
  });
  it("creates a Gate through the atomic RPC and never returns its raw token from the store", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([gate]));
    const store = new PostgrestGateStore(baseUrl, key, fetcher);
    const result = await store.create({ name: "Gerbang Utama", location: "Depan", status: "AKTIF" }, { tokenHash: "a".repeat(64) }, actor);
    expect(result).toMatchObject({ id: "gate-1", name: "Gerbang Utama" });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("/rest/v1/rpc/gateops_create_gate");
    const body = JSON.parse(String(init?.body));
    expect(body.p_qr_token_hash).toBe("a".repeat(64));
    expect(body.p_actor_user_id).toBe(actor.id);
    expect(JSON.stringify(result)).not.toContain("qr_token_hash");
  });
  it("updates only mutable Gate fields through an atomic RPC", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([gate]));
    const result = await new PostgrestGateStore(baseUrl, key, fetcher).update("gate-1", { name: "Gerbang Utama", location: "Depan", status: "NONAKTIF" }, actor);
    expect(result?.id).toBe("gate-1");
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("/rest/v1/rpc/gateops_update_gate");
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty("p_qr_token_hash");
    expect(body.p_id).toBe("gate-1");
  });
  it("returns null for an unknown Gate and fails closed on malformed rows", async () => {
    const missing = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
    await expect(new PostgrestGateStore(baseUrl, key, missing).update("missing", { name: "x", location: "y", status: "AKTIF" }, actor)).resolves.toBeNull();
    const malformed = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-range": "0-0/1" } }) : Response.json([{ ...gate, status: "UNKNOWN" }]));
    await expect(new PostgrestGateStore(baseUrl, key, malformed).list()).rejects.toThrow("gate row is invalid");
  });
});
