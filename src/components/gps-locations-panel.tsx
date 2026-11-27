"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGpsMapLayout } from "@/lib/gps-map-layout";

type LocationRecord = {
  id: string;
  displayName: string;
  nrp: string | null;
  rank: string | null;
  position: string | null;
  gpsLatitude: number;
  gpsLongitude: number;
  gpsUpdatedAt: string;
  gpsPermissionRevokedAt: string | null;
  gpsStatus: "AKTIF" | "OFFLINE";
  activities: { destination: string; purpose: string; exitAt: string }[];
};

const dateTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function GpsLocationsPanel() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomAdjustment, setZoomAdjustment] = useState(0);
  const [mapWidth, setMapWidth] = useState(900);
  const mapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/edge/gps-locations", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sesi login berakhir." : response.status === 403 ? "Akses lokasi GPS ditolak." : "Lokasi GPS tidak dapat dimuat.");
      const result = await response.json() as { data: LocationRecord[] };
      setLocations(result.data);
      setSelectedId(current => current && result.data.some(item => item.id === current) ? current : null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lokasi GPS tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 900);
      if (width > 0) setMapWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [locations.length]);

  const layout = useMemo(() => createGpsMapLayout(
    locations.map(item => ({ id: item.id, latitude: item.gpsLatitude, longitude: item.gpsLongitude })),
    mapWidth,
    360,
    zoomAdjustment
  ), [locations, mapWidth, zoomAdjustment]);
  const selected = locations.find(item => item.id === selectedId) ?? null;
  const selectedMarker = layout.markers.find(marker => marker.id === selectedId) ?? null;

  return <section className="gps-locations-panel">
    <div className="gps-panel-heading">
      <div><p className="eyebrow">GPS TRACKING</p><h2>Lokasi Personel DI LUAR</h2><p className="muted">Peta menampilkan lokasi terakhir yang berhasil diterima dari personel yang sedang DI LUAR.</p></div>
      <button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? "Memuat..." : "Perbarui"}</button>
    </div>
    {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-action" onClick={() => void load()}>Coba lagi</button></div>}
    {loading && <p className="muted" role="status">Memuat lokasi GPS...</p>}
    {!loading && !error && locations.length === 0 && <p className="gps-empty">Belum ada lokasi GPS yang diterima dari personel DI LUAR.</p>}
    {locations.length > 0 && <>
      <div className="gps-map-toolbar"><span>{locations.length} titik lokasi · diperbarui otomatis setiap 30 detik</span><div><button className="secondary-button" aria-label="Perkecil peta" onClick={() => setZoomAdjustment(value => Math.max(-8, value - 1))}>−</button><button className="secondary-button" aria-label="Perbesar peta" onClick={() => setZoomAdjustment(value => Math.min(8, value + 1))}>+</button><button className="secondary-button" onClick={() => setZoomAdjustment(0)}>Sesuaikan</button></div></div>
      <div className="gps-map-frame" ref={mapRef} role="region" aria-label="Peta GPS personel">
        {layout.tiles.map(tile => <img key={tile.key} className="gps-map-tile" src={tile.url} alt="" draggable={false} style={{ left: tile.left, top: tile.top }}/>)}
        {layout.markers.map(marker => {
          const person = locations.find(item => item.id === marker.id);
          if (!person) return null;
          return <button key={marker.id} type="button" className={marker.id === selectedId ? "gps-map-marker selected" : "gps-map-marker"} style={{ left: marker.left, top: marker.top }} onClick={() => setSelectedId(marker.id)} aria-label={"Lokasi " + person.displayName + ", status GPS " + person.gpsStatus} aria-pressed={marker.id === selectedId}>
            <span>{locations.findIndex(item => item.id === marker.id) + 1}</span>
          </button>;
        })}
        {selected && selectedMarker && <aside className="gps-map-popup" style={{ left: Math.max(150, Math.min(mapWidth - 150, selectedMarker.left)), top: Math.max(12, selectedMarker.top - 14) }}>
          <button type="button" className="gps-map-popup-close" aria-label="Tutup detail lokasi" onClick={() => setSelectedId(null)}>×</button>
          <strong>{selected.displayName}</strong>
          <span>{[selected.nrp, selected.rank, selected.position].filter(Boolean).join(" · ") || "Identitas personel"}</span>
          <span className={selected.gpsStatus === "OFFLINE" ? "gps-map-popup-status offline" : "gps-map-popup-status"}>{selected.gpsStatus}</span>
          <small>Update: {dateTime(selected.gpsUpdatedAt)}</small>
          <a href={`https://www.openstreetmap.org/?mlat=${selected.gpsLatitude}&mlon=${selected.gpsLongitude}#map=16/${selected.gpsLatitude}/${selected.gpsLongitude}`} target="_blank" rel="noreferrer">Buka peta lebih besar</a>
        </aside>}
      </div>
      <p className="gps-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
      <div className="gps-location-list">
        {locations.map(item => <article className="gps-location-card" key={item.id}>
          <div className="gps-location-title"><div><h3>{item.displayName}</h3><p>{[item.nrp, item.rank, item.position].filter(Boolean).join(" · ") || "Identitas personel"}</p></div><span className={`gps-live-label ${item.gpsStatus === "OFFLINE" ? "gps-offline-label" : ""}`}>{item.gpsStatus}</span></div>
          <dl><div><dt>Latitude</dt><dd>{item.gpsLatitude.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{item.gpsLongitude.toFixed(6)}</dd></div><div><dt>Pembaruan terakhir</dt><dd>{dateTime(item.gpsUpdatedAt)}</dd></div><div><dt>Tujuan</dt><dd>{item.activities[0]?.destination ?? "—"}</dd></div></dl>
          <div className="gps-location-actions"><button className="text-action" onClick={() => setSelectedId(item.id)}>Tampilkan di peta</button><a href={`https://www.openstreetmap.org/?mlat=${item.gpsLatitude}&mlon=${item.gpsLongitude}#map=16/${item.gpsLatitude}/${item.gpsLongitude}`} target="_blank" rel="noreferrer">Buka lokasi</a></div>
        </article>)}
      </div>
    </>}
  </section>;
}
