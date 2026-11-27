import type { AuditLogQuery } from "./audit-log-query.ts";

type AuditRole = "SUPER_ADMIN" | "KOMANDAN" | "PERSONEL" | "PERSIT";
type AuditMetadata = Record<string, string | number | boolean | null>;
type AuditRow = {
  id: string;
  actor_username: string;
  actor_display_name: string;
  actor_role: AuditRole;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: AuditMetadata;
  created_at: string;
};

export type AuditLogResponse = {
  data: {
    id: string;
    actorUsername: string;
    actorDisplayName: string;
    actorRole: AuditRole;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: AuditMetadata;
    createdAt: string;
  }[];
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

function assertAuditRow(value: unknown): asserts value is AuditRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Supabase audit row is invalid");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.actor_username !== "string" ||
      typeof row.actor_display_name !== "string" ||
      !["SUPER_ADMIN", "KOMANDAN", "PERSONEL", "PERSIT"].includes(String(row.actor_role)) ||
      typeof row.action !== "string" || typeof row.entity_type !== "string" ||
      !(row.entity_id === null || typeof row.entity_id === "string") ||
      !row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata) ||
      typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) {
    throw new Error("Supabase audit row is invalid");
  }
  const forbiddenMetadataKey = /(password|token|secret|cookie|credential|hash|authorization)/i;
  for (const [key, item] of Object.entries(row.metadata as Record<string, unknown>)) {
    if (forbiddenMetadataKey.test(key) ||
        !(item === null || typeof item === "string" || typeof item === "boolean" ||
          (typeof item === "number" && Number.isFinite(item)))) {
      throw new Error("Supabase audit metadata is invalid");
    }
  }
}

export class PostgrestAuditLogStore {
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

  async get(query: AuditLogQuery): Promise<AuditLogResponse> {
    const base = new URLSearchParams({
      select: "id,actor_username,actor_display_name,actor_role,action,entity_type,entity_id,metadata,created_at",
      order: "created_at.desc,id.desc",
    });
    const countQuery = new URLSearchParams({ select: "id" });
    const countResponse = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/audit_logs?${countQuery}`, {
      method: "HEAD",
      headers: this.headers({ Prefer: "count=exact", Range: "0-0" }),
      cache: "no-store",
    });
    if (!countResponse.ok) throw new Error(`Supabase audit count query failed with status ${countResponse.status}`);
    const rawTotal = countResponse.headers.get("content-range")?.split("/")[1];
    if (!rawTotal || rawTotal === "*") throw new Error("Supabase audit count response is missing an exact total");
    const total = Number(rawTotal);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error("Supabase audit count response is invalid");

    const offset = (query.page - 1) * query.pageSize;
    let rows: AuditRow[] = [];
    if (offset < total) {
      const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/audit_logs?${base}`, {
        method: "GET",
        headers: this.headers({ "Range-Unit": "items", Range: `${offset}-${offset + query.pageSize - 1}` }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Supabase audit query failed with status ${response.status}`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Supabase audit query returned an invalid response");
      const expectedRows = Math.min(query.pageSize, total - offset);
      if (value.length !== expectedRows) throw new Error("Supabase audit page does not match the exact count");
      for (const row of value) assertAuditRow(row);
      rows = value;
    }
    return {
      data: rows.map(row => ({
        id: row.id,
        actorUsername: row.actor_username,
        actorDisplayName: row.actor_display_name,
        actorRole: row.actor_role,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: new Date(row.created_at).toISOString(),
      })),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }
}
