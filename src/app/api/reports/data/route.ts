import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";

export async function GET() {
  const access = await requireApiPermission("reports-create");
  if (access.response) return access.response;
  if (!access.user || !["SUPER_ADMIN", "KOMANDAN"].includes(access.user.role)) {
    return NextResponse.json({ error: "Laporan hanya tersedia untuk Super Admin dan Komandan." }, { status: 403 });
  }

  try {
    const [totalPersonnel, insidePersonnel, outsidePersonnel, totalActivities, returnedActivities, activities] = await Promise.all([
      db.user.count({ where: { role: "PERSONEL" } }),
      db.user.count({ where: { role: "PERSONEL", presenceStatus: "DI_DALAM" } }),
      db.user.count({ where: { role: "PERSONEL", presenceStatus: "DI_LUAR" } }),
      db.activity.count(),
      db.activity.count({ where: { returnAt: { not: null } } }),
      db.activity.findMany({
        orderBy: [{ exitAt: "desc" }, { id: "desc" }],
        select: {
          id: true, destination: true, purpose: true, status: true, exitAt: true, returnAt: true, durationSeconds: true,
          personnel: { select: { displayName: true, nrp: true } },
          exitGate: { select: { name: true } },
          returnGate: { select: { name: true } }
        }
      })
    ]);

    return NextResponse.json({
      data: {
        statistics: { totalPersonnel, insidePersonnel, outsidePersonnel, exitTransactions: totalActivities, returnTransactions: returnedActivities },
        activities: activities.map(activity => ({
          id: activity.id, personnelName: activity.personnel.displayName, nrp: activity.personnel.nrp,
          exitGate: activity.exitGate.name, returnGate: activity.returnGate?.name ?? null,
          exitAt: activity.exitAt.toISOString(), returnAt: activity.returnAt?.toISOString() ?? null,
          destination: activity.destination, purpose: activity.purpose,
          durationSeconds: activity.durationSeconds, status: activity.status
        }))
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Data laporan tidak dapat dimuat." }, { status: 500 });
  }
}
