import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const allAccess = await requireApiPermission("activity-read-all");
  const personalAccess = allAccess.response ? await requireApiPermission("personal-activity-read") : null;
  if (allAccess.response && personalAccess?.response) return allAccess.response;
  const { id } = await context.params;
  try {
    const data = await db.activity.findFirst({
      where: { id, ...(personalAccess?.user ? { personnelId: personalAccess.user.id } : {}) },
      include: {
        personnel: { select: { displayName: true, nrp: true } },
        exitGate: { select: { name: true, location: true } },
        returnGate: { select: { name: true, location: true } }
      }
    });
    if (!data) return NextResponse.json({ error: "Aktivitas tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Detail aktivitas tidak dapat dimuat." }, { status: 500 });
  }
}
