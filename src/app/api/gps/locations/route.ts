import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { getGpsStatus } from "@/lib/gps-status";

export async function GET() {
  const access = await requireApiPermission("gps-read");
  if (access.response) return access.response;
  if (!access.user || !["SUPER_ADMIN", "KOMANDAN"].includes(access.user.role)) {
    return NextResponse.json({ error: "Akses lokasi GPS hanya tersedia untuk Super Admin dan Komandan." }, { status: 403 });
  }
  try {
    const data = await db.user.findMany({
      where: {
        role: "PERSONEL",
        presenceStatus: "DI_LUAR",
        gpsLatitude: { not: null },
        gpsLongitude: { not: null },
        gpsUpdatedAt: { not: null }
      },
      select: {
        id: true, displayName: true, nrp: true, rank: true, position: true,
        gpsLatitude: true, gpsLongitude: true, gpsUpdatedAt: true, gpsPermissionRevokedAt: true,
        activities: {
          where: { status: "AKTIF" },
          take: 1,
          orderBy: { exitAt: "desc" },
          select: { destination: true, purpose: true, exitAt: true }
        }
      },
      orderBy: { gpsUpdatedAt: "desc" }
    });
    const now = new Date();
    const locations = data.map(item => ({
      ...item,
      gpsStatus: getGpsStatus(item.gpsUpdatedAt!, now, item.gpsPermissionRevokedAt)
    }));
    return NextResponse.json({ data: locations });
  } catch {
    return NextResponse.json({ error: "Lokasi GPS tidak dapat dimuat." }, { status: 500 });
  }
}
