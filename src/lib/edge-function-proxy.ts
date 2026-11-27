export type EdgeProxyConfig = { supabaseUrl?: string; publishableKey?: string; serviceKey?: string };
export type EdgeProxyDependencies = { fetcher?: typeof fetch; timeoutMs?: number };

const READ_ONLY_ENDPOINTS = new Set(["whoami","permission","gps-locations","command-dashboard","reports-data","activities","activity-detail","audit-logs"]);
const WRITE_COLLECTION_ENDPOINTS = new Set(["personnel","accounts","gates"]);
const WRITE_ITEM_ENDPOINTS = new Set(["personnel","accounts","gates"]);
const ACTION_ENDPOINTS = new Set(["gps-location","gates/transaction"]);
const ITEM_ACTION_ENDPOINTS = new Set(["reset-password"]);

const SESSION_COOKIE = "gateops_session";

function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const matches = cookieHeader.split(";").map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null;
}

function json(data: unknown, status: number): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validBaseUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" || (url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname)); }
  catch { return false; }
}

export async function proxyGateopsEdgeRequest(request: Request, pathSegments: string[], config: EdgeProxyConfig, dependencies: EdgeProxyDependencies = {}): Promise<Response> {
  const path = pathSegments.join("/");
  const isReadOnly = pathSegments.length === 1 && READ_ONLY_ENDPOINTS.has(pathSegments[0]);
  const isWriteCollection = pathSegments.length === 1 && WRITE_COLLECTION_ENDPOINTS.has(pathSegments[0]);
  const isGpsLocation = pathSegments.length === 1 && pathSegments[0] === "gps-location";
  const isActionEndpoint = pathSegments.length === 2 && ACTION_ENDPOINTS.has(path);
  const isItemActionEndpoint = pathSegments.length === 3 && pathSegments[0] === "accounts" && ITEM_ACTION_ENDPOINTS.has(pathSegments[2]) && /^[A-Za-z0-9_-]{1,191}$/.test(pathSegments[1]);
  const isWriteItem = pathSegments.length === 2 && !isActionEndpoint && WRITE_ITEM_ENDPOINTS.has(pathSegments[0]) && /^[A-Za-z0-9_-]{1,191}$/.test(pathSegments[1]);
  const validPath = isReadOnly || isWriteCollection || isGpsLocation || isActionEndpoint || isItemActionEndpoint || isWriteItem;
  if (!validPath) return json({ error: "Endpoint tidak ditemukan." }, 404);

  let allowed = false;
  if (isReadOnly) allowed = request.method === "GET";
  else if (isWriteCollection) allowed = ["GET","POST"].includes(request.method);
  else if (isGpsLocation) allowed = request.method === "POST";
  else if (isActionEndpoint) allowed = request.method === "POST";
  else if (isItemActionEndpoint) allowed = request.method === "POST";
  else if (isWriteItem) allowed = ["GET","PATCH","DELETE"].includes(request.method);
  if (!allowed) return json({ error: "Metode tidak diizinkan." }, 405);

  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Sesi tidak ditemukan. Silakan login kembali." }, 401);

  const { supabaseUrl, publishableKey, serviceKey } = config;
  if (!supabaseUrl || !validBaseUrl(supabaseUrl) || !publishableKey || publishableKey.length < 10 || !serviceKey || serviceKey.length < 32) {
    return json({ error: "Integrasi backend belum dikonfigurasi." }, 503);
  }

  const upstreamPath = pathSegments.map(segment => encodeURIComponent(segment)).join("/");
  const upstreamUrl = new URL(`/functions/v1/gateops-api/${upstreamPath}`, supabaseUrl.endsWith("/") ? supabaseUrl : `${supabaseUrl}/`);

  const incoming = new URL(request.url).searchParams;

  if (isReadOnly) {
    if (pathSegments[0] === "permission") {
      const permission = incoming.get("name");
      if (!permission || permission.length > 100 || incoming.getAll("name").length !== 1) return json({ error: "Permission tidak valid." }, 400);
      upstreamUrl.searchParams.set("name", permission);
    } else if (pathSegments[0] === "accounts" || pathSegments[0] === "personnel") {
      if (incoming.size) return json({ error: "Endpoint tidak menerima parameter query." }, 400);
    } else if (pathSegments[0] === "activities" || pathSegments[0] === "activity-detail" || pathSegments[0] === "audit-logs") {
      const allowedQuery = pathSegments[0] === "activities" ? new Set(["from","to","personnelName","nrp","gate","destination","status","page","pageSize"]) :
        pathSegments[0] === "audit-logs" ? new Set(["page","pageSize"]) : new Set(["id"]);
      for (const key of incoming.keys()) {
        if (!allowedQuery.has(key) || incoming.getAll(key).length !== 1) return json({ error: "Parameter query tidak valid." }, 400);
        const value = incoming.get(key) ?? "";
        if (key === "id" && !/^[A-Za-z0-9_-]{1,191}$/.test(value)) return json({ error: "ID aktivitas tidak valid." }, 400);
        upstreamUrl.searchParams.set(key, value);
      }
    } else if (incoming.size) return json({ error: "Parameter query tidak diizinkan." }, 400);
  } else if (incoming.size) {
    return json({ error: "Endpoint tidak menerima parameter query." }, 400);
  }

  let body: string | undefined;
  if (request.method === "POST" || request.method === "PATCH") {
    if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format permintaan tidak valid." }, 400);
    body = await request.text();
    if (!body || body.length > 8192) return json({ error: "Ukuran permintaan tidak valid." }, 413);
    try { JSON.parse(body); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 10_000);
  try {
    const upstream = await (dependencies.fetcher ?? fetch)(upstreamUrl, {
      method: request.method, ...(body ? { body } : {}),
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), apikey: publishableKey,
        "x-gateops-service-key": serviceKey, Cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store", signal: controller.signal,
    });

    if (!(upstream.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "Respons backend tidak valid." }, 502);
    let payload: unknown;
    try { payload = await upstream.json(); } catch { return json({ error: "Respons backend tidak valid." }, 502); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "Respons backend tidak valid." }, 502);
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string") return json({ error: record.error }, upstream.status);
    if (!upstream.ok || !("data" in record)) return json({ error: "Permintaan ke backend gagal." }, upstream.status >= 400 ? upstream.status : 502);

    const responseBody: Record<string, unknown> = { data: record.data };

    if (isWriteCollection && request.method === "POST" && pathSegments[0] === "gates") {
      if (typeof record.qrCredential !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(record.qrCredential)) return json({ error: "Kredensial QR dari backend tidak valid." }, 502);
      responseBody.qrCredential = record.qrCredential;
    }

    if (pathSegments[0] === "activities" || pathSegments[0] === "audit-logs") {
      if (!Array.isArray(record.data) || !record.pagination || typeof record.pagination !== "object" || Array.isArray(record.pagination)) return json({ error: "Metadata pagination backend tidak valid." }, 502);
      const value = record.pagination as Record<string, unknown>;
      const maxPageSize = pathSegments[0] === "activities" ? 50 : 100;
      if (typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.page > 100000 ||
          typeof value.pageSize !== "number" || !Number.isSafeInteger(value.pageSize) || value.pageSize < 1 || value.pageSize > maxPageSize ||
          typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 ||
          typeof value.totalPages !== "number" || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0) return json({ error: "Metadata pagination backend tidak valid." }, 502);
      responseBody.pagination = { page: value.page, pageSize: value.pageSize, total: value.total, totalPages: value.totalPages };
    }

    return json(responseBody, upstream.status);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return json({ error: "Backend tidak merespons tepat waktu." }, 504);
    return json({ error: "Backend sementara tidak tersedia." }, 502);
  } finally { clearTimeout(timeout); }
}
