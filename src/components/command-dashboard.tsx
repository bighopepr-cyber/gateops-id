"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardData = {
  statistics: { totalPersonnel: number; insidePersonnel: number; outsidePersonnel: number };
  outsidePersonnel: Array<{
    id: string; displayName: string; nrp: string | null; rank: string | null; position: string | null;
    exitGate: string; destination: string; purpose: string; exitAt: string | null; gpsStatus: "AKTIF" | "OFFLINE" | null;
  }>;
  latestActivities: Array<{
    id: string; personnelName: string; nrp: string | null; gate: string; type: "KELUAR" | "KEMBALI";
    occurredAt: string; status: "AKTIF" | "SELESAI";
  }>;
};

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("id-ID") : "—";

export function CommandDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch("/api/edge/command-dashboard", { cache: "no-store" });
      const body = await response.json() as { data?: DashboardData; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? (response.status === 401 ? "Sesi login berakhir. Silakan login kembali." : "Dashboard tidak dapat dimuat."));
      setData(body.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dashboard tidak dapat dimuat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  return <section className="command-dashboard" aria-label="Ringkasan operasional">
    <div className="command-dashboard-heading">
      <div><p className="eyebrow">PEMANTAUAN OPERASIONAL</p><h2>Dashboard Komando</h2><p className="muted">Data personel dan transaksi terbaru dari sistem.</p></div>
      <button className="secondary-button" onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? "Memperbarui..." : "Perbarui data"}</button>
    </div>
    {error && <div className="form-error" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => void load(true)} disabled={refreshing}>Coba lagi</button></div>}
    {loading && <p className="muted" role="status">Memuat data operasional...</p>}
    {data && <>
      <div className="command-stat-grid">
        <article className="command-stat-card"><span>Total personel</span><strong>{data.statistics.totalPersonnel}</strong></article>
        <article className="command-stat-card"><span>DI DALAM</span><strong>{data.statistics.insidePersonnel}</strong></article>
        <article className="command-stat-card"><span>DI LUAR</span><strong>{data.statistics.outsidePersonnel}</strong></article>
      </div>
      <section className="command-data-section">
        <div className="section-heading"><div><h2>Personel DI LUAR</h2><p>Personel dengan aktivitas keluar yang masih aktif.</p></div><span className="role-pill">{data.outsidePersonnel.length} personel</span></div>
        {data.outsidePersonnel.length === 0 ? <p className="gps-empty">Tidak ada personel yang sedang DI LUAR.</p> :
          <div className="table-wrap"><table><thead><tr><th>Personel</th><th>Gate keluar</th><th>Tujuan</th><th>Keperluan</th><th>Waktu keluar</th><th>GPS</th></tr></thead><tbody>
            {data.outsidePersonnel.map(person => <tr key={person.id}>
              <td><strong>{person.displayName}</strong><small>{[person.nrp, person.rank, person.position].filter(Boolean).join(" · ") || "—"}</small></td>
              <td>{person.exitGate}</td><td>{person.destination}</td><td>{person.purpose}</td><td>{dateTime(person.exitAt)}</td>
              <td><span className={person.gpsStatus === "OFFLINE" ? "gps-live-label gps-offline-label" : "gps-live-label"}>{person.gpsStatus ?? "BELUM ADA DATA"}</span></td>
            </tr>)}
          </tbody></table></div>}
      </section>
      <section className="command-data-section">
        <div className="section-heading"><div><h2>Aktivitas terbaru</h2><p>Sepuluh aktivitas terakhir, diurutkan berdasarkan waktu transaksi terbaru.</p></div></div>
        {data.latestActivities.length === 0 ? <p className="gps-empty">Belum ada aktivitas yang tercatat.</p> :
          <div className="table-wrap"><table><thead><tr><th>Personel</th><th>Gate</th><th>Transaksi</th><th>Waktu</th><th>Status aktivitas</th></tr></thead><tbody>
            {data.latestActivities.map(activity => <tr key={activity.id}>
              <td><strong>{activity.personnelName}</strong><small>{activity.nrp ?? "NRP belum tersedia"}</small></td>
              <td>{activity.gate}</td><td>{activity.type}</td><td>{dateTime(activity.occurredAt)}</td><td>{activity.status}</td>
            </tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </section>;
}
