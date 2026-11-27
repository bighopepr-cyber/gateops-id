import { canAccessRole, ROLE_PERMISSIONS, type AppRole } from "../../../src/lib/role-permissions.ts";
import { readSessionCookie, resolveApplicationSession, type ApplicationUser } from "../_shared/application-session.ts";
import { PostgrestSessionStore } from "../_shared/postgrest-session-store.ts";
import { PostgrestGpsLocationStore } from "../_shared/gps-location-store.ts";
import { PostgrestCommandDashboardStore } from "../_shared/command-dashboard-store.ts";
import { PostgrestReportDataStore } from "../_shared/report-data-store.ts";
import { parseActivityHistoryQuery } from "../_shared/activity-history-query.ts";
import { PostgrestActivityHistoryStore } from "../_shared/activity-history-store.ts";
import { parseAuditLogQuery } from "../_shared/audit-log-query.ts";
import { PostgrestAuditLogStore } from "../_shared/audit-log-store.ts";
import { PostgrestAccountPersonnelStore } from "../_shared/account-personnel-store.ts";
import { createHashedGateCredential, PostgrestGateStore } from "../_shared/gate-store.ts";
import { canManageGates } from "../_shared/gate-access.ts";
import { hasValidServiceCredential } from "../_shared/service-auth.ts";

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

