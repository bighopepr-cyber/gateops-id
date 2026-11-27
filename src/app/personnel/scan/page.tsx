import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PersonnelQrScanner } from "@/components/personnel-qr-scanner";
import { redirect } from "next/navigation";

export default async function PersonnelScanPage() {
  const user = await requireRole(["PERSONEL"]);
  if (user.mustChangePassword) redirect("/change-password");
  const personnel = await db.user.findUnique({
    where: { id: user.id },
    select: {
      presenceStatus: true,
      activities: {
        where: { status: "AKTIF" },
        orderBy: { exitAt: "desc" },
        take: 1,
        select: {
          destination: true,
          purpose: true,
          exitAt: true,
          exitGate: { select: { name: true } }
        }
      }
    }
  });
  if (!personnel) redirect("/login");
  const active = personnel.activities[0];
  return (
    <>
      <header className="topbar"><div><span className="breadcrumb">Personel</span><span className="breadcrumb-separator">/</span><strong>Scan QR Gate</strong></div><span className="secure-label">Sesi terverifikasi</span></header>
      <div className="page-content"><PersonnelQrScanner initialStatus={personnel.presenceStatus} activeActivity={active ? { ...active, exitAt: active.exitAt.toISOString(), gateName: active.exitGate.name } : null} /></div>
    </>
  );
}
