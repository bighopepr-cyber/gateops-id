import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { getGpsStatus } from "@/lib/gps-status";

export async function GET() {
  const access = await requireApiPermission("command-dashboard");
  if (access.response) return access.response;
  if (!access.user || !["SUPER_ADMIN", "KOMANDAN"].includes(access.user.role)) {
    return NextResponse.json({ error: "Dashboard Komando hanya tersedia untuk Super Admin dan Komandan." }, { status: 403 });
  }

  try {
    const [totalPersonnel, insidePersonnel, outsidePersonnel, outsidePeople, recentActivities] = await Promise.all([
      db.user.count({ where: { role: "PERSONEL" } }),
      db.user.count({ where: { role: "PERSONEL", presenceStatus: "DI_DALAM" } }),
      db.user.count({ where: { role: "PERSONEL", presenceStatus: "DI_LUAR" } }),
      db.user.findMany({
        where: { role: "PERSONEL", presenceStatus: "DI_LUAR" },
        select: {
          id: true, displayName: true, nrp: true, rank: true, position: true,
          gpsLatitude: true, gpsLongitude: true, gpsUpdatedAt: true, gpsPermissionRevokedAt: true,
          activities: {
            where: { status: "AKTIF" },
            take: 1,
            orderBy: { exitAt: "desc" },
            select: { destination: true, purpose: true, exitAt: true, exitGate: { select: { name: true } } }
          }
        },
        orderBy: { displayName: "asc" }
      }),
      db.activity.findMany({
        take: 10,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, status: true, exitAt: true, returnAt: true,
          personnel: { select: { displayName: true, nrp: true } },
          exitGate: { select: { name: true } },
          returnGate: { select: { name: true } }
        }
      })
    ]);

    const now = new Date();
    const outside = outsidePeople.map((person) => {
      const activity = person.activities[0];
      const gpsStatus = person.gpsLatitude !== null && person.gpsLongitude !== null && person.gpsUpdatedAt
        ? getGpsStatus(person.gpsUpdatedAt, now, person.gpsPermissionRevokedAt)
        : null;
      return {
        id: person.id,
        displayName: person.displayName,
        nrp: person.nrp,
        rank: person.rank,
        position: person.position,
        exitGate: activity?.exitGate.name ?? "—",
        destination: activity?.destination ?? "—",
        purpose: activity?.purpose ?? "—",
        exitAt: activity?.exitAt.toISOString() ?? null,
        gpsStatus
      };
    });

    const activities = recentActivities.map((activity) => ({
      id: activity.id,
      personnelName: activity.personnel.displayName,
      nrp: activity.personnel.nrp,
      gate: activity.returnAt ? activity.returnGate?.name ?? activity.exitGate.name : activity.exitGate.name,
      type: activity.returnAt ? "KEMBALI" : "KELUAR",
      occurredAt: (activity.returnAt ?? activity.exitAt).toISOString(),
      status: activity.status
    }));

    return NextResponse.json({
      data: {
        statistics: { totalPersonnel, insidePersonnel, outsidePersonnel },
        outsidePersonnel: outside,
        latestActivities: activities
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Data Dashboard Komando tidak dapat dimuat." }, { status: 500 });
  }
}
