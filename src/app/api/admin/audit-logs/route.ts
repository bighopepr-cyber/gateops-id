import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export async function GET(request: Request) {
  const access = await requireApiPermission("audit-read");
  if (access.response) return access.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parameter halaman audit tidak valid." }, { status: 422 });
  }

  const { page, pageSize } = parsed.data;
  try {
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        select: {
          id: true,
          actorUsername: true,
          actorDisplayName: true,
          actorRole: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      db.auditLog.count()
    ]);

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Audit log tidak dapat dimuat." }, { status: 500 });
  }
}
