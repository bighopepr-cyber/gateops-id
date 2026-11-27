import { getGpsStatus } from "../../../src/lib/gps-status.ts";

type OutsideRow = {
  id: string; display_name: string; nrp: string | null; rank: string | null; position: string | null;
  gps_latitude: number | null; gps_longitude: number | null; gps_updated_at: string | null; gps_permission_revoked_at: string | null;
  activities: { destination: string; purpose: string; exit_at: string; exit_gate: { name: string } }[] | null;
};
type ActivityRow = {
  id: string; status: "AKTIF" | "SELESAI"; exit_at: string; return_at: string | null;
  personnel: { display_name: string; nrp: string | null };
  exit_gate: { name: string }; return_gate: { name: string } | null;
};
export type CommandDashboardData = {
  statistics: { totalPersonnel: number; insidePersonnel: number; outsidePersonnel: number };
  outsidePersonnel: {
    id: string; displayName: string; nrp: string | null; rank: string | null; position: string | null;
    exitGate: string; destination: string; purpose: string; exitAt: string | null; gpsStatus: "AKTIF" | "OFFLINE" | null;
  }[];
  latestActivities: {
    id: string; personnelName: string; nrp: string | null; gate: string; type: "KELUAR" | "KEMBALI";
    occurredAt: string; status: "AKTIF" | "SELESAI";
  }[];
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

export class PostgrestCommandDashboardStore {
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

  private async count(query: URLSearchParams): Promise<number> {
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/users?${query}`, {
      method: "HEAD", headers: this.headers({ Prefer: "count=exact", Range: "0-0" }), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase count query failed with status ${response.status}`);
    const range = response.headers.get("content-range");
    const total = range?.split("/")[1];
    if (!total || total === "*") throw new Error("Supabase count response is missing an exact total");
    const parsed = Number(total);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Supabase count response is invalid");
    return parsed;
  }

  private async rows<T>(table: string, query: URLSearchParams): Promise<T[]> {
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
      method: "GET", headers: this.headers(), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase ${table} query failed with status ${response.status}`);
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error(`Supabase ${table} query returned an invalid response`);
    return value as T[];
  }

  async get(now = new Date()): Promise<CommandDashboardData> {
    const personel = new URLSearchParams({ role: "eq.PERSONEL" });
    const inside = new URLSearchParams({ role: "eq.PERSONEL", presence_status: "eq.DI_DALAM" });
    const outsideCount = new URLSearchParams({ role: "eq.PERSONEL", presence_status: "eq.DI_LUAR" });
    const outsideQuery = new URLSearchParams({
      select: "id,display_name,nrp,rank,position,gps_latitude,gps_longitude,gps_updated_at,gps_permission_revoked_at,activities:activities!activities_personnel_id_fkey(destination,purpose,exit_at,exit_gate:gates!activities_exit_gate_id_fkey(name))",
      role: "eq.PERSONEL", presence_status: "eq.DI_LUAR", order: "display_name.asc",
      "activities.status": "eq.AKTIF", "activities.order": "exit_at.desc", "activities.limit": "1",
    });
    const activityQuery = new URLSearchParams({
      select: "id,status,exit_at,return_at,personnel:users!activities_personnel_id_fkey(display_name,nrp),exit_gate:gates!activities_exit_gate_id_fkey(name),return_gate:gates!activities_return_gate_id_fkey(name)",
      order: "updated_at.desc", limit: "10",
    });
    const [totalPersonnel, insidePersonnel, outsidePersonnelCount, outsideRows, activityRows] = await Promise.all([
      this.count(personel), this.count(inside), this.count(outsideCount),
      this.rows<OutsideRow>("users", outsideQuery), this.rows<ActivityRow>("activities", activityQuery),
    ]);
    const outside = outsideRows.map((person) => {
      const activity = person.activities?.[0];
      const gpsStatus = person.gps_latitude === null || person.gps_longitude === null || !person.gps_updated_at
        ? null
        : getGpsStatus(new Date(person.gps_updated_at), now, person.gps_permission_revoked_at ? new Date(person.gps_permission_revoked_at) : null);
      return {
        id: person.id, displayName: person.display_name, nrp: person.nrp, rank: person.rank, position: person.position,
        exitGate: activity?.exit_gate.name ?? "—", destination: activity?.destination ?? "—", purpose: activity?.purpose ?? "—",
        exitAt: activity?.exit_at ?? null, gpsStatus,
      };
    });
    const activities = activityRows.map((activity) => ({
      id: activity.id, personnelName: activity.personnel.display_name, nrp: activity.personnel.nrp,
      gate: activity.return_at ? activity.return_gate?.name ?? activity.exit_gate.name : activity.exit_gate.name,
      type: activity.return_at ? "KEMBALI" as const : "KELUAR" as const,
      occurredAt: activity.return_at ?? activity.exit_at, status: activity.status,
    }));
    return {
      statistics: { totalPersonnel, insidePersonnel, outsidePersonnel: outsidePersonnelCount },
      outsidePersonnel: outside,
      latestActivities: activities,
    };
  }
}
