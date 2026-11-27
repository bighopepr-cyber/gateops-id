import { getGpsStatus } from "../../../src/lib/gps-status.ts";

type ActivityRow = { destination: string; purpose: string; exit_at: string };
type GpsLocationRow = {
  id: string; display_name: string; nrp: string | null; rank: string | null; position: string | null;
  gps_latitude: number; gps_longitude: number; gps_updated_at: string;
  gps_permission_revoked_at: string | null; activities: ActivityRow[] | null;
};

function resolveSecretKey(): string {
  const deno = (globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno;
  const namedKeys = deno?.env.get("SUPABASE_SECRET_KEYS");
  if (namedKeys) {
    const parsed: unknown = JSON.parse(namedKeys);
    if (parsed && typeof parsed === "object" && "default" in parsed && typeof parsed.default === "string") {
      return parsed.default;
    }
    throw new Error("Supabase secret key configuration is invalid");
  }
  return deno?.env.get("SUPABASE_SECRET_KEY") ?? deno?.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export type GpsLocation = {
  id: string; displayName: string; nrp: string | null; rank: string | null; position: string | null;
  gpsLatitude: number; gpsLongitude: number; gpsUpdatedAt: string; gpsPermissionRevokedAt: string | null;
  gpsStatus: "AKTIF" | "OFFLINE"; activities: { destination: string; purpose: string; exitAt: string }[];
};

export class PostgrestGpsLocationStore {
  constructor(
    private readonly baseUrl = ((globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env.get("SUPABASE_URL") ?? ""),
    private readonly apiKey = resolveSecretKey(),
    private readonly request: typeof fetch = fetch,
  ) {
    if (!baseUrl || !apiKey) throw new Error("Supabase database API environment is not configured");
  }

  async list(now = new Date()): Promise<GpsLocation[]> {
    const query = new URLSearchParams({
      select: "id,display_name,nrp,rank,position,gps_latitude,gps_longitude,gps_updated_at,gps_permission_revoked_at,activities:activities!activities_personnel_id_fkey(destination,purpose,exit_at)",
      role: "eq.PERSONEL",
      presence_status: "eq.DI_LUAR",
      gps_latitude: "not.is.null",
      gps_longitude: "not.is.null",
      gps_updated_at: "not.is.null",
      "activities.status": "eq.AKTIF",
      "activities.order": "exit_at.desc",
      "activities.limit": "1",
      order: "gps_updated_at.desc",
    });
    const response = await this.request(
      `${this.baseUrl.replace(/\/$/, "")}/rest/v1/users?${query.toString()}`,
      {
        method: "GET",
        headers: {
          apikey: this.apiKey,
          ...(this.apiKey.startsWith("eyJ") ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`Supabase GPS query failed with status ${response.status}`);
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error("Supabase GPS query returned an invalid response");
    return (value as GpsLocationRow[]).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      nrp: row.nrp,
      rank: row.rank,
      position: row.position,
      gpsLatitude: row.gps_latitude,
      gpsLongitude: row.gps_longitude,
      gpsUpdatedAt: row.gps_updated_at,
      gpsPermissionRevokedAt: row.gps_permission_revoked_at,
      gpsStatus: getGpsStatus(new Date(row.gps_updated_at), now, row.gps_permission_revoked_at ? new Date(row.gps_permission_revoked_at) : null),
      activities: (row.activities ?? []).map((activity) => ({
        destination: activity.destination,
        purpose: activity.purpose,
        exitAt: activity.exit_at,
      })),
    }));
  }
}
