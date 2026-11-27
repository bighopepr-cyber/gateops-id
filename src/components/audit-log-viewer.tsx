"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  actorUsername: string;
  actorDisplayName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};
type Result = {
  data: AuditRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "medium"
}).format(new Date(value));

export function AuditLogViewer() {
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/edge/audit-logs?page=" + currentPage + "&pageSize=25", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Audit log gagal dimuat.");
      setResult(body as Result);
    } catch (cause) {
      setError(cause instanceof TypeError ? "Koneksi ke server terputus." : cause instanceof Error ? cause.message : "Terjadi kesalahan.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load(page)); }, [load, page]);

  return <section className="admin-page">
    <div className="admin-heading">
      <div>
        <p className="eyebrow">KEAMANAN &amp; AKUNTABILITAS</p>
        <h1>Audit Log</h1>
        <p className="muted">Catatan perubahan penting yang dilakukan melalui sistem GATEOPS.</p>
      </div>
      <button className="secondary-button" onClick={() => void load(page)} disabled={loading}>Muat ulang</button>
    </div>
    {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={() => void load(page)}>Coba lagi</button></div>}
    <div className="table-card">
      <div className="table-toolbar">
        <div><h2>Catatan aktivitas sistem</h2><p>{result ? result.pagination.total + " catatan · terbaru lebih dahulu" : "Perubahan penting dicatat otomatis."}</p></div>
      </div>
      {loading ? <div className="table-state" role="status">Memuat audit log...</div>
        : !result?.data.length && !error ? <div className="table-state"><strong>Belum ada catatan audit</strong><p>Catatan akan muncul setelah perubahan penting dilakukan.</p></div>
        : result?.data.length ? <div className="table-scroll"><table>
          <thead><tr><th>Waktu</th><th>Pelaku</th><th>Tindakan</th><th>Objek</th><th>Detail</th></tr></thead>
          <tbody>{result.data.map(row => <tr key={row.id}>
            <td>{dateTime(row.createdAt)}</td>
            <td><strong>{row.actorDisplayName}</strong><small className="history-secondary">{row.actorUsername} · {row.actorRole}</small></td>
            <td><code>{row.action}</code></td>
            <td>{row.entityType}<small className="history-secondary">{row.entityId || "—"}</small></td>
            <td><code>{JSON.stringify(row.metadata)}</code></td>
          </tr>)}</tbody>
        </table></div> : null}
      {result && result.pagination.totalPages > 1 && <div className="history-pagination">
        <span>Halaman {page} dari {result.pagination.totalPages}</span>
        <div>
          <button className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Sebelumnya</button>
          <button className="secondary-button" disabled={loading || page >= result.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Berikutnya</button>
        </div>
      </div>}
    </div>
  </section>;
}
