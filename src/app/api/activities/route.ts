import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { activityHistoryQuerySchema } from "@/lib/activity-history";

export async function GET(request: Request) {
  const access = await requireApiPermission("activity-read-all");
  if (access.response) {
    const personal = await requireApiPermission("personal-activity-read");
    if (personal.response) return access.response;
    const url = new URL(request.url);
    const parsed = activityHistoryQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filter riwayat tidak valid.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
    const { from, to, status, page, pageSize } = parsed.data;
    const where = {
      personnelId: personal.user!.id,
      ...(from || to ? { exitAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(status ? { status } : {})
    };
    try {
      const [data, total] = await Promise.all([
        db.activity.findMany({ where, include: { personnel: { select: { displayName: true, nrp: true } }, exitGate: { select: { name: true } }, returnGate: { select: { name: true } } }, orderBy: { exitAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
        db.activity.count({ where })
      ]);
      return NextResponse.json({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
    } catch {
      return NextResponse.json({ error: "Riwayat aktivitas tidak dapat dimuat." }, { status: 500 });
    }
  }

  const url = new URL(request.url);
  const parsed = activityHistoryQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Filter riwayat tidak valid.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  const { from, to, personnelName, nrp, gate, destination, status, page, pageSize } = parsed.data;
  const where = {
    ...(from || to ? { exitAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    ...(personnelName ? { personnel: { displayName: { contains: personnelName, mode: "insensitive" as const } } } : {}),
    ...(nrp ? { personnel: { ...(personnelName ? { displayName: { contains: personnelName, mode: "insensitive" as const } } : {}), nrp: { contains: nrp, mode: "insensitive" as const } } } : {}),
    ...(gate ? { OR: [{ exitGate: { name: { contains: gate, mode: "insensitive" as const } } }, { returnGate: { name: { contains: gate, mode: "insensitive" as const } } }] } : {}),
    ...(destination ? { destination: { contains: destination, mode: "insensitive" as const } } : {}),
    ...(status ? { status } : {})
  };
  try {
    const [data, total] = await Promise.all([
      db.activity.findMany({ where, include: { personnel: { select: { displayName: true, nrp: true } }, exitGate: { select: { name: true } }, returnGate: { select: { name: true } } }, orderBy: { exitAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      db.activity.count({ where })
    ]);
    return NextResponse.json({ data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch {
    return NextResponse.json({ error: "Riwayat aktivitas tidak dapat dimuat." }, { status: 500 });
  }
}
