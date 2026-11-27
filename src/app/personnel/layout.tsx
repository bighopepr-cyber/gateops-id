import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PersonnelGpsTracker } from "@/components/personnel-gps-tracker";
import { db } from "@/lib/db";

export default async function PersonnelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["PERSONEL"]);
  const personnel = await db.user.findUnique({
    where: { id: user.id },
    select: { presenceStatus: true }
  });
  if (!personnel) return null;
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
        <div className="nav-caption">PERSONEL</div>
        <Link className="nav-item" href="/dashboard"><span>Dashboard</span></Link>
        <Link className="nav-item" href="/personnel/scan"><span>Scan QR Gate</span></Link>
        <Link className="nav-item" href="/personnel/history"><span>Riwayat Pribadi</span></Link>
        <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
      </aside>
      <section className="main-panel">
        <PersonnelGpsTracker presenceStatus={personnel.presenceStatus} />
        {children}
      </section>
    </main>
  );
}
