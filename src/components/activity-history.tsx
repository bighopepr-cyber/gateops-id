"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ActivityRow = {
  id: string;
  destination: string;
  purpose: string;
  status: "AKTIF" | "SELESAI";
  exitAt: string;
  returnAt: string | null;
  durationSeconds: number | null;
  personnel: { displayName: string; nrp: string | null };
  exitGate: { name: string };
  returnGate: { name: string } | null;
};
type ResponseData = { data: ActivityRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type Filters = { from: string; to: string; personnelName: string; nrp: string; gate: string; destination: string; status: string };
const emptyFilters: Filters = { from: "", to: "", personnelName: "", nrp: "", gate: "", destination: "", status: "" };
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
function duration(value: number | null, status: string) {
  if (status === "AKTIF" || value === null) return "—";
  const minutes = Math.floor(value / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days ? days + " hari" : "", hours ? hours + " jam" : "", rest + " menit"].filter(Boolean).join(" ");
}
function localBoundary(date: string, end = false) {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return value.toISOString();
}

export function ActivityHistory({ scope }: { scope: "all" | "personal" }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [result, setResult] = useState<ResponseData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ActivityRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async (currentPage: number, currentFilters: Filters) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(currentPage), pageSize: "20" });
    if (currentFilters.from) params.set("from", localBoundary(currentFilters.from));
    if (currentFilters.to) params.set("to", localBoundary(currentFilters.to, true));
    if (scope === "all") {
      if (currentFilters.personnelName.trim()) params.set("personnelName", currentFilters.personnelName.trim());
      if (currentFilters.nrp.trim()) params.set("nrp", currentFilters.nrp.trim());
      if (currentFilters.gate.trim()) params.set("gate", currentFilters.gate.trim());
      if (currentFilters.destination.trim()) params.set("destination", currentFilters.destination.trim());
    }
    if (currentFilters.status) params.set("status", currentFilters.status);
    try {
      const response = await fetch("/api/edge/activities?" + params.toString(), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Riwayat aktivitas gagal dimuat.");
      setResult(body as ResponseData);
    } catch (cause) {
      setError(cause instanceof TypeError ? "Koneksi ke server terputus. Periksa jaringan lalu coba lagi." : cause instanceof Error ? cause.message : "Terjadi kesalahan.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void Promise.resolve().then(() => load(page, applied)); }, [load, page, applied]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }
  function resetFilters() {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  }
  async function openDetail(id: string) {
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await fetch("/api/edge/activity-detail?id=" + encodeURIComponent(id), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Detail aktivitas gagal dimuat.");
      setDetail(body.data as ActivityRow);
    } catch (cause) {
      setDetailError(cause instanceof TypeError ? "Koneksi ke server terputus." : cause instanceof Error ? cause.message : "Terjadi kesalahan.");
    } finally {
      setDetailLoading(false);
    }
  }

  return <section className="admin-page activity-history">
    <div className="admin-heading"><div><p className="eyebrow">RIWAYAT &amp; AKTIVITAS</p><h1>{scope === "all" ? "Riwayat Aktivitas" : "Riwayat Aktivitas Pribadi"}</h1><p className="muted">{scope === "all" ? "Telusuri aktivitas seluruh personel berdasarkan filter operasional." : "Riwayat transaksi keluar dan kembali milik akun Anda."}</p></div></div>
    <form className="history-filters" onSubmit={applyFilters}>
      <label>Tanggal mulai<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => setFilters({ ...filters, from: event.target.value })}/></label>
      <label>Tanggal akhir<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => setFilters({ ...filters, to: event.target.value })}/></label>
      {scope === "all" && <>
        <label>Nama personel<input value={filters.personnelName} maxLength={160} onChange={event => setFilters({ ...filters, personnelName: event.target.value })} placeholder="Cari nama"/></label>
        <label>NRP<input value={filters.nrp} maxLength={40} onChange={event => setFilters({ ...filters, nrp: event.target.value })} placeholder="Cari NRP"/></label>
        <label>Gate<input value={filters.gate} maxLength={120} onChange={event => setFilters({ ...filters, gate: event.target.value })} placeholder="Nama gate"/></label>
        <label>Tujuan<input value={filters.destination} maxLength={240} onChange={event => setFilters({ ...filters, destination: event.target.value })} placeholder="Cari tujuan"/></label>
      </>}
      <label>Status aktivitas<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">Semua status</option><option value="AKTIF">AKTIF</option><option value="SELESAI">SELESAI</option></select></label>
      <div className="history-filter-actions"><button className="primary-button" type="submit">Terapkan filter</button><button className="secondary-button" type="button" onClick={resetFilters}>Reset</button></div>
    </form>
    {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={() => void load(page, applied)}>Coba lagi</button></div>}
    <div className="table-card">
      <div className="table-toolbar"><div><h2>Daftar aktivitas</h2><p>{result ? `${result.pagination.total} aktivitas · terbaru lebih dahulu` : "Aktivitas terbaru lebih dahulu"}</p></div><button className="secondary-button" onClick={() => void load(page, applied)} disabled={loading}>Muat ulang</button></div>
      {loading ? <div className="table-state" role="status">Memuat riwayat aktivitas...</div> : !result?.data.length && !error ? <div className="table-state"><strong>Belum ada riwayat aktivitas</strong><p>Aktivitas yang tercatat melalui transaksi QR Gate akan tampil di sini.</p></div> : result?.data.length ? <div className="table-scroll"><table><thead><tr>{scope === "all" && <th>Personel</th>}<th>Gate keluar / kembali</th><th>Waktu keluar</th><th>Waktu kembali</th><th>Tujuan</th><th>Keperluan</th><th>Durasi</th><th>Status</th><th>Detail</th></tr></thead><tbody>{result.data.map(row => <tr key={row.id}>{scope === "all" && <td><strong>{row.personnel.displayName}</strong><small className="history-secondary">{row.personnel.nrp || "NRP belum tersedia"}</small></td>}<td>{row.exitGate.name}<small className="history-secondary">Kembali: {row.returnGate?.name || "—"}</small></td><td>{dateTime(row.exitAt)}</td><td>{dateTime(row.returnAt)}</td><td>{row.destination}</td><td className="history-purpose">{row.purpose}</td><td>{duration(row.durationSeconds, row.status)}</td><td><span className={row.status === "AKTIF" ? "activity-status active" : "activity-status"}>{row.status}</span></td><td><button className="text-action" onClick={() => void openDetail(row.id)}>Lihat detail</button></td></tr>)}</tbody></table></div> : null}
      {result && result.pagination.totalPages > 1 && <div className="history-pagination"><span>Halaman {page} dari {result.pagination.totalPages}</span><div><button className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><button className="secondary-button" disabled={loading || page >= result.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>}
    </div>
    {(detailLoading || detailError || detail) && <div className="modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title"><div className="modal-title"><div><p className="eyebrow">DETAIL TRANSAKSI</p><h2 id="activity-detail-title">Detail Aktivitas</h2></div><button className="icon-button" aria-label="Tutup detail" onClick={() => { setDetail(null); setDetailError(""); }}>×</button></div>{detailLoading ? <div className="table-state" role="status">Memuat detail...</div> : detailError ? <p className="form-error" role="alert">{detailError}</p> : detail && <dl className="history-detail-grid">{scope === "all" && <><div><dt>Nama personel</dt><dd>{detail.personnel.displayName}</dd></div><div><dt>NRP</dt><dd>{detail.personnel.nrp || "—"}</dd></div></>}<div><dt>Gate keluar</dt><dd>{detail.exitGate.name}</dd></div><div><dt>Gate kembali</dt><dd>{detail.returnGate?.name || "—"}</dd></div><div><dt>Waktu keluar</dt><dd>{dateTime(detail.exitAt)}</dd></div><div><dt>Waktu kembali</dt><dd>{dateTime(detail.returnAt)}</dd></div><div><dt>Tujuan</dt><dd>{detail.destination}</dd></div><div><dt>Keperluan</dt><dd>{detail.purpose}</dd></div><div><dt>Total durasi</dt><dd>{duration(detail.durationSeconds, detail.status)}</dd></div><div><dt>Status</dt><dd>{detail.status}</dd></div></dl>}</section></div>}
  </section>;
}
