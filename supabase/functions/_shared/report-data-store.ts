export type ReportData = {
  statistics: {
    totalPersonnel: number;
    insidePersonnel: number;
    outsidePersonnel: number;
    exitTransactions: number;
    returnTransactions: number;
  };
  activities: {
    id: string;
    personnelName: string;
    nrp: string | null;
    exitGate: string;
    returnGate: string | null;
    exitAt: string;
    returnAt: string | null;
    destination: string;
    purpose: string;
    durationSeconds: number | null;
    status: "AKTIF" | "SELESAI";
  }[];
};

type ActivityRow = {
  id: string;
  destination: string;
  purpose: string;
  status: "AKTIF" | "SELESAI";
  exit_at: string;
  return_at: string | null;
  duration_seconds: number | null;
  personnel: { display_name: string; nrp: string | null };
  exit_gate: { name: string };
  return_gate: { name: string } | null;
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

function assertActivityRow(value: unknown): asserts value is ActivityRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Supabase activity row is invalid");
  const row = value as Record<string, unknown>;
  const relation = (candidate: unknown, nullable = false) =>
    (nullable && candidate === null) || (!!candidate && typeof candidate === "object" && !Array.isArray(candidate));
  if (typeof row.id !== "string" || typeof row.destination !== "string" || typeof row.purpose !== "string" ||
      !["AKTIF", "SELESAI"].includes(String(row.status)) || typeof row.exit_at !== "string" ||
      !(row.return_at === null || typeof row.return_at === "string") ||
      !(row.duration_seconds === null || typeof row.duration_seconds === "number") ||
      !relation(row.personnel) || !relation(row.exit_gate) || !relation(row.return_gate, true)) {
    throw new Error("Supabase activity row is invalid");
  }
  const personnel = row.personnel as Record<string, unknown>;
  const exitGate = row.exit_gate as Record<string, unknown>;
  const returnGate = row.return_gate as Record<string, unknown> | null;
  if (typeof personnel.display_name !== "string" ||
      !(personnel.nrp === null || typeof personnel.nrp === "string") ||
      typeof exitGate.name !== "string" ||
      (returnGate !== null && typeof returnGate.name !== "string")) {
    throw new Error("Supabase activity relation is invalid");
  }
}

export class PostgrestReportDataStore {
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

  private async count(table: string, query: URLSearchParams): Promise<number> {
    const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
      method: "HEAD", headers: this.headers({ Prefer: "count=exact", Range: "0-0" }), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase ${table} count query failed with status ${response.status}`);
    const total = response.headers.get("content-range")?.split("/")[1];
    if (!total || total === "*") throw new Error("Supabase count response is missing an exact total");
    const parsed = Number(total);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Supabase count response is invalid");
    return parsed;
  }

  private async activities(total: number): Promise<ActivityRow[]> {
    const rows: ActivityRow[] = [];
    const pageSize = 1000;
    const query = new URLSearchParams({
      select: "id,destination,purpose,status,exit_at,return_at,duration_seconds,personnel:users!activities_personnel_id_fkey(display_name,nrp),exit_gate:gates!activities_exit_gate_id_fkey(name),return_gate:gates!activities_return_gate_id_fkey(name)",
      order: "exit_at.desc,id.desc",
    });
    while (rows.length < total) {
      const offset = rows.length;
      const response = await this.request(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/activities?${query}`, {
        method: "GET",
        headers: this.headers({ "Range-Unit": "items", Range: `${offset}-${offset + pageSize - 1}` }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Supabase activities query failed with status ${response.status}`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Supabase activities query returned an invalid response");
      if (value.length === 0) throw new Error("Supabase activities pagination ended before the exact count");
      for (const row of value) assertActivityRow(row);
      rows.push(...value);
      if (value.length > pageSize) throw new Error("Supabase activities page exceeded the requested range");
    }
    if (rows.length !== total) throw new Error("Supabase activities result does not match the exact count");
    return rows;
  }

  async get(): Promise<ReportData> {
    const personnel = new URLSearchParams({ role: "eq.PERSONEL" });
    const inside = new URLSearchParams({ role: "eq.PERSONEL", presence_status: "eq.DI_DALAM" });
    const outside = new URLSearchParams({ role: "eq.PERSONEL", presence_status: "eq.DI_LUAR" });
    const returned = new URLSearchParams({ return_at: "not.is.null" });
    const [totalPersonnel, insidePersonnel, outsidePersonnel, exitTransactions, returnTransactions] = await Promise.all([
      this.count("users", personnel),
      this.count("users", inside),
      this.count("users", outside),
      this.count("activities", new URLSearchParams()),
      this.count("activities", returned),
    ]);
    const rows = await this.activities(exitTransactions);
    return {
      statistics: { totalPersonnel, insidePersonnel, outsidePersonnel, exitTransactions, returnTransactions },
      activities: rows.map((activity) => ({
        id: activity.id,
        personnelName: activity.personnel.display_name,
        nrp: activity.personnel.nrp,
        exitGate: activity.exit_gate.name,
        returnGate: activity.return_gate?.name ?? null,
        exitAt: new Date(activity.exit_at).toISOString(),
        returnAt: activity.return_at ? new Date(activity.return_at).toISOString() : null,
        destination: activity.destination,
        purpose: activity.purpose,
        durationSeconds: activity.duration_seconds,
        status: activity.status,
      })),
    };
  }
}
