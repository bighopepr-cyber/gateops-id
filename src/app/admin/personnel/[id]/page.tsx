import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["SUPER_ADMIN", "KOMANDAN"]);
  const { id } = await params;
  if (user.mustChangePassword) redirect("/change-password");

  let personnel: any = null;
  let error = "";
  try {
    const response = await fetch(`/api/edge/personnel/${encodeURIComponent(id)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Personel tidak ditemukan.");
    personnel = body.data;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Gagal memuat detail personel.";
  }

  if (error) {
    return (
      <main className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
          <div className="nav-caption">OPERASIONAL</div>
          <Link className="nav-item" href="/dashboard"><span>Dashboard</span></Link>
          <Link className="nav-item" href="/admin/personnel"><span>Data Personel</span></Link>
          <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
        </aside>
        <section className="main-panel">
          <header className="topbar"><div><span className="breadcrumb">Pengelolaan</span><span className="breadcrumb-separator">/</span><strong>Detail Personel</strong></div><span className="secure-label">{user.displayName}</span></header>
          <div className="page-content"><div className="form-error" role="alert">{error}</div></div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
        <div className="nav-caption">OPERASIONAL</div>
        <Link className="nav-item" href="/dashboard"><span>Dashboard</span></Link>
        <Link className="nav-item" href="/admin/personnel"><span>Data Personel</span></Link>
        <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div><span className="breadcrumb">Pengelolaan</span><span className="breadcrumb-separator">/</span><strong>Detail Personel</strong></div><span className="secure-label">{user.displayName}</span></header>
        <div className="page-content">
          <div className="admin-page">
            <div className="admin-heading">
              <div>
                <p className="eyebrow">DATA PERSONEL</p>
                <h1>{personnel.displayName}</h1>
                <p className="muted">Detail personel dan aktivitas terkait.</p>
              </div>
            </div>
            <div className="table-card">
              <div className="table-toolbar">
                <div>
                  <h2>Profil Personel</h2>
                  <p>Informasi akun dan status kehadiran.</p>
                </div>
              </div>
              <div style={{ padding: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Username</td><td style={{ color: "#455168" }}>{personnel.username}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>NRP</td><td style={{ color: "#455168" }}>{personnel.nrp ?? "—"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Pangkat</td><td style={{ color: "#455168" }}>{personnel.rank ?? "—"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Jabatan</td><td style={{ color: "#455168" }}>{personnel.position ?? "—"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Status Kehadiran</td><td style={{ color: "#455168" }}>{personnel.presenceStatus === "DI_DALAM" ? "DI DALAM" : "DI LUAR"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Perlu Ubah Password</td><td style={{ color: "#455168" }}>{personnel.mustChangePassword ? "Ya" : "Tidak"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Dibuat Pada</td><td style={{ color: "#455168" }}>{new Date(personnel.createdAt).toLocaleString("id-ID")}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
