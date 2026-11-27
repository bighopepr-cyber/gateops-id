export type ActivityHistoryQuery = {
  from?: string;
  to?: string;
  personnelName?: string;
  nrp?: string;
  gate?: string;
  destination?: string;
  status?: "AKTIF" | "SELESAI";
  page: number;
  pageSize: number;
};

export type ActivityHistoryQueryResult =
  | { success: true; data: ActivityHistoryQuery }
  | { success: false; error: string };

function optionalText(params: URLSearchParams, name: string, max: number): string | undefined | null {
  const raw = params.get(name);
  if (raw === null) return undefined;
  const value = raw.trim();
  if (value.length > max) return null;
  return value || undefined;
}

function optionalDate(params: URLSearchParams, name: string): string | undefined | null {
  const value = params.get(name);
  if (value === null) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function pageNumber(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number | null {
  const value = params.get(name);
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function parseActivityHistoryQuery(params: URLSearchParams): ActivityHistoryQueryResult {
  const from = optionalDate(params, "from");
  const to = optionalDate(params, "to");
  const personnelName = optionalText(params, "personnelName", 160);
  const nrp = optionalText(params, "nrp", 40);
  const gate = optionalText(params, "gate", 120);
  const destination = optionalText(params, "destination", 240);
  const status = params.get("status") || undefined;
  const page = pageNumber(params, "page", 1, 1, 100000);
  const pageSize = pageNumber(params, "pageSize", 20, 1, 50);

  if (from === null || to === null || personnelName === null || nrp === null || gate === null || destination === null ||
      page === null || pageSize === null || (status !== undefined && status !== "AKTIF" && status !== "SELESAI") ||
      (from && to && new Date(from).getTime() > new Date(to).getTime())) {
    return { success: false, error: "Filter riwayat tidak valid." };
  }
  const data: ActivityHistoryQuery = { page, pageSize };
  if (from) data.from = from;
  if (to) data.to = to;
  if (personnelName) data.personnelName = personnelName;
  if (nrp) data.nrp = nrp;
  if (gate) data.gate = gate;
  if (destination) data.destination = destination;
  if (status) data.status = status as "AKTIF" | "SELESAI";
  return { success: true, data };
}
