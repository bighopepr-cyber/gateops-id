import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { PersonalActivityDetail } from "@/components/personal-activity-detail";

export default async function PersonalActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["PERSONEL"]);
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
      <div className="nav-caption">PERSONEL</div>
      <Link className="nav-item" href="/dashboard">Dashboard</Link>
      <Link className="nav-item active" href="/personnel/history">Riwayat Pribadi</Link>
      <div className="sidebar-bottom"><Link className="logout-button" href="/personnel/history">Kembali ke Riwayat</Link></div>
    </aside>
    <section className="main-panel">
      <header className="topbar"><div><span className="breadcrumb">Riwayat Pribadi</span><span className="breadcrumb-separator">/</span><strong>Detail Aktivitas</strong></div><span className="secure-label">{user.displayName}</span></header>
      <div className="page-content"><PersonalActivityDetail id={id}/></div>
    </section>
  </main>;
}
