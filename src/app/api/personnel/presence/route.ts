import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";

export async function GET() {
  const access = await requireApiPermission("personal-dashboard");
  if (access.response) return access.response;
  const user = access.user;
  if (!user || user.role !== "PERSONEL") {
    return NextResponse.json({ error: "Akses hanya tersedia untuk Personel." }, { status: 403 });
  }
  try {
    const [personnel, activeActivity] = await Promise.all([
      db.user.findUnique({ where: { id: user.id }, select: { presenceStatus: true } }),
      db.activity.findFirst({
        where: { personnelId: user.id, status: "AKTIF" },
        orderBy: { exitAt: "desc" },
        select: {
          id: true, destination: true, purpose: true, exitAt: true,
          exitGate: { select: { name: true, location: true } }
        }
      })
    ]);
    if (!personnel) return NextResponse.json({ error: "Akun Personel tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ data: { presenceStatus: personnel.presenceStatus, activeActivity } });
  } catch {
    return NextResponse.json({ error: "Status kehadiran tidak dapat dimuat." }, { status: 500 });
  }
}
