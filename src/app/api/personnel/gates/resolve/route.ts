import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiPermission } from "@/lib/api-auth";
import { hashGateQrCredential, verifyGateQrCredential } from "@/lib/gate-qr";

const schema = z.object({ credential: z.string().min(1).max(128) });

export async function POST(request: Request) {
  const access = await requireApiPermission("presence-transact");
  if (access.response) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Kredensial QR tidak valid." }, { status: 422 });
  }

  try {
    const tokenHash = hashGateQrCredential(parsed.data.credential);
    const gate = await db.gate.findUnique({
      where: { qrTokenHash: tokenHash },
      select: { id: true, name: true, location: true, status: true, qrTokenHash: true }
    });

    if (!gate || gate.status !== "AKTIF" || !gate.qrTokenHash || !verifyGateQrCredential(parsed.data.credential, gate.qrTokenHash)) {
      return NextResponse.json({ error: "QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: gate.id, name: gate.name, location: gate.location } });
  } catch {
    return NextResponse.json({ error: "QR gate tidak dapat diverifikasi saat ini." }, { status: 500 });
  }
}
