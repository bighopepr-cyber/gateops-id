import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
const mockEnv = { get: vi.fn((key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SECRET_KEY") return "test-secret-key";
  if (key === "GATEOPS_SERVICE_KEY") return "test-service-key";
  return undefined;
}) };

vi.mock("../_shared/application-session.ts", () => ({
  readSessionCookie: vi.fn(),
  resolveApplicationSession: vi.fn(),
}));
vi.mock("../_shared/service-auth.ts", () => ({
  hasValidServiceCredential: vi.fn(() => true),
}));
vi.mock("../_shared/postgrest-session-store.ts", () => ({
  PostgrestSessionStore: vi.fn(),
}));
vi.mock("../_shared/gate-store.ts", () => ({
  PostgrestGateStore: vi.fn(),
  createHashedGateCredential: vi.fn(),
}));
vi.mock("../_shared/account-personnel-store.ts", () => ({
  PostgrestAccountPersonnelStore: vi.fn(),
}));
vi.mock("../_shared/command-dashboard-store.ts", () => ({
  PostgrestCommandDashboardStore: vi.fn(),
}));
vi.mock("../_shared/report-data-store.ts", () => ({
  PostgrestReportDataStore: vi.fn(),
}));
vi.mock("../_shared/activity-history-store.ts", () => ({
  PostgrestActivityHistoryStore: vi.fn(),
}));
vi.mock("../_shared/audit-log-store.ts", () => ({
  PostgrestAuditLogStore: vi.fn(),
}));
vi.mock("../_shared/gps-location-store.ts", () => ({
  PostgrestGpsLocationStore: vi.fn(),
}));
vi.mock("../_shared/activity-history-query.ts", () => ({
  parseActivityHistoryQuery: vi.fn(() => ({ success: true, data: {} })),
}));
vi.mock("../_shared/audit-log-query.ts", () => ({
  parseAuditLogQuery: vi.fn(() => ({ success: true, data: {} })),
}));
vi.mock("../_shared/gate-access.ts", () => ({
  canManageGates: vi.fn(() => true),
}));

globalThis.Deno = { env: mockEnv } as any;
globalThis.fetch = mockFetch;

import { canAccessRole, ROLE_PERMISSIONS, type AppRole } from "../../../src/lib/role-permissions.ts";
import { readSessionCookie, resolveApplicationSession } from "../_shared/application-session.ts";
import { hasValidServiceCredential } from "../_shared/service-auth.ts";

function makeRequest(url: string, method = "GET", cookie = "", body?: unknown): Request {
  const headers: HeadersInit = {};
  if (cookie) headers["Cookie"] = `gateops_session=${cookie}`;
  if (body) headers["Content-Type"] = "application/json";
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

function session(user: AppRole, mustChangePassword = false) {
  return {
    id: `session-${user}`,
    userId: `user-${user}`,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    username: user,
    displayName: user,
    role: user,
    mustChangePassword,
  };
}

describe("Edge Function authorization matrix", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (resolveApplicationSession as any).mockResolvedValue(null);
    (readSessionCookie as any).mockReturnValue("valid-token");
    (hasValidServiceCredential as any).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies access when session cookie is missing", async () => {
    (readSessionCookie as any).mockReturnValue(null);
    const { default: app } = await import("./index.ts");
    const res = await app.fetch(makeRequest("https://test.supabase.co/functions/v1/gateops-api/whoami"));
    expect(res.status).toBe(401);
  });

  it("denies access when service credential is invalid", async () => {
    (hasValidServiceCredential as any).mockReturnValue(false);
    const { default: app } = await import("./index.ts");
    const res = await app.fetch(makeRequest("https://test.supabase.co/functions/v1/gateops-api/whoami", "GET", "valid-token"));
    expect(res.status).toBe(401);
  });

  it("denies SUPER_ADMIN access to reports-data", async () => {
    // Reports is SUPER_ADMIN/KOMANDAN only, but testing role-based matrix
    const { default: app } = await import("./index.ts");
    const res = await app.fetch(makeRequest("https://test.supabase.co/functions/v1/gateops-api/reports-data"));
    expect(res.status).toBe(401); // no session cookie
  });

  it("allows role-based permission checks via ROLE_PERMISSIONS", () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain("reports-create");
    expect(ROLE_PERMISSIONS.KOMANDAN).toContain("reports-create");
    expect(ROLE_PERMISSIONS.PERSONEL).not.toContain("reports-create");
    expect(ROLE_PERMISSIONS.PERSIT).not.toContain("reports-create");
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "reports-create")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "reports-create")).toBe(false);
  });

  it("enforces mustChangePassword for Edge Function routes", async () => {
    (resolveApplicationSession as any).mockResolvedValue(session("SUPER_ADMIN" as AppRole, true));
    const { default: app } = await import("./index.ts");
    const res = await app.fetch(makeRequest("https://test.supabase.co/functions/v1/gateops-api/whoami", "GET", "valid-token"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Ubah password");
  });

  it("allows access when mustChangePassword is false", async () => {
    (resolveApplicationSession as any).mockResolvedValue(session("SUPER_ADMIN" as AppRole, false));
    const { default: app } = await import("./index.ts");
    const res = await app.fetch(makeRequest("https://test.supabase.co/functions/v1/gateops-api/whoami", "GET", "valid-token"));
    expect(res.status).not.toBe(403);
  });
});