const env = (globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } } }).Deno?.env;
function secretKey(): string {
  const named = env?.get("SUPABASE_SECRET_KEYS");
  if (named) {
    const parsed: unknown = JSON.parse(named);
    if (parsed && typeof parsed === "object" && "default" in parsed && typeof parsed.default === "string") return parsed.default;
    throw new Error("Supabase secret key configuration is invalid");
  }
  return env?.get("SUPABASE_SECRET_KEY") ?? env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

async function rpcCall(name: string, body: Record<string, unknown>): Promise<unknown[]> {
  const baseUrl = env?.get("SUPABASE_URL") ?? "";
  const apiKey = secretKey();
  const rootUrl = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${rootUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      ...(apiKey.startsWith("eyJ") ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase RPC ${name} failed with status ${response.status}`);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error(`Supabase RPC ${name} returned an invalid response`);
  return value;
}

async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function actorFromUser(user: ApplicationUser) {
  return {
    p_actor_user_id: user.id,
    p_actor_username: user.username,
    p_actor_display_name: user.displayName,
    p_actor_role: user.role as AppRole,
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const isGateCollection = pathSegments.at(-1) === "gates";
    const gateId = pathSegments.at(-1) ?? "";
    const isGateItem = pathSegments.at(-2) === "gates" && /^[A-Za-z0-9_-]{1,191}$/.test(gateId);

    // Gate routes (collection and item)
    if (isGateCollection || isGateItem) {
      if (!hasValidServiceCredential(request, Deno.env.get("GATEOPS_SERVICE_KEY"))) {
        return json({ error: "Kredensial layanan tidak valid." }, 401);
      }
      const token = readSessionCookie(request.headers.get("cookie"));
      if (!token) return json({ error: "Sesi tidak ditemukan. Silakan login kembali." }, 401);
      try {
        const user = await resolveApplicationSession(new PostgrestSessionStore(), token);
        if (!user) return json({ error: "Sesi tidak valid atau telah berakhir." }, 401);
        if (user.mustChangePassword) return json({ error: "Ubah password terlebih dahulu sebelum melanjutkan." }, 403);
        if (!canManageGates(user.role)) {
          return json({ error: "Pengelolaan Gate hanya tersedia untuk Super Admin." }, 403);
        }
        const store = new PostgrestGateStore();
        if (request.method === "GET" && isGateCollection) return json(await store.list());
        if (request.method === "DELETE" && isGateItem) {
          const row = await rpcCall("gateops_delete_gate", {
            p_id: gateId,
            ...actorFromUser(user),
          });
          if (row.length === 0) return json({ error: "Gate tidak ditemukan." }, 404);
          return json({ data: row[0] });
        }
        if (request.method !== "GET" && !((isGateCollection && request.method === "POST") || (isGateItem && request.method === "PATCH"))) {
          return json({ error: "Method atau endpoint tidak diizinkan." }, 405);
        }
        if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format permintaan tidak valid." }, 400);
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
        if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Format permintaan tidak valid." }, 400);
        const input = body as Record<string, unknown>;
        const name = typeof input.name === "string" ? input.name.trim() : "";
        const location = typeof input.location === "string" ? input.location.trim() : "";
        const statusValue = input.status === undefined && request.method === "POST" ? "AKTIF" : input.status;
        if (!name || name.length > 120 || !location || location.length > 240 || (statusValue !== "AKTIF" && statusValue !== "NONAKTIF") ||
            Object.keys(input).some(key => !["name", "location", "status"].includes(key))) {
          return json({ error: "Periksa nama, lokasi, dan status gate.", fields: {} }, 422);
        }
        const gateInput: { name: string; location: string; status: "AKTIF" | "NONAKTIF" } = { name, location, status: statusValue as "AKTIF" | "NONAKTIF" };
        const actor = { id: user.id, username: user.username, displayName: user.displayName, role: "SUPER_ADMIN" as const };
        if (request.method === "POST") {
          const credential = await createHashedGateCredential();
          const data = await store.create(gateInput, { tokenHash: credential.tokenHash }, actor);
          return json({ data, qrCredential: credential.token }, 201);
        }
        const updated = await store.update(gateId, gateInput, actor);
        if (!updated) return json({ error: "Gate tidak ditemukan." }, 404);
        return json({ data: updated });
      } catch {
        return json({ error: "Layanan backend sementara tidak tersedia." }, 503);
      }
    }

    // All other routes require service credential and session
    if (!hasValidServiceCredential(request, Deno.env.get("GATEOPS_SERVICE_KEY"))) {
      return json({ error: "Kredensial layanan tidak valid." }, 401);
    }
    const token = readSessionCookie(request.headers.get("cookie"));
    if (!token) return json({ error: "Sesi tidak ditemukan. Silakan login kembali." }, 401);
    try {
      const user = await resolveApplicationSession(new PostgrestSessionStore(), token);
      if (!user) return json({ error: "Sesi tidak valid atau telah berakhir." }, 401);
      if (user.mustChangePassword) return json({ error: "Ubah password terlebih dahulu sebelum melanjutkan." }, 403);

      // POST /gates/transaction - gate exit/return transaction (PERSONEL only)
      if (pathSegments.length === 2 && pathSegments[0] === "gates" && pathSegments[1] === "transaction" && request.method === "POST") {
        if (!canAccessRole(user.role, "presence-transact") || user.role !== "PERSONEL") {
          return json({ error: "Akses transaksi hanya tersedia untuk Personel." }, 403);
        }
        if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format permintaan tidak valid." }, 400);
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
        const input = body as Record<string, unknown>;
        const credential = typeof input.credential === "string" ? input.credential : "";
        const destination = typeof input.destination === "string" ? input.destination.trim() : null;
        const purpose = typeof input.purpose === "string" ? input.purpose.trim() : null;
        if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) {
          return json({ error: "QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi" }, 404);
        }
        try {
          const result = await rpcCall("gateops_personnel_transaction", {
            p_personnel_id: user.id,
            p_gate_credential: credential,
            p_destination: destination,
            p_purpose: purpose,
            ...actorFromUser(user),
          });
          const row = result[0];
          if (!row || typeof row !== "object") return json({ error: "Respons transaksi tidak valid." }, 502);
          const kind = String(row.kind);
          if (kind === "BUSY") return json({ error: "Transaksi QR sebelumnya masih diproses." }, 409);
          if (kind === "SESSION_EXPIRED") return json({ error: "Sesi login berakhir. Silakan login kembali." }, 401);
          if (kind === "INVALID_GATE") return json({ error: "QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi" }, 404);
          if (kind === "INVALID_PERSONNEL") return json({ error: "Data personel tidak valid." }, 404);
          if (kind === "INVALID_FORM") return json({ error: "Tujuan dan keperluan wajib diisi sebelum kamera dibuka." }, 422);
          if (kind === "INCONSISTENT_STATE") return json({ error: "Status kehadiran dan aktivitas tidak konsisten." }, 409);
          if (kind === "EXIT") {
            return json({
              message: "Transaksi keluar berhasil. Status kehadiran sekarang DI LUAR.",
              data: { id: row.activity_id, direction: "KELUAR", presenceStatus: row.presence_status, activityStatus: row.activity_status, gateName: row.gate_name, destination: row.destination, purpose: row.purpose, exitAt: row.exit_at },
            });
          }
          if (kind === "RETURN") {
            return json({
              message: "Transaksi kembali berhasil. Status kehadiran sekarang DI DALAM.",
              data: { id: row.activity_id, direction: "KEMBALI", presenceStatus: row.presence_status, activityStatus: row.activity_status, gateName: row.gate_name, destination: row.destination, purpose: row.purpose, exitAt: row.exit_at, returnAt: row.return_at, durationSeconds: row.duration_seconds },
            });
          }
          return json({ error: "Hasil transaksi tidak dikenal." }, 502);
        } catch {
          return json({ error: "Transaksi gagal disimpan. Status kehadiran dan aktivitas tidak berubah." }, 500);
        }
      }

      // POST /gps-location - GPS location update (PERSONEL only)
      if (pathSegments.length === 1 && pathSegments[0] === "gps-location" && request.method === "POST") {
        if (!canAccessRole(user.role, "gps-update") || user.role !== "PERSONEL") {
          return json({ error: "Update lokasi hanya tersedia untuk Personel." }, 403);
        }
        if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format data GPS tidak valid." }, 400);
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Format data GPS tidak valid." }, 400); }
        const input = body as Record<string, unknown>;
        const permissionRevoked = input.permissionRevoked === true;
        let latitude: number | null = null;
        let longitude: number | null = null;
        if (!permissionRevoked) {
          latitude = typeof input.latitude === "number" ? input.latitude : null;
          longitude = typeof input.longitude === "number" ? input.longitude : null;
          if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return json({ error: "Data GPS tidak valid." }, 422);
          }
        }
        try {
          const result = await rpcCall("gateops_update_gps_location", {
            p_personnel_id: user.id,
            p_latitude: latitude ?? 0,
            p_longitude: longitude ?? 0,
            p_permission_revoked: permissionRevoked,
            ...actorFromUser(user),
          });
          const row = result[0];
          if (!row || typeof row !== "object") return json({ error: "Respons GPS tidak valid." }, 502);
          if (row.saved === false) return json({ error: "Lokasi hanya dapat diperbarui saat status DI_LUAR." }, 409);
          return json({ data: { saved: true } });
        } catch {
          return json({ error: "Status GPS gagal disimpan." }, 500);
        }
      }

      // whoami
      if (url.pathname.endsWith("/whoami")) {
        return json({ data: {
          id: user.id, username: user.username, displayName: user.displayName, role: user.role,
          mustChangePassword: user.mustChangePassword, permissions: ROLE_PERMISSIONS[user.role],
        } });
      }

      // permission
      if (url.pathname.endsWith("/permission")) {
        const permission = url.searchParams.get("name") ?? "";
        if (!permission || permission.length > 100) return json({ error: "Permission tidak valid." }, 400);
        if (!canAccessRole(user.role, permission)) return json({ error: "Akses ditolak." }, 403);
        return json({ data: { allowed: true, userId: user.id, role: user.role } });
      }

      // command-dashboard
      if (url.pathname.endsWith("/command-dashboard")) {
        if (!canAccessRole(user.role, "command-dashboard") || !["SUPER_ADMIN", "KOMANDAN"].includes(user.role)) {
          return json({ error: "Dashboard Komando hanya tersedia untuk Super Admin dan Komandan." }, 403);
        }
        const data = await new PostgrestCommandDashboardStore().get();
        return json({ data });
      }

      // accounts (GET list, POST create)
      if (pathSegments.length === 1 && pathSegments[0] === "accounts") {
        if (request.method === "GET") {
          if (!canAccessRole(user.role, "accounts-manage") || user.role !== "SUPER_ADMIN") {
            return json({ error: "Daftar akun hanya tersedia untuk Super Admin." }, 403);
          }
          return json(await new PostgrestAccountPersonnelStore().listAccounts());
        }
        if (request.method === "POST") {
          if (!canAccessRole(user.role, "accounts-manage") || user.role !== "SUPER_ADMIN") {
            return json({ error: "Pembuatan akun hanya tersedia untuk Super Admin." }, 403);
          }
          if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format permintaan tidak valid." }, 400);
          let body: unknown;
          try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
          const input = body as Record<string, unknown>;
          const username = typeof input.username === "string" ? input.username.trim() : "";
          const password = typeof input.password === "string" ? input.password : "";
          const role = input.role === "SUPER_ADMIN" || input.role === "KOMANDAN" || input.role === "PERSONEL" ? input.role : null;
          const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
          const nrp = typeof input.nrp === "string" ? input.nrp.trim() : null;
          const rank = typeof input.rank === "string" ? input.rank.trim() : null;
          const position = typeof input.position === "string" ? input.position.trim() : null;
          if (!username || username.length > 80 || !password || password.length > 1024 || !role || !displayName || displayName.length > 160) {
            return json({ error: "Periksa kembali field yang wajib diisi." }, 422);
          }
          if (role !== "SUPER_ADMIN" && (!nrp || nrp.length > 40 || !rank || rank.length > 100 || !position || position.length > 160)) {
            return json({ error: "NRP, pangkat, dan jabatan wajib diisi untuk role non-Super Admin." }, 422);
          }
          const passwordHash = await hashPassword(password);
          try {
            const result = await rpcCall("gateops_create_account", {
              p_username: username, p_password_hash: passwordHash, p_role: role,
              p_display_name: displayName, p_nrp: nrp, p_rank: rank, p_position: position,
              ...actorFromUser(user),
            });
            const row = result[0];
            if (!row || typeof row !== "object") return json({ error: "Akun gagal dibuat." }, 502);
            return json({ data: row }, 201);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("P2002") || msg.includes("already exists") || msg.includes("duplicate")) {
              return json({ error: "Username sudah digunakan oleh akun lain." }, 409);
            }
            return json({ error: "Akun tidak dapat disimpan. Coba kembali." }, 500);
          }
        }
        return json({ error: "Metode tidak diizinkan." }, 405);
      }

      // accounts/:id (PATCH update, GET detail)
      if (pathSegments.length === 2 && pathSegments[0] === "accounts" && /^[A-Za-z0-9_-]{1,191}$/.test(pathSegments[1])) {
        const accountId = pathSegments[1];
        if (request.method === "PATCH") {
          if (!canAccessRole(user.role, "accounts-manage") || user.role !== "SUPER_ADMIN") {
            return json({ error: "Perubahan akun hanya tersedia untuk Super Admin." }, 403);
          }
          if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format permintaan tidak valid." }, 400);
          let body: unknown;
          try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
          const input = body as Record<string, unknown>;
          const username = typeof input.username === "string" ? input.username.trim() : null;
          const displayName = typeof input.displayName === "string" ? input.displayName.trim() : null;
          const nrp = typeof input.nrp === "string" ? input.nrp.trim() : null;
          const rank = typeof input.rank === "string" ? input.rank.trim() : null;
          const position = typeof input.position === "string" ? input.position.trim() : null;
          if (username === null && displayName === null && nrp === null && rank === null && position === null) {
            return json({ error: "Data perubahan tidak valid." }, 422);
          }
          try {
            const result = await rpcCall("gateops_update_account", {
              p_id: accountId, p_username: username, p_display_name: displayName,
              p_nrp: nrp, p_rank: rank, p_position: position,
              ...actorFromUser(user),
            });
            const row = result[0];
            if (!row || typeof row !== "object") return json({ error: "Akun tidak ditemukan." }, 404);
            return json({ data: row });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("P2002") || msg.includes("already exists") || msg.includes("duplicate")) {
              return json({ error: "Username sudah digunakan oleh akun lain." }, 409);
            }
            return json({ error: "Perubahan akun gagal disimpan." }, 500);
          }
        }
        if (request.method === "GET") {
          if (!canAccessRole(user.role, "accounts-manage") || user.role !== "SUPER_ADMIN") {
            return json({ error: "Detail akun hanya tersedia untuk Super Admin." }, 403);
          }
          // Use the store to get a single account (fall back to REST query)
          const all = await new PostgrestAccountPersonnelStore().listAccounts();
          const found = all.data.find(a => a.id === accountId);
          if (!found) return json({ error: "Akun tidak ditemukan." }, 404);
          return json({ data: found });
        }
        return json({ error: "Metode tidak diizinkan." }, 405);
      }

      // accounts/:id/reset-password (POST reset password)
      if (pathSegments.length === 3 && pathSegments[0] === "accounts" && pathSegments[2] === "reset-password" && /^[A-Za-z0-9_-]{1,191}$/.test(pathSegments[1]) && request.method === "POST") {
        const targetId = pathSegments[1];
        if (!canAccessRole(user.role, "accounts-manage") || user.role !== "SUPER_ADMIN") {
          return json({ error: "Reset password hanya tersedia untuk Super Admin." }, 403);
        }
        if (user.id === targetId) {
          return json({ error: "Gunakan menu Ubah password untuk mengganti password akun sendiri." }, 409);
        }
        const temporaryPassword = crypto.randomUUID() + crypto.randomUUID();
        const passwordHash = await hashPassword(temporaryPassword);
        try {
          const result = await rpcCall("gateops_reset_password", {
            p_target_id: targetId, p_temporary_password_hash: passwordHash,
            ...actorFromUser(user),
          });
          const row = result[0];
          if (!row || typeof row !== "object") return json({ error: "Akun tidak ditemukan." }, 404);
          return json({ data: { username: row.username, temporaryPassword, requiresChange: true } }, 200, { "Cache-Control": "no-store, private" });
        } catch {
          return json({ error: "Reset password gagal diproses." }, 500);
        }
      }

      // personnel (GET list)
      if (pathSegments.length === 1 && pathSegments[0] === "personnel" && request.method === "GET") {
        if (!canAccessRole(user.role, "personnel-read")) {
          return json({ error: "Anda tidak memiliki akses ke daftar personel." }, 403);
        }
        return json(await new PostgrestAccountPersonnelStore().listPersonnel());
      }

      // personnel/:id (GET detail, PATCH update, DELETE delete)
      if (pathSegments.length === 2 && pathSegments[0] === "personnel" && /^[A-Za-z0-9_-]{1,191}$/.test(pathSegments[1])) {
        const personnelId = pathSegments[1];
        if (request.method === "GET") {
          if (!canAccessRole(user.role, "personnel-read")) {
            return json({ error: "Anda tidak memiliki akses ke detail personel." }, 403);
          }
          const all = await new PostgrestAccountPersonnelStore().listPersonnel();
          const found = all.data.find(p => p.id === personnelId);
          if (!found) return json({ error: "Personel tidak ditemukan." }, 404);
          return json({ data: found });
        }
        if (request.method === "PATCH") {
          if (!canAccessRole(user.role, "personnel-manage") || user.role !== "SUPER_ADMIN") {
            return json({ error: "Perubahan personel hanya tersedia untuk Super Admin." }, 403);
          }
          if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Format permintaan tidak valid." }, 400);
          let body: unknown;
          try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
          const input = body as Record<string, unknown>;
          const nrp = typeof input.nrp === "string" ? input.nrp.trim() : null;
          const displayName = typeof input.displayName === "string" ? input.displayName.trim() : null;
          const rank = typeof input.rank === "string" ? input.rank.trim() : null;
          const position = typeof input.position === "string" ? input.position.trim() : null;
          const username = typeof input.username === "string" ? input.username.trim() : null;
          if (!nrp || nrp.length > 40 || !displayName || displayName.length > 160 || !rank || rank.length > 100 || !position || position.length > 160 || !username || username.length > 80) {
            return json({ error: "Periksa kembali data personel." }, 422);
          }
          try {
            const result = await rpcCall("gateops_update_account", {
              p_id: personnelId, p_username: username, p_display_name: displayName,
              p_nrp: nrp, p_rank: rank, p_position: position,
              ...actorFromUser(user),
            });
            const row = result[0];
            if (!row || typeof row !== "object") return json({ error: "Personel tidak ditemukan." }, 404);
            return json({ data: row });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("P2002") || msg.includes("already exists") || msg.includes("duplicate")) {
              return json({ error: "Username sudah digunakan. Gunakan username lain." }, 409);
            }
            return json({ error: "Perubahan personel gagal disimpan." }, 500);
          }
        }
        if (request.method === "DELETE") {
          if (!canAccessRole(user.role, "personnel-manage") || user.role !== "SUPER_ADMIN") {
            return json({ error: "Penghapusan personel hanya tersedia untuk Super Admin." }, 403);
          }
          try {
            const result = await rpcCall("gateops_delete_personnel", {
              p_target_id: personnelId,
              ...actorFromUser(user),
            });
            const row = result[0];
            if (!row || typeof row !== "object") return json({ error: "Personel tidak ditemukan." }, 404);
            return json({ data: {
              deletedPersonnelId: row.deleted_personnel_id,
              deletedPersitAccounts: row.deleted_persit_accounts,
              message: row.message,
            } });
          } catch {
            return json({ error: "Penghapusan personel gagal. Tidak ada data yang dihapus." }, 500);
          }
        }
        return json({ error: "Metode tidak diizinkan." }, 405);
      }

      // audit-logs
      if (url.pathname.endsWith("/audit-logs")) {
        if (!canAccessRole(user.role, "audit-read")) {
          return json({ error: "Audit log hanya tersedia untuk Super Admin." }, 403);
        }
        const parsed = parseAuditLogQuery(url.searchParams);
        if (!parsed.success) return json({ error: parsed.error }, 422);
        const result = await new PostgrestAuditLogStore().get(parsed.data);
        return json(result);
      }

      // activities
      if (url.pathname.endsWith("/activities")) {
        const allAccess = canAccessRole(user.role, "activity-read-all");
        const personalAccess = canAccessRole(user.role, "personal-activity-read");
        if (!allAccess && !personalAccess) return json({ error: "Akses riwayat aktivitas ditolak." }, 403);
        const parsed = parseActivityHistoryQuery(url.searchParams);
        if (!parsed.success) return json({ error: parsed.error }, 422);
        const data = await new PostgrestActivityHistoryStore().list(parsed.data, allAccess ? {} : { personnelId: user.id });
        return json(data);
      }

      // activity-detail
      if (url.pathname.endsWith("/activity-detail")) {
        const allAccess = canAccessRole(user.role, "activity-read-all");
        const personalAccess = canAccessRole(user.role, "personal-activity-read");
        if (!allAccess && !personalAccess) return json({ error: "Akses detail aktivitas ditolak." }, 403);
        const id = url.searchParams.get("id") ?? "";
        if (!/^[A-Za-z0-9_-]{1,191}$/.test(id)) return json({ error: "ID aktivitas tidak valid." }, 400);
        const result = await new PostgrestActivityHistoryStore().detail(id, allAccess ? {} : { personnelId: user.id });
        if (!result) return json({ error: "Aktivitas tidak ditemukan." }, 404);
        return json(result);
      }

      // reports-data
      if (url.pathname.endsWith("/reports-data")) {
        if (!canAccessRole(user.role, "reports-create") || !["SUPER_ADMIN", "KOMANDAN"].includes(user.role)) {
          return json({ error: "Laporan hanya tersedia untuk Super Admin dan Komandan." }, 403);
        }
        const data = await new PostgrestReportDataStore().get();
        return json({ data });
      }

      // gps-locations (read-only list for SUPER_ADMIN/KOMANDAN)
      if (url.pathname.endsWith("/gps-locations")) {
        if (!canAccessRole(user.role, "gps-read") || !["SUPER_ADMIN", "KOMANDAN"].includes(user.role)) {
          return json({ error: "Akses lokasi GPS hanya tersedia untuk Super Admin dan Komandan." }, 403);
        }
        const data = await new PostgrestGpsLocationStore().list();
        return json({ data });
      }

      return json({ error: "Endpoint tidak ditemukan." }, 404);
    } catch {
      return json({ error: "Layanan backend sementara tidak tersedia." }, 503);
    }
  },
};
