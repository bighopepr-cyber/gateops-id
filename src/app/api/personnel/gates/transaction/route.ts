import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { hashGateQrCredential, verifyGateQrCredential } from "@/lib/gate-qr";
import { calculateDurationSeconds } from "@/lib/activity-duration";
import { writeAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";

const requestSchema = z.object({
  credential: z.string(),
  destination: z.string().max(240).optional(),
  purpose: z.string().max(500).optional()
});
const credentialSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

class SessionExpiredError extends Error {
  constructor() { super("Session expired before transaction commit."); }
}

class ClientDisconnectedError extends Error {
  constructor() {
    super("Client disconnected before transaction commit.");
  }
}

type TransactionResult =
  | { kind: "BUSY" }
  | { kind: "SESSION_EXPIRED" }
  | { kind: "INVALID_GATE" }
  | { kind: "INVALID_FORM" }
  | { kind: "INCONSISTENT_STATE" }
  | { kind: "EXIT"; activityId: string; gateName: string; destination: string; purpose: string; exitAt: Date }
  | { kind: "RETURN"; activityId: string; gateName: string; destination: string; purpose: string; exitAt: Date; returnAt: Date; durationSeconds: number };

export async function POST(request: Request) {
  const access = await requireApiPermission("presence-transact");
  if (access.response) return access.response;
  const user = access.user;
  if (!user || user.role !== "PERSONEL") {
    return NextResponse.json({ error: "Akses transaksi hanya tersedia untuk Personel." }, { status: 403 });
  }
  if (user.mustChangePassword) {
    return NextResponse.json({ error: "Ubah password terlebih dahulu sebelum melakukan transaksi." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Tujuan dan keperluan harus berupa teks yang valid." }, { status: 422 });
  }
  if (!credentialSchema.safeParse(parsed.data.credential).success) {
    return NextResponse.json({ error: "QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi" }, { status: 404 });
  }

  if (request.signal.aborted) {
    return NextResponse.json({ error: "Koneksi terputus sebelum transaksi diproses. Silakan pindai ulang setelah koneksi pulih." }, { status: 409 });
  }

  try {
    const result = await db.$transaction(async (tx): Promise<TransactionResult> => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtextextended(${user.id}, 0)) AS locked`;
      if (!lockRows[0]?.locked) return { kind: "BUSY" };
      if (request.signal.aborted) throw new ClientDisconnectedError();

      const gateHash = hashGateQrCredential(parsed.data.credential);
      const gate = await tx.gate.findUnique({
        where: { qrTokenHash: gateHash },
        select: { id: true, name: true, status: true, qrTokenHash: true }
      });
      if (!gate || gate.status !== "AKTIF" || !gate.qrTokenHash || !verifyGateQrCredential(parsed.data.credential, gate.qrTokenHash)) {
        return { kind: "INVALID_GATE" };
      }

      const now = new Date();
      const session = await tx.session.findFirst({
        where: { id: user.sessionId, userId: user.id, expiresAt: { gt: now } },
        select: { id: true }
      });
      if (!session) return { kind: "SESSION_EXPIRED" };

      const personnel = await tx.user.findUnique({
        where: { id: user.id },
        select: { presenceStatus: true, mustChangePassword: true }
      });
      if (!personnel || personnel.mustChangePassword) return { kind: "SESSION_EXPIRED" };

      if (personnel.presenceStatus === "DI_DALAM") {
        const destination = parsed.data.destination?.trim();
        const purpose = parsed.data.purpose?.trim();
        if (!destination || !purpose) return { kind: "INVALID_FORM" };

        const activity = await tx.activity.create({
          data: {
            personnelId: user.id,
            exitGateId: gate.id,
            destination,
            purpose,
            status: "AKTIF",
            exitAt: now
          },
          select: { id: true, destination: true, purpose: true, exitAt: true }
        });
        await tx.user.update({
          where: { id: user.id },
          data: { presenceStatus: "DI_LUAR", gpsLatitude: null, gpsLongitude: null, gpsUpdatedAt: null, gpsPermissionRevokedAt: null },
          select: { id: true }
        });
        await writeAuditLog(tx,user,{action:"PRESENCE_EXIT",entityType:"ACTIVITY",entityId:activity.id,metadata:{direction:"KELUAR",gateId:gate.id}});
        const sessionStillActive = await tx.session.findFirst({
          where: { id: user.sessionId, userId: user.id, expiresAt: { gt: new Date() } },
          select: { id: true }
        });
        if (!sessionStillActive) throw new SessionExpiredError();
        if (request.signal.aborted) throw new ClientDisconnectedError();
        return {
          kind: "EXIT",
          activityId: activity.id,
          gateName: gate.name,
          destination: activity.destination,
          purpose: activity.purpose,
          exitAt: activity.exitAt
        };
      }

      const activeActivity = await tx.activity.findFirst({
        where: { personnelId: user.id, status: "AKTIF" },
        orderBy: { exitAt: "desc" },
        select: { id: true, destination: true, purpose: true, exitAt: true }
      });
      if (!activeActivity) return { kind: "INCONSISTENT_STATE" };

      const durationSeconds = calculateDurationSeconds(activeActivity.exitAt, now);
      const activity = await tx.activity.update({
        where: { id: activeActivity.id },
        data: {
          returnGateId: gate.id,
          returnAt: now,
          durationSeconds,
          status: "SELESAI"
        },
        select: { id: true, destination: true, purpose: true, exitAt: true, returnAt: true, durationSeconds: true }
      });
      await tx.user.update({
        where: { id: user.id },
        data: { presenceStatus: "DI_DALAM", gpsLatitude: null, gpsLongitude: null, gpsUpdatedAt: null, gpsPermissionRevokedAt: null },
        select: { id: true }
      });
      await writeAuditLog(tx,user,{action:"PRESENCE_RETURN",entityType:"ACTIVITY",entityId:activity.id,metadata:{direction:"KEMBALI",gateId:gate.id}});
      const sessionStillActive = await tx.session.findFirst({
        where: { id: user.sessionId, userId: user.id, expiresAt: { gt: new Date() } },
        select: { id: true }
      });
      if (!sessionStillActive) throw new SessionExpiredError();
      if (request.signal.aborted) throw new ClientDisconnectedError();
      if (!activity.returnAt || activity.durationSeconds === null) return { kind: "INCONSISTENT_STATE" };
      return {
        kind: "RETURN",
        activityId: activity.id,
        gateName: gate.name,
        destination: activity.destination,
        purpose: activity.purpose,
        exitAt: activity.exitAt,
        returnAt: activity.returnAt,
        durationSeconds: activity.durationSeconds
      };
    }, { maxWait: 5000, timeout: 10000 });

    switch (result.kind) {
      case "BUSY":
        return NextResponse.json({ error: "Transaksi QR sebelumnya masih diproses. Tidak ada transaksi tambahan yang dibuat." }, { status: 409 });
      case "SESSION_EXPIRED":
        return NextResponse.json({ error: "Sesi login berakhir. Silakan login kembali sebelum memindai QR." }, { status: 401 });
      case "INVALID_GATE":
        return NextResponse.json({ error: "QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi" }, { status: 404 });
      case "INVALID_FORM":
        return NextResponse.json({ error: "Tujuan dan keperluan wajib diisi sebelum kamera dibuka." }, { status: 422 });
      case "INCONSISTENT_STATE":
        return NextResponse.json({ error: "Status kehadiran dan aktivitas tidak konsisten. Hubungi administrator; tidak ada transaksi baru yang disimpan." }, { status: 409 });
      case "EXIT":
        return NextResponse.json({
          message: "Transaksi keluar berhasil. Status kehadiran sekarang DI LUAR.",
          data: { id: result.activityId, direction: "KELUAR", presenceStatus: "DI_LUAR", activityStatus: "AKTIF", gateName: result.gateName, destination: result.destination, purpose: result.purpose, exitAt: result.exitAt }
        });
      case "RETURN":
        return NextResponse.json({
          message: "Transaksi kembali berhasil. Status kehadiran sekarang DI DALAM.",
          data: { id: result.activityId, direction: "KEMBALI", presenceStatus: "DI_DALAM", activityStatus: "SELESAI", gateName: result.gateName, destination: result.destination, purpose: result.purpose, exitAt: result.exitAt, returnAt: result.returnAt, durationSeconds: result.durationSeconds }
        });
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: "Sesi login berakhir. Silakan login kembali sebelum memindai QR." }, { status: 401 });
    }
    if (error instanceof ClientDisconnectedError) {
      return NextResponse.json({ error: "Koneksi terputus saat transaksi berlangsung. Tidak ada perubahan yang disimpan; silakan pindai ulang setelah koneksi pulih." }, { status: 409 });
    }
    return NextResponse.json({ error: "Transaksi gagal disimpan. Status kehadiran dan aktivitas tidak berubah. Silakan pindai ulang secara manual setelah siap." }, { status: 500 });
  }
}
