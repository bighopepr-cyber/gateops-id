import type { ActivityHistoryQuery } from "./activity-history-query.ts";

type Relation = { name: string; location?: string };
type ActivityRow = {
  id: string; personnel_id: string; exit_gate_id: string; return_gate_id: string | null;
  destination: string; purpose: string; status: "AKTIF" | "SELESAI";
  exit_at: string; return_at: string | null; duration_seconds: number | null;
  created_at: string; updated_at: string;
  personnel: { display_name: string; nrp: string | null };
  exit_gate: Relation;
  return_gate: Relation | null;
};

export type ActivityHistoryScope = { personnelId?: string };
export type ActivityHistoryResponse = {
  data: ReturnType<typeof mapActivity>[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
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

function mapActivity(row: ActivityRow) {
  return {
    id: row.id,
    personnelId: row.personnel_id,
    exitGateId: row.exit_gate_id,
    returnGateId: row.return_gate_id,
    destination: row.destination,
    purpose: row.purpose,
    status: row.status,
    exitAt: new Date(row.exit_at).toISOString(),
    returnAt: row.return_at ? new Date(row.return_at).toISOString() : null,
    durationSeconds: row.duration_seconds,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    personnel: { displayName: row.personnel.display_name, nrp: row.personnel.nrp },
    exitGate: row.exit_gate,
    returnGate: row.return_gate,
  };
}

function assertActivityRow(value: unknown, includeLocation = false): asserts value is ActivityRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Supabase activity row is invalid");
  const row = value as Record<string, unknown>;
  const relation = (candidate: unknown, nullable = false) =>
    (nullable && candidate === null) || (!!candidate && typeof candidate === "object" && !Array.isArray(candidate));
  if (typeof row.id !== "string" || typeof row.personnel_id !== "string" ||
      typeof row.exit_gate_id !== "string" || !(row.return_gate_id === null || typeof row.return_gate_id === "string") ||
      typeof row.destination !== "string" || typeof row.purpose !== "string" ||
      !["AKTIF", "SELESAI"].includes(String(row.status)) ||
      typeof row.exit_at !== "string" || !(row.return_at === null || typeof row.return_at === "string") ||
      !(row.duration_seconds === null || typeof row.duration_seconds === "number") ||
      typeof row.created_at !== "string" || typeof row.updated_at !== "string" ||
      !relation(row.personnel) || !relation(row.exit_gate) || !relation(row.return_gate, true)) {
    throw new Error("Supabase activity row is invalid");
  }
  const personnel = row.personnel as Record<string, unknown>;
  const exitGate = row.exit_gate as Record<string, unknown>;
  const returnGate = row.return_gate as Record<string, unknown> | null;
  if (typeof personnel.display_name !== "string" ||
      !(personnel.nrp === null || typeof personnel.nrp === "string") ||
      typeof exitGate.name !== "string" ||
      (includeLocation && typeof exitGate.location !== "string") ||
      (returnGate !== null && (typeof returnGate.name !== "string" || (includeLocation && typeof returnGate.location !== "string")))) {
    throw new Error("Supabase activity relation is invalid");
  }
}

function safeIlike(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `ilike."%${escaped}%"`;
}

export class PostgrestActivityHistoryStore {
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

  private async rows<T>(table: string, query: URLSearchParams, range?: string): Promise<T[]> {
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
      method: "GET",
      headers: this.headers(range ? { "Range-Unit": "items", Range: range } : undefined),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase ${table} query failed with status ${response.status}`);
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error(`Supabase ${table} query returned an invalid response`);
    return value as T[];
  }

  private async count(query: URLSearchParams): Promise<number> {
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/activities?${query}`, {
      method: "HEAD", headers: this.headers({ Prefer: "count=exact", Range: "0-0" }), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase activity count query failed with status ${response.status}`);
    const total = response.headers.get("content-range")?.split("/")[1];
    if (!total || total === "*") throw new Error("Supabase activity count response is missing an exact total");
    const parsed = Number(total);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Supabase activity count response is invalid");
    return parsed;
  }

  private async matchingGateIds(gate: string): Promise<string[]> {
    const query = new URLSearchParams({ select: "id", name: safeIlike(gate), order: "id.asc" });
    const ids: string[] = [];
    const pageSize = 1000;
    while (true) {
      const rows = await this.rows<{ id: string }>("gates", query, `${ids.length}-${ids.length + pageSize - 1}`);
      for (const row of rows) {
        if (!row || typeof row.id !== "string") throw new Error("Supabase gate filter returned an invalid row");
        ids.push(row.id);
      }
      if (rows.length < pageSize) return ids;
    }
  }

  private async filters(query: ActivityHistoryQuery, scope: ActivityHistoryScope): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    if (scope.personnelId) params.set("personnel_id", `eq.${scope.personnelId}`);
    if (query.from && query.to) params.set("and", `(exit_at.gte.${query.from},exit_at.lte.${query.to})`);
    else if (query.from) params.set("exit_at", `gte.${query.from}`);
    else if (query.to) params.set("exit_at", `lte.${query.to}`);
    if (query.personnelName) params.set("personnel.display_name", safeIlike(query.personnelName));
    if (query.nrp) params.set("personnel.nrp", safeIlike(query.nrp));
    if (query.destination) params.set("destination", safeIlike(query.destination));
    if (query.status) params.set("status", `eq.${query.status}`);
    if (query.gate) {
      const ids = await this.matchingGateIds(query.gate);
      if (ids.length === 0) return new URLSearchParams({ id: "eq.__no_matching_gate__" });
      const list = ids.join(",");
      params.set("or", `(exit_gate_id.in.(${list}),return_gate_id.in.(${list}))`);
    }
    return params;
  }

  async list(query: ActivityHistoryQuery, scope: ActivityHistoryScope = {}): Promise<ActivityHistoryResponse> {
    const filters = await this.filters(query, scope);
    const countQuery = new URLSearchParams(filters);
    countQuery.set("select", "id,personnel:users!activities_personnel_id_fkey!inner(id)");
    const total = await this.count(countQuery);
    const offset = (query.page - 1) * query.pageSize;
    let rows: ActivityRow[] = [];
    if (offset < total) {
      const dataQuery = new URLSearchParams(filters);
      dataQuery.set("select", "id,personnel_id,exit_gate_id,return_gate_id,destination,purpose,status,exit_at,return_at,duration_seconds,created_at,updated_at,personnel:users!activities_personnel_id_fkey!inner(display_name,nrp),exit_gate:gates!activities_exit_gate_id_fkey(name),return_gate:gates!activities_return_gate_id_fkey(name)");
      dataQuery.set("order", "exit_at.desc");
      const values = await this.rows<ActivityRow>("activities", dataQuery, `${offset}-${offset + query.pageSize - 1}`);
      if (values.length > query.pageSize) throw new Error("Supabase activity page exceeded requested size");
      for (const row of values) assertActivityRow(row);
      rows = values;
    }
    return {
      data: rows.map(mapActivity),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async detail(id: string, scope: ActivityHistoryScope = {}) {
    const query = new URLSearchParams({
      select: "id,personnel_id,exit_gate_id,return_gate_id,destination,purpose,status,exit_at,return_at,duration_seconds,created_at,updated_at,personnel:users!activities_personnel_id_fkey!inner(display_name,nrp),exit_gate:gates!activities_exit_gate_id_fkey(name,location),return_gate:gates!activities_return_gate_id_fkey(name,location)",
      id: `eq.${id}`,
      limit: "1",
    });
    if (scope.personnelId) query.set("personnel_id", `eq.${scope.personnelId}`);
    const rows = await this.rows<ActivityRow>("activities", query);
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("Supabase activity detail returned multiple rows");
    assertActivityRow(rows[0], true);
    return { data: mapActivity(rows[0]) };
  }
}
