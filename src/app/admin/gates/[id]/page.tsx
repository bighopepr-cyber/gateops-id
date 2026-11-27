import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function GateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["SUPER_ADMIN"]);
  const { id } = await params;
  if (user.mustChangePassword) redirect("/change-password");

  let gate: any = null;
  let error = "";
  try {
    const response = await fetch("/api/edge/gates", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Gagal memuat data gate.");
    const gates = body.data ?? [];
    gate = gates.find((g: any) => g.id === id);
    if (!gate) throw new Error("Gate tidak ditemukan.");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Gagal memuat detail gate.";
  }

  if (error) {
    return (
      <main className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand"><span className="brand-mark small">G</span><span>GATEOPS</span></div>
          <div className="nav-caption">OPERASIONAL</div>
          <Link className="nav-item" href="/dashboard"><span>Dashboard</span></Link>
          <Link className="nav-item" href="/admin/gates"><span>Pengelolaan Gate</span></Link>
          <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
        </aside>
        <section className="main-panel">
          <header className="topbar"><div><span className="breadcrumb">Pengelolaan</span><span className="breadcrumb-separator">/</span><strong>Detail Gate</strong></div><span className="secure-label">{user.displayName}</span></header>
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
        <Link className="nav-item" href="/admin/gates"><span>Pengelolaan Gate</span></Link>
        <div className="sidebar-bottom"><Link className="logout-button" href="/dashboard">Kembali ke Dashboard</Link></div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div><span className="breadcrumb">Pengelolaan</span><span className="breadcrumb-separator">/</span><strong>Detail Gate</strong></div><span className="secure-label">{user.displayName}</span></header>
        <div className="page-content">
          <div className="admin-page">
            <div className="admin-heading">
              <div>
                <p className="eyebrow">PENGELOLAAN GATE</p>
                <h1>{gate.name}</h1>
                <p className="muted">Detail gate dan kredensial QR.</p>
              </div>
            </div>
            <div className="table-card">
              <div className="table-toolbar">
                <div>
                  <h2>Profil Gate</h2>
                  <p>Informasi lokasi dan status operasional gate.</p>
                </div>
              </div>
              <div style={{ padding: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Nama Gate</td><td style={{ color: "#455168" }}>{gate.name}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Lokasi</td><td style={{ color: "#455168" }}>{gate.location}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Status</td><td style={{ color: "#455168" }}>{gate.status === "AKTIF" ? "AKTIF" : "NONAKTIF"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>QR Credential</td><td style={{ color: "#455168", wordBreak: "break-all" }}>{gate.qrCredential ?? "—"}</td></tr>
                    <tr><td style={{ width: "160px", color: "#8792a4", fontSize: "12px", padding: "8px 0" }}>Dibuat Pada</td><td style={{ color: "#455168" }}>{new Date(gate.createdAt).toLocaleString("id-ID")}</td></tr>
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
