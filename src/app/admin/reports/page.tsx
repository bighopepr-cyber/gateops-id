import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ReportPage } from "@/components/report-page";
import { Download, Users } from "lucide-react";

export default async function ReportsPage() {
  const user = await requireRole(["SUPER_ADMIN", "KOMANDAN"]);
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
      <div className="nav-caption">OPERASIONAL</div>
      <Link className="nav-item" href="/dashboard"><span>Dashboard</span></Link>
      <Link className="nav-item" href="/admin/personnel"><Users size={17} />Data Personel</Link>
      <Link className="nav-item active" href="/admin/reports"><Download size={17} />Laporan</Link>
      <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
    </aside>
    <section className="main-panel">
      <header className="topbar"><div><span className="breadcrumb">Operasional</span><span className="breadcrumb-separator">/</span><strong>Laporan</strong></div><span className="secure-label">{user.displayName} · {user.role === "SUPER_ADMIN" ? "Super Admin" : "Komandan"}</span></header>
      <div className="page-content"><ReportPage currentUserRole={user.role} /></div>
    </section>
  </main>;
}
