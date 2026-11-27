type Role = "SUPER_ADMIN" | "KOMANDAN" | "PERSONEL" | "PERSIT";
type UserRow = {
  id: string; username: string; role?: Role; display_name: string;
  nrp: string | null; rank: string | null; position: string | null;
  must_change_password: boolean; created_at: string; updated_at: string;
};

function secretKey(): string {
  const env = (globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env;
  const named = env?.get("SUPABASE_SECRET_KEYS");
  if (named) {
    const parsed: unknown = JSON.parse(named);
    if (parsed && typeof parsed === "object" && "default" in parsed && typeof parsed.default === "string") return parsed.default;
    throw new Error("Supabase secret key configuration is invalid");
  }
  return env?.get("SUPABASE_SECRET_KEY") ?? env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function assertUserRow(value: unknown, includeRole: boolean): asserts value is UserRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Supabase user row is invalid");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.username !== "string" ||
      (includeRole && !["SUPER_ADMIN", "KOMANDAN", "PERSONEL", "PERSIT"].includes(String(row.role))) ||
      typeof row.display_name !== "string" ||
      !(row.nrp === null || typeof row.nrp === "string") ||
      !(row.rank === null || typeof row.rank === "string") ||
      !(row.position === null || typeof row.position === "string") ||
      typeof row.must_change_password !== "boolean" ||
      typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) {
    throw new Error("Supabase user row is invalid");
  }
}

export class PostgrestAccountPersonnelStore {
  constructor(
    private readonly baseUrl = ((globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env.get("SUPABASE_URL") ?? ""),
    private readonly apiKey = secretKey(),
    private readonly request: typeof fetch = fetch,
  ) {
    if (!baseUrl || !apiKey) throw new Error("Supabase database API environment is not configured");
  }

  private headers(extra?: Record<string, string>): HeadersInit {
    return {
      apikey: this.apiKey,
      ...(this.apiKey.startsWith("eyJ") ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      Accept: "application/json",
      ...extra,
    };
  }

  private async getRows(query: URLSearchParams, total: number, includeRole: boolean) {
    const result: UserRow[] = [];
    const pageSize = 1000;
    while (result.length < total) {
      const offset = result.length;
      const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/users?${query}`, {
        method: "GET",
        headers: this.headers({ "Range-Unit": "items", Range: `${offset}-${offset + pageSize - 1}` }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Supabase users query failed with status ${response.status}`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Supabase users query returned an invalid response");
      if (value.length === 0) throw new Error("Supabase users pagination ended before the exact count");
      if (value.length > pageSize) throw new Error("Supabase users page exceeded requested range");
      for (const row of value) assertUserRow(row, includeRole);
      result.push(...value);
    }
    if (result.length !== total) throw new Error("Supabase users result does not match the exact count");
    return result;
  }

  private async count(filters: URLSearchParams): Promise<number> {
    const query = new URLSearchParams(filters);
    query.set("select", "id");
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/users?${query}`, {
      method: "HEAD",
      headers: this.headers({ Prefer: "count=exact", Range: "0-0" }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase users count query failed with status ${response.status}`);
    const raw = response.headers.get("content-range")?.split("/")[1];
    if (!raw || raw === "*") throw new Error("Supabase users count response is missing an exact total");
    const total = Number(raw);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error("Supabase users count response is invalid");
    return total;
  }

  async listAccounts() {
    const filters = new URLSearchParams();
    const total = await this.count(filters);
    const query = new URLSearchParams({
      select: "id,username,role,display_name,nrp,rank,position,must_change_password,created_at,updated_at",
      order: "role.asc,display_name.asc",
    });
    const rows = total ? await this.getRows(query, total, true) : [];
    return { data: rows.map(row => ({
      id: row.id, username: row.username, role: row.role,
      displayName: row.display_name, nrp: row.nrp, rank: row.rank, position: row.position,
      mustChangePassword: row.must_change_password,
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    })) };
  }

  async listPersonnel() {
    const filters = new URLSearchParams({ role: "eq.PERSONEL" });
    const total = await this.count(filters);
    const query = new URLSearchParams({
      role: "eq.PERSONEL",
      select: "id,username,display_name,nrp,rank,position,must_change_password,created_at,updated_at",
      order: "display_name.asc",
    });
    const rows = total ? await this.getRows(query, total, false) : [];
    return { data: rows.map(row => ({
      id: row.id, username: row.username, displayName: row.display_name,
      nrp: row.nrp, rank: row.rank, position: row.position,
      mustChangePassword: row.must_change_password,
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    })) };
  }
}
