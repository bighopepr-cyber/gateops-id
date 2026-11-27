"use client";

import { useCallback, useEffect, useState } from "react";

type Props = { presenceStatus: "DI_DALAM" | "DI_LUAR" };

export function PersonnelGpsTracker({ presenceStatus }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (presenceStatus !== "DI_LUAR" || !navigator.geolocation) {
      setError(null);
      return;
    }
    let active = true;
    let sending = false;
    let wasGranted = false;
    let revocationPending = false;
    let locationPending = false;
    let observedPermissionState: PermissionState | null = null;

    const post = async (body: { latitude: number; longitude: number } | { permissionRevoked: true }) => {
      const response = await fetch("/api/edge/gps-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error("GPS update rejected");
    };

    const reportRevocation = async () => {
      if (!active || sending || !navigator.onLine || !revocationPending) return;
      sending = true;
      try {
        await post({ permissionRevoked: true });
        revocationPending = false;
        if (active) setError("Izin lokasi dicabut oleh browser. Lokasi tidak akan dikirim sampai izin diberikan kembali.");
      } catch {
        if (active) setError("Gagal melaporkan pencabutan izin lokasi. Akan dicoba ulang saat koneksi pulih.");
      } finally {
        sending = false;
      }
    };

    const updateLocation = () => {
      if (!active || !navigator.onLine) return;
      if (sending) { locationPending = true; return; }
      locationPending = false;
      sending = true;
      navigator.geolocation.getCurrentPosition(
        async position => {
          if (!active) { sending = false; return; }
          try {
            await post({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            revocationPending = false;
            wasGranted = true;
            setError(null);
            setLastUpdated(new Date().toLocaleTimeString("id-ID"));
          } catch {
            if (active) setError("Gagal mengirim lokasi ke server. Akan dicoba ulang dalam 30 detik.");
          } finally {
            sending = false;
            if (active && revocationPending) void reportRevocation();
            else if (active && locationPending) updateLocation();
          }
        },
        err => {
          sending = false;
          if (active && revocationPending) void reportRevocation();
          else if (active && locationPending) updateLocation();
          if (err.code === err.PERMISSION_DENIED && wasGranted) {
            revocationPending = true;
            void reportRevocation();
          } else if (err.code === err.PERMISSION_DENIED) {
            if (active) setError("Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser agar tracking GPS dapat berjalan.");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            if (active) setError("Lokasi tidak tersedia dari perangkat ini.");
          } else if (err.code === err.TIMEOUT) {
            if (active) setError("Permintaan lokasi habis waktu. Akan dicoba ulang dalam 30 detik.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    };

    const applyPermissionState = (state: PermissionState) => {
      const previous = observedPermissionState;
      observedPermissionState = state;
      if (previous === "granted" && state === "denied") {
        wasGranted = true;
        revocationPending = true;
        void reportRevocation();
      } else if (state === "granted" && previous !== "granted") {
        wasGranted = true;
        revocationPending = false;
        setError(null);
        updateLocation();
      }
    };

    let permissionStatus: PermissionStatus | null = null;
    const onPermissionChange = () => {
      if (permissionStatus) applyPermissionState(permissionStatus.state);
    };

    const supportsPermissionApi = "permissions" in navigator && !!navigator.permissions?.query;
    if (supportsPermissionApi) {
      void navigator.permissions.query({ name: "geolocation" }).then(status => {
        if (!active) return;
        permissionStatus = status;
        observedPermissionState = status.state;
        wasGranted = status.state === "granted";
        status.addEventListener("change", onPermissionChange);
        if (status.state === "granted") {
          setError(null);
          updateLocation();
        } else if (status.state === "denied" && wasGranted) {
          revocationPending = true;
          void reportRevocation();
        }
      }).catch(() => {
        updateLocation();
      });
    } else {
      updateLocation();
    }

    const onOnline = () => {
      if (revocationPending) void reportRevocation();
      else updateLocation();
    };
    window.addEventListener("online", onOnline);

    const permissionTimer = supportsPermissionApi
      ? window.setInterval(() => {
          void navigator.permissions.query({ name: "geolocation" }).then(status => {
            if (!active) return;
            applyPermissionState(status.state);
            if (revocationPending) void reportRevocation();
          }).catch(() => {});
        }, 1_000)
      : null;

    const timer = window.setInterval(() => {
      if (revocationPending) void reportRevocation();
      else if (observedPermissionState === null || observedPermissionState === "granted") updateLocation();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
      if (permissionTimer !== null) window.clearInterval(permissionTimer);
      window.removeEventListener("online", onOnline);
      permissionStatus?.removeEventListener("change", onPermissionChange);
    };
  }, [presenceStatus]);

  if (!error && presenceStatus !== "DI_LUAR") return null;

  return (
    <div className="gps-error-banner" role="alert" aria-live="polite">
      {error ? (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a3271c", fontWeight: "600" }}>⚠ GPS: {error}</span>
          {lastUpdated && <span style={{ fontSize: "11px", color: "#788397", marginLeft: "12px" }}>Terakhir diperbarui: {lastUpdated}</span>}
        </>
      ) : presenceStatus === "DI_LUAR" && !navigator.geolocation && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#788397" }}>Browser tidak mendukung geolokasi.</span>
      )}
    </div>
  );
}
