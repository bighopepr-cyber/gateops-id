import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { AuditLogViewer } from "@/components/audit-log-viewer";

export default async function AuditLogPage() {
  const user = await requireRole(["SUPER_ADMIN"]);
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
      <div className="nav-caption">OPERASIONAL</div>
      <Link className="nav-item" href="/dashboard"><span>Dashboard</span></Link>
      <Link className="nav-item" href="/admin/history"><span>Riwayat Aktivitas</span></Link>
      <Link className="nav-item" href="/admin/personnel"><span>Data Personel</span></Link>
      <Link className="nav-item" href="/admin/reports"><span>Laporan</span></Link>
      <Link className="nav-item" href="/admin/gates"><span>Pengelolaan Gate</span></Link>
      <Link className="nav-item" href="/admin/persit-verification"><span>Verifikasi Persit</span></Link>
      <Link className="nav-item" href="/admin/accounts"><span>Pengelolaan Akun</span></Link>
      <Link className="nav-item active" href="/admin/audit-logs"><span>Audit Log</span></Link>
      <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
    </aside>
    <section className="main-panel">
      <header className="topbar"><div><span className="breadcrumb">Keamanan</span><span className="breadcrumb-separator">/</span><strong>Audit Log</strong></div><span className="secure-label">{user.displayName} · Super Admin</span></header>
      <div className="page-content"><AuditLogViewer /></div>
    </section>
  </main>;
}
