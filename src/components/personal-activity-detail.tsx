"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ActivityDetail = {
  id: string; destination: string; purpose: string; status: "AKTIF" | "SELESAI";
  exitAt: string; returnAt: string | null; durationSeconds: number | null;
  personnel: { displayName: string; nrp: string | null };
  exitGate: { name: string; location: string };
  returnGate: { name: string; location: string } | null;
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function duration(seconds: number | null, status: string) {
  if (status === "AKTIF" || seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return [days ? days + " hari" : "", hours ? hours + " jam" : "", rest + " menit"].filter(Boolean).join(" ");
}

export function PersonalActivityDetail({ id }: { id: string }) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setNotFound(false);
    try {
      const response = await fetch("/api/edge/activity-detail?id=" + encodeURIComponent(id), { cache: "no-store", signal });
      const body = await response.json();
      if (response.status === 404) {
        setNotFound(true);
        setActivity(null);
      } else if (!response.ok) {
        throw new Error(body.error || "Detail aktivitas tidak dapat dimuat.");
      } else {
        setActivity(body.data as ActivityDetail);
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof TypeError ? "Koneksi ke server terputus. Periksa jaringan lalu coba lagi." :
        cause instanceof Error ? cause.message : "Terjadi kesalahan.");
      setActivity(null);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, attempt]);

  return <section className="admin-page">
    <div className="admin-heading"><div><p className="eyebrow">DETAIL TRANSAKSI</p><h1>Detail Aktivitas</h1><p className="muted">Informasi transaksi keluar dan kembali milik Anda.</p></div></div>
    {loading ? <div className="table-state" role="status">Memuat detail aktivitas...</div> :
      notFound ? <div className="table-state" role="alert"><strong>Aktivitas tidak ditemukan</strong><p>Aktivitas tidak tersedia atau bukan milik akun Anda.</p><Link className="secondary-button" href="/personnel/history">Kembali ke Riwayat</Link></div> :
      error ? <div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={() => setAttempt(value => value + 1)}>Coba lagi</button></div> :
      activity ? <>
        <dl className="history-detail-grid">
          <div><dt>Nama</dt><dd>{activity.personnel.displayName}</dd></div>
          <div><dt>NRP</dt><dd>{activity.personnel.nrp ?? "—"}</dd></div>
          <div><dt>Gate keluar</dt><dd>{activity.exitGate.name}</dd></div>
          <div><dt>Lokasi gate keluar</dt><dd>{activity.exitGate.location}</dd></div>
          <div><dt>Gate kembali</dt><dd>{activity.returnGate?.name ?? "—"}</dd></div>
          <div><dt>Lokasi gate kembali</dt><dd>{activity.returnGate?.location ?? "—"}</dd></div>
          <div><dt>Waktu keluar</dt><dd>{dateTime(activity.exitAt)}</dd></div>
          <div><dt>Waktu kembali</dt><dd>{dateTime(activity.returnAt)}</dd></div>
          <div><dt>Tujuan</dt><dd>{activity.destination}</dd></div>
          <div><dt>Keperluan</dt><dd>{activity.purpose}</dd></div>
          <div><dt>Total durasi</dt><dd>{duration(activity.durationSeconds, activity.status)}</dd></div>
          <div><dt>Status</dt><dd>{activity.status}</dd></div>
        </dl>
        <div><Link className="secondary-button" href="/personnel/history">Kembali ke riwayat</Link></div>
      </> : null}
  </section>;
}
