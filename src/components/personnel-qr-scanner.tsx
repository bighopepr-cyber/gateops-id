"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PresenceStatus = "DI_DALAM" | "DI_LUAR";
type BarcodeResult = { rawValue?: string };
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type Props = {
  initialStatus: PresenceStatus;
  activeActivity: { destination: string; purpose: string; exitAt: string; gateName: string } | null;
};

export function PersonnelQrScanner({ initialStatus, activeActivity }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoOpenedRef = useRef(false);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const lastCredentialRef = useRef("");
  const emptyFramesRef = useRef(0);
  const destinationRef = useRef("");
  const purposeRef = useRef("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [opening, setOpening] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completed, setCompleted] = useState(false);
  const [cameraRetryAvailable, setCameraRetryAvailable] = useState(true);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    setCameraActive(false);
    setOpening(false);
  }, []);

  const submitCredential = useCallback(async (credential: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setError("");
    setNotice("Memverifikasi QR Gate dan memproses transaksi...");
    try {
      if (!navigator.onLine) {
        stopCamera();
        setNotice("");
        setError("Koneksi internet terputus. Transaksi ditolak. Pulihkan koneksi lalu buka kamera dan pindai ulang.");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/edge/gates/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          credential,
          ...(initialStatus === "DI_DALAM" ? { destination: destinationRef.current, purpose: purposeRef.current } : {})
        })
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string; data?: { direction?: string } };
      if (response.ok) {
        stopCamera();
        setCompleted(true);
        setNotice(result.message ?? "Transaksi berhasil disimpan.");
        router.refresh();
        return;
      }
      setNotice("");
      if (response.status === 401) {
        stopCamera();
        setError(result.error ?? "Sesi login berakhir. Silakan login kembali.");
        router.replace("/login");
        router.refresh();
        return;
      }
      if (response.status === 404) {
        setError("QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi");
        return;
      }
      if (response.status === 409) {
        setError(result.error ?? "Transaksi belum dapat diproses. Silakan pindai ulang secara manual.");
        return;
      }
      if (response.status >= 500 || response.status === 422) stopCamera();
      setError(result.error ?? "Transaksi ditolak. Periksa data lalu pindai ulang secara manual.");
    } catch {
      stopCamera();
      setNotice("");
      setError("Koneksi ke server terputus. Tidak ada retry otomatis. Pulihkan koneksi lalu buka kamera dan pindai ulang.");
    } finally {
      abortRef.current = null;
      processingRef.current = false;
      setProcessing(false);
    }
  }, [initialStatus, router, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraRetryAvailable(true);
    setError("");
    setNotice("");
    if (!navigator.onLine) {
      setError("Koneksi internet diperlukan untuk memindai QR Gate.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraRetryAvailable(false);
      setError("Akses kamera tidak tersedia. Buka aplikasi melalui HTTPS atau localhost pada browser yang mendukung kamera.");
      return;
    }
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setCameraRetryAvailable(false);
      setError("Browser ini belum mendukung pembacaan QR dari kamera. Gunakan Chrome atau Edge versi terbaru untuk melanjutkan.");
      return;
    }
    setOpening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("VIDEO_NOT_READY");
      video.srcObject = stream;
      await video.play();
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      setCameraActive(true);
      setNotice("Arahkan kamera ke QR Code Gate. Pemindaian dan transaksi memerlukan koneksi internet.");
      const scanFrame = async () => {
        if (!videoRef.current || !detectorRef.current || processingRef.current) {
          if (streamRef.current) frameRef.current = requestAnimationFrame(() => void scanFrame());
          return;
        }
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detectorRef.current.detect(videoRef.current);
            const credential = codes.find(code => typeof code.rawValue === "string" && code.rawValue.length > 0)?.rawValue;
            if (credential) {
              emptyFramesRef.current = 0;
              if (credential !== lastCredentialRef.current) {
                lastCredentialRef.current = credential;
                await submitCredential(credential);
              }
            } else {
              emptyFramesRef.current += 1;
              if (emptyFramesRef.current >= 5) lastCredentialRef.current = "";
            }
          }
          if (streamRef.current && !completed) frameRef.current = requestAnimationFrame(() => void scanFrame());
        } catch {
          stopCamera();
          setNotice("");
          setError("QR tidak dapat dibaca. Pastikan QR terlihat jelas dan pencahayaan cukup, lalu coba membuka kamera kembali.");
        }
      };
      frameRef.current = requestAnimationFrame(() => void scanFrame());
    } catch (cause) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
      const name = cause instanceof DOMException ? cause.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Izin kamera ditolak atau diblokir browser. Izinkan akses kamera pada pengaturan situs, lalu coba membuka kamera kembali.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("Kamera tidak ditemukan pada perangkat ini. Sambungkan atau pilih perangkat dengan kamera, lalu coba kembali.");
      } else if (name === "NotReadableError") {
        setError("Kamera sedang digunakan aplikasi lain atau tidak dapat diakses. Tutup aplikasi lain, lalu coba membuka kamera kembali.");
      } else if (name === "NotSupportedError") {
        setCameraRetryAvailable(false);
        setError("Browser ini tidak mendukung pembacaan QR Code. Gunakan Chrome atau Edge versi terbaru.");
      } else {
        setError("Kamera gagal dibuka. Periksa izin dan kondisi perangkat, lalu coba membuka kamera kembali.");
      }
    } finally {
      setOpening(false);
    }
  }, [completed, stopCamera, submitCredential]);

  useEffect(() => {
    destinationRef.current = destination;
    purposeRef.current = purpose;
  }, [destination, purpose]);

  useEffect(() => {
    if (initialStatus === "DI_LUAR" && !completed && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      void startCamera();
    }
  }, [completed, initialStatus, startCamera]);

  useEffect(() => {
    const onOffline = () => {
      abortRef.current?.abort();
      stopCamera();
      setNotice("");
      setError("Koneksi internet terputus. Pemindaian dihentikan dan tidak ada transaksi yang diantrekan. Pindai ulang setelah koneksi pulih.");
    };
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("offline", onOffline);
      abortRef.current?.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [stopCamera]);

  const canStart = initialStatus === "DI_LUAR" || (destination.trim().length > 0 && purpose.trim().length > 0);

  return <section className="scanner-page">
    <div className="scanner-heading">
      <div><p className="eyebrow">TRANSAKSI KEHADIRAN</p><h1>Scan QR Gate</h1><p className="muted">Pindai QR pada Gate aktif untuk mencatat transaksi keluar atau kembali.</p></div>
      <span className={"presence-badge " + (initialStatus === "DI_DALAM" ? "inside" : "outside")}>{initialStatus === "DI_DALAM" ? "DI DALAM" : "DI LUAR"}</span>
    </div>

    {initialStatus === "DI_DALAM" && !completed && <section className="scanner-form-card">
      <h2>Informasi keluar</h2>
      <p className="muted">Tujuan dan keperluan wajib diisi sebelum kamera dapat dibuka.</p>
      <label>Tujuan<input value={destination} onChange={event => setDestination(event.target.value)} maxLength={240} required placeholder="Masukkan tujuan" disabled={cameraActive} /></label>
      <label>Keperluan<textarea value={purpose} onChange={event => setPurpose(event.target.value)} maxLength={500} required rows={3} placeholder="Jelaskan keperluan keluar" disabled={cameraActive} /></label>
    </section>}

    {initialStatus === "DI_LUAR" && activeActivity && !completed && <section className="scanner-form-card">
      <h2>Aktivitas sedang berlangsung</h2>
      <dl className="scanner-activity-details">
        <div><dt>Gate keluar</dt><dd>{activeActivity.gateName}</dd></div>
        <div><dt>Waktu keluar</dt><dd>{new Date(activeActivity.exitAt).toLocaleString("id-ID")}</dd></div>
        <div><dt>Tujuan</dt><dd>{activeActivity.destination}</dd></div>
        <div><dt>Keperluan</dt><dd>{activeActivity.purpose}</dd></div>
      </dl>
      <p className="muted">Pindai QR Gate aktif untuk mencatat waktu kembali dan menyelesaikan aktivitas ini.</p>
    </section>}

    {error && <div className="scanner-error" role="alert"><p>{error}</p>{!cameraActive && !completed && cameraRetryAvailable && canStart && <button className="secondary-button" onClick={() => void startCamera()} disabled={opening}>Coba buka kamera kembali</button>}</div>}
    {notice && <p className="scanner-notice" role="status">{notice}</p>}

    <section className="scanner-camera-card">
      <div className="scanner-video-wrap">
        <video ref={videoRef} className={cameraActive ? "camera-active" : ""} muted playsInline aria-label="Tampilan kamera pemindai QR Gate" />
        {!cameraActive && <div className="scanner-placeholder"><span className="scanner-frame" aria-hidden="true">▦</span><strong>{completed ? "Transaksi selesai" : "Kamera belum aktif"}</strong><span>{completed ? "Status kehadiran telah diperbarui." : "Kamera akan aktif setelah Anda menekan tombol di bawah."}</span></div>}
        {cameraActive && <div className="scanner-reticle" aria-hidden="true"><span/></div>}
      </div>
      {!completed && <div className="scanner-actions">
        {!cameraActive
          ? <button className="primary-button" onClick={() => void startCamera()} disabled={!canStart || opening || processing}>{opening ? "Membuka kamera..." : initialStatus === "DI_DALAM" ? "Buka kamera untuk keluar" : "Buka kamera untuk kembali"}</button>
          : <button className="secondary-button" onClick={stopCamera} disabled={processing}>Hentikan kamera</button>}
        <Link className="secondary-button scanner-back-link" href="/dashboard">Kembali ke dashboard</Link>
      </div>}
      {completed && <div className="scanner-actions"><Link className="primary-button" href="/dashboard">Kembali ke dashboard</Link></div>}
      {processing && <p className="muted scanner-processing">Transaksi sedang diproses. Jangan tutup halaman.</p>}
    </section>
    <p className="muted scanner-footnote">Pemindaian wajib online. QR tidak valid tidak mengubah status kehadiran. Jika transaksi gagal, lakukan pemindaian ulang secara manual setelah siap.</p>
  </section>;
}
