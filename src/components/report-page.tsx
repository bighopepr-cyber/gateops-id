"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";

type ReportStatistics = {
  totalPersonnel: number;
  insidePersonnel: number;
  outsidePersonnel: number;
  exitTransactions: number;
  returnTransactions: number;
};

type ReportActivity = {
  id: string;
  personnelName: string;
  nrp: string | null;
  exitGate: string;
  returnGate: string | null;
  exitAt: string;
  returnAt: string | null;
  destination: string;
  purpose: string;
  durationSeconds: number | null;
  status: "AKTIF" | "SELESAI";
};

type ReportResponse = {
  data: {
    statistics: ReportStatistics;
    activities: ReportActivity[];
  };
  error?: string;
};

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

function duration(value: number | null, status: string) {
  if (status === "AKTIF" || value === null) return "—";
  const minutes = Math.floor(value / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days ? days + " hari" : "", hours ? hours + " jam" : "", rest + " menit"].filter(Boolean).join(" ");
}

export function ReportPage({ currentUserRole }: { currentUserRole: string }) {
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/edge/reports-data", { cache: "no-store" });
      const body = await response.json() as ReportResponse;
      if (!response.ok || !body.data) throw new Error(body.error || (response.status === 401 ? "Sesi login berakhir. Silakan login kembali." : response.status === 403 ? "Akses laporan ditolak." : "Data laporan tidak dapat dimuat."));
      setResult(body);
    } catch (cause) {
      setError(cause instanceof TypeError ? "Koneksi ke server terputus. Periksa jaringan lalu coba lagi." : cause instanceof Error ? cause.message : "Terjadi kesalahan.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => void load());
  }, [load]);

  async function downloadPdf() {
    if (!result) return;
    setPrinting(true);
    try {
      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) throw new Error("Tidak dapat membuka jendela cetak. Periksa blokir pop-up browser.");
      const today = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date());
      const generatedBy = currentUserRole === "SUPER_ADMIN" ? "Super Admin" : "Komandan";
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Laporan Kehadiran & Aktivitas - GATEOPS</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; color: #172033; line-height: 1.5; margin: 0; }
            .no-print, .no-print * { display: none !important; }
            .header { border-bottom: 2px solid #315de8; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { font-size: 20px; margin: 0 0 4px 0; letter-spacing: -0.04em; }
            .header .eyebrow { color: #788397; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 6px 0; }
            .header .meta { font-size: 11px; color: #788397; margin: 0; }
            .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
            .stat-card { border: 1px solid #e8ebf0; border-radius: 10px; padding: 14px; text-align: center; background: #fff; }
            .stat-card .label { font-size: 10px; color: #788397; font-weight: 600; margin-bottom: 4px; }
            .stat-card .value { font-size: 22px; font-weight: 700; color: #172033; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: #8792a4; background: #fafbfc; font-weight: 700; padding: 10px 12px; border-bottom: 1px solid #eef0f4; text-align: left; }
            td { font-size: 11px; color: #455168; padding: 10px 12px; border-bottom: 1px solid #eef0f4; vertical-align: top; }
            tr:last-child td { border-bottom: 0; }
            .status { display: inline-flex; padding: 4px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; }
            .status.AKTIF { background: #fff7e8; color: #9a5b00; }
            .status.SELESAI { background: #ecfdf3; color: #087443; }
            .nrp-null { color: #8792a4; }
            .footer { margin-top: 30px; border-top: 1px solid #e8ebf0; padding-top: 12px; font-size: 9px; color: #788397; }
            .footer p { margin: 0 0 4px 0; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="eyebrow">GATEOPS · LAPORAN OPERASIONAL</p>
            <h1>Laporan Kehadiran &amp; Aktivitas</h1>
            <p class="meta">Ditanggal ${today} · Oleh: ${generatedBy}</p>
          </div>
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Total Personel</div><div class="value">${result.data.statistics.totalPersonnel}</div></div>
            <div class="stat-card"><div class="label">DI DALAM</div><div class="value">${result.data.statistics.insidePersonnel}</div></div>
            <div class="stat-card"><div class="label">DI LUAR</div><div class="value">${result.data.statistics.outsidePersonnel}</div></div>
            <div class="stat-card"><div class="label">Transaksi Keluar</div><div class="value">${result.data.statistics.exitTransactions}</div></div>
            <div class="stat-card"><div class="label">Transaksi Kembali</div><div class="value">${result.data.statistics.returnTransactions}</div></div>
          </div>
          <h2 style="font-size: 16px; margin: 0 0 8px 0;">Daftar Aktivitas (${result.data.activities.length} aktivitas)</h2>
          <table>
            <thead>
              <tr>
                <th>Personel</th><th>NRP</th><th>Gate Keluar</th><th>Gate Kembali</th><th>Waktu Keluar</th><th>Waktu Kembali</th><th>Tujuan</th><th>Keperluan</th><th>Durasi</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${result.data.activities.map(activity => `
                <tr>
                  <td><strong>${activity.personnelName}</strong></td>
                  <td class="${activity.nrp ? '' : 'nrp-null'}">${activity.nrp || "—"}</td>
                  <td>${activity.exitGate}</td>
                  <td>${activity.returnGate || "—"}</td>
                  <td>${dateTime(activity.exitAt)}</td>
                  <td>${dateTime(activity.returnAt)}</td>
                  <td>${activity.destination}</td>
                  <td>${activity.purpose}</td>
                  <td>${duration(activity.durationSeconds, activity.status)}</td>
                  <td><span class="status ${activity.status}">${activity.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${result.data.activities.length === 0 ? '<p><strong>Belum ada aktivitas yang tercatat.</strong> Aktivitas akan muncul setelah transaksi QR Gate dilakukan.</p>' : ''}
          <div class="footer">
            <p>Sistem GATEOPS · Laporan Kehadiran &amp; Aktivitas</p>
            <p>Data aktual dari sistem pada waktu generasi laporan. Periode, layout, header/footer, dan grafik sesuai keputusan Owner (PRD 25.1 - PENDING).</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (cause) {
      setPrinting(false);
      alert(cause instanceof Error ? cause.message : "Gagal mengunduh PDF.");
    }
  }

  return <section className="admin-page report-page">
    <div className="admin-heading">
      <div>
        <p className="eyebrow">LAPORAN OPERASIONAL</p>
        <h1>Laporan Kehadiran &amp; Aktivitas</h1>
        <p className="muted">Data aktivitas keluar dan kembali seluruh personel dari sistem.</p>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? "Memuat..." : "Perbarui data"}</button>
        <button className="primary-button" onClick={() => void downloadPdf()} disabled={loading || !result || printing}>
          {printing ? "Menyiapkan PDF..." : <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Download size={16} /> Unduh PDF</span>}
        </button>
      </div>
    </div>
    {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={() => void load()}>Coba lagi</button></div>}
    {loading && <p className="muted" role="status">Memuat data laporan...</p>}
    {result && <div className="table-card">
      <div className="table-toolbar">
        <div>
          <h2>Statistik Kehadiran</h2>
          <p>Data aktual dari sistem pada waktu generasi laporan.</p>
        </div>
      </div>
      <div className="report-stat-grid">
        <article className="report-stat-card"><span>Total Personel</span><strong>{result.data.statistics.totalPersonnel}</strong></article>
        <article className="report-stat-card"><span>DI DALAM</span><strong>{result.data.statistics.insidePersonnel}</strong></article>
        <article className="report-stat-card"><span>DI LUAR</span><strong>{result.data.statistics.outsidePersonnel}</strong></article>
        <article className="report-stat-card"><span>Transaksi Keluar</span><strong>{result.data.statistics.exitTransactions}</strong></article>
        <article className="report-stat-card"><span>Transaksi Kembali</span><strong>{result.data.statistics.returnTransactions}</strong></article>
      </div>
      <div className="table-toolbar" style={{ marginTop: "1.5rem" }}>
        <div>
          <h2>Daftar Aktivitas</h2>
          <p>{result.data.activities.length} aktivitas tercatat · diurutkan terbaru terlebih dahulu</p>
        </div>
      </div>
      {result.data.activities.length === 0 ? <div className="table-state"><strong>Belum ada aktivitas yang tercatat.</strong><p>Aktivitas akan muncul setelah transaksi QR Gate dilakukan.</p></div> :
        <div className="table-scroll"><table><thead><tr><th>Personel</th><th>NRP</th><th>Gate Keluar</th><th>Gate Kembali</th><th>Waktu Keluar</th><th>Waktu Kembali</th><th>Tujuan</th><th>Keperluan</th><th>Durasi</th><th>Status</th></tr></thead><tbody>
          {result.data.activities.map(activity => <tr key={activity.id}>
            <td><strong>{activity.personnelName}</strong></td>
            <td>{activity.nrp || "—"}</td>
            <td>{activity.exitGate}</td>
            <td>{activity.returnGate || "—"}</td>
            <td>{dateTime(activity.exitAt)}</td>
            <td>{dateTime(activity.returnAt)}</td>
            <td>{activity.destination}</td>
            <td className="history-purpose">{activity.purpose}</td>
            <td>{duration(activity.durationSeconds, activity.status)}</td>
            <td><span className={activity.status === "AKTIF" ? "activity-status active" : "activity-status"}>{activity.status}</span></td>
          </tr>)}
        </tbody></table></div>}
    </div>}
  </section>;
}
