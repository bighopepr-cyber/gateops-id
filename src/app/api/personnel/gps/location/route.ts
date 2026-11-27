import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";

export const runtime = "nodejs";

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180)
}).strict();
const permissionSchema = z.object({ permissionRevoked: z.literal(true) }).strict();
const schema = z.union([locationSchema, permissionSchema]);

export async function POST(request: Request) {
  const access = await requireApiPermission("gps-update");
  if (access.response) return access.response;
  const user = access.user;
  if (!user || user.role !== "PERSONEL") {
    return NextResponse.json({ error: "Update lokasi hanya tersedia untuk Personel." }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Format data GPS tidak valid." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data GPS tidak valid." }, { status: 422 });
  }
  try {
    const result = await db.$transaction(async tx => {
      const now = new Date();
      const session = await tx.session.findFirst({
        where: { id: user.sessionId, userId: user.id, expiresAt: { gt: now } },
        select: { id: true }
      });
      if (!session) return "SESSION_EXPIRED" as const;
      const where = { id: user.id, role: "PERSONEL" as const, presenceStatus: "DI_LUAR" as const };
      const updated = await tx.user.updateMany({
        where,
        data: "permissionRevoked" in parsed.data
          ? { gpsPermissionRevokedAt: now }
          : {
              gpsLatitude: parsed.data.latitude,
              gpsLongitude: parsed.data.longitude,
              gpsUpdatedAt: now,
              gpsPermissionRevokedAt: null
            }
      });
      if (updated.count !== 1) return "NOT_OUTSIDE" as const;
      const activeSession = await tx.session.findFirst({
        where: { id: user.sessionId, userId: user.id, expiresAt: { gt: new Date() } },
        select: { id: true }
      });
      if (!activeSession) throw new Error("GPS_SESSION_EXPIRED_BEFORE_COMMIT");
      if (request.signal.aborted) throw new Error("GPS_REQUEST_ABORTED");
      return "SAVED" as const;
    });
    if (result === "SESSION_EXPIRED") return NextResponse.json({ error: "Sesi login berakhir." }, { status: 401 });
    if (result === "NOT_OUTSIDE") return NextResponse.json({ error: "Lokasi hanya dapat diperbarui saat status DI_LUAR." }, { status: 409 });
    return NextResponse.json({ data: { saved: true } });
  } catch {
    return NextResponse.json({ error: "Status GPS gagal disimpan." }, { status: 500 });
  }
}
