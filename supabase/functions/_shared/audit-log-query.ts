export type AuditLogQuery = { page: number; pageSize: number };
export type AuditLogQueryResult =
  | { success: true; data: AuditLogQuery }
  | { success: false; error: string };

export function parseAuditLogQuery(params: URLSearchParams): AuditLogQueryResult {
  const rawPage = params.get("page");
  const rawPageSize = params.get("pageSize");
  const page = rawPage === null ? 1 : /^\d+$/.test(rawPage) ? Number(rawPage) : NaN;
  const pageSize = rawPageSize === null ? 25 : /^\d+$/.test(rawPageSize) ? Number(rawPageSize) : NaN;
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { success: false, error: "Parameter halaman audit tidak valid." };
  }
  return { success: true, data: { page, pageSize } };
}
