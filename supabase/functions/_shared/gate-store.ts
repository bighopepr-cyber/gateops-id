export type GateActor = { id: string; username: string; displayName: string; role: "SUPER_ADMIN" };
export type GateInput = { name: string; location: string; status: "AKTIF" | "NONAKTIF" };
type GateRow = { id: string; name: string; location: string; status: "AKTIF" | "NONAKTIF"; created_at: string; updated_at: string };
const env = (globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env;
function secretKey(): string {
  const named = env?.get("SUPABASE_SECRET_KEYS");
  if (named) {
    const parsed: unknown = JSON.parse(named);
    if (parsed && typeof parsed === "object" && "default" in parsed && typeof parsed.default === "string") return parsed.default;
    throw new Error("Supabase secret key configuration is invalid");
  }
  return env?.get("SUPABASE_SECRET_KEY") ?? env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
function assertGateRow(value: unknown): asserts value is GateRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Supabase gate row is invalid");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.location !== "string" ||
      !["AKTIF", "NONAKTIF"].includes(String(row.status)) ||
      typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) {
    throw new Error("Supabase gate row is invalid");
  }
}
export async function hashGateCredential(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function createHashedGateCredential(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const token = btoa(binary).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
  return { token, tokenHash: await hashGateCredential(token) };
}
export class PostgrestGateStore {
  constructor(
    private readonly baseUrl = env?.get("SUPABASE_URL") ?? "",
    private readonly apiKey = secretKey(),
    private readonly request: typeof fetch = fetch,
  ) {
    if (!baseUrl || !apiKey) throw new Error("Supabase database API environment is not configured");
  }
  private get rootUrl(): string { return this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl; }
  private headers(extra?: Record<string, string>): HeadersInit {
    return { apikey: this.apiKey, ...(this.apiKey.startsWith("eyJ") ? { Authorization: `Bearer ${this.apiKey}` } : {}), Accept: "application/json", ...extra };
  }
  async list() {
    const countQuery = new URLSearchParams({ select: "id" });
    const countResponse = await this.request(`${this.rootUrl}/rest/v1/gates?${countQuery}`, {
      method: "HEAD", headers: this.headers({ Prefer: "count=exact", Range: "0-0" }), cache: "no-store",
    });
    if (!countResponse.ok) throw new Error(`Supabase gates count failed with status ${countResponse.status}`);
    const rawTotal = countResponse.headers.get("content-range")?.split("/")[1];
    if (!rawTotal || rawTotal === "*") throw new Error("Supabase gates count is missing an exact total");
    const total = Number(rawTotal);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error("Supabase gates count is invalid");
    const rows: GateRow[] = [];
    const pageSize = 1000;
    while (rows.length < total) {
      const offset = rows.length;
      const query = new URLSearchParams({ select: "id,name,location,status,created_at,updated_at", order: "created_at.desc,name.asc" });
      const response = await this.request(`${this.rootUrl}/rest/v1/gates?${query}`, {
        headers: this.headers({ "Range-Unit": "items", Range: `${offset}-${offset + pageSize - 1}` }), cache: "no-store",
      });
      if (!response.ok) throw new Error(`Supabase gates query failed with status ${response.status}`);
      const value: unknown = await response.json();
      const expected = Math.min(pageSize, total - offset);
      if (!Array.isArray(value) || value.length !== expected) throw new Error("Supabase gates page does not match the exact count");
      value.forEach(assertGateRow);
      rows.push(...value);
    }
    return { data: rows.map(row => ({ id: row.id, name: row.name, location: row.location, status: row.status, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() })) };
  }
  private async rpc(name: string, body: Record<string, unknown>): Promise<GateRow | null> {
    const response = await this.request(`${this.rootUrl}/rest/v1/rpc/${name}`, {
      method: "POST", headers: this.headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(body), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase gate RPC failed with status ${response.status}`);
    const value: unknown = await response.json();
    if (!Array.isArray(value) || value.length > 1) throw new Error("Supabase gate RPC returned an invalid response");
    if (value.length === 0) return null;
    assertGateRow(value[0]);
    return value[0];
  }
  async create(input: GateInput, credential: { tokenHash: string }, actor: GateActor) {
    const row = await this.rpc("gateops_create_gate", {
      p_id: crypto.randomUUID(), p_name: input.name, p_location: input.location, p_status: input.status,
      p_qr_token_hash: credential.tokenHash, p_actor_user_id: actor.id, p_actor_username: actor.username,
      p_actor_display_name: actor.displayName, p_actor_role: actor.role,
    });
    if (!row) throw new Error("Supabase gate create RPC returned no row");
    return this.map(row);
  }
  async update(id: string, input: GateInput, actor: GateActor) {
    const row = await this.rpc("gateops_update_gate", {
      p_id: id, p_name: input.name, p_location: input.location, p_status: input.status,
      p_actor_user_id: actor.id, p_actor_username: actor.username,
      p_actor_display_name: actor.displayName, p_actor_role: actor.role,
    });
    return row ? this.map(row) : null;
  }
  private map(row: GateRow) {
    return { id: row.id, name: row.name, location: row.location, status: row.status, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
  }
}
