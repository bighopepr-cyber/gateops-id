"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { createGateQrSvg } from "@/lib/gate-qr-code";

type Props = { credential: string; gateName: string };

export function GateQrCredential({ credential, gateName }: Props) {
  const [copied, setCopied] = useState(false);
  const svg = useMemo(() => createGateQrSvg(credential), [credential]);
  const imageSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  async function copyCredential() {
    try {
      await navigator.clipboard.writeText(credential);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = gateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gate";
    link.href = url;
    link.download = `gate-${safeName}-qr.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="qr-credential-card" aria-labelledby="qr-credential-title">
      <div className="qr-print-header">
        <p className="eyebrow">GATEOPS · KREDENSIAL GATE</p>
        <h2 id="qr-credential-title">QR Code {gateName}</h2>
        <p className="muted">Pindai kode ini menggunakan aplikasi GATEOPS pada akun Personel.</p>
      </div>
      <div className="qr-symbol-wrap">
        <Image src={imageSource} alt={`QR Code ${gateName}`} width={280} height={280} unoptimized />
      </div>
      <div className="qr-actions no-print">
        <button type="button" className="secondary-button" onClick={downloadSvg}>Unduh QR (SVG)</button>
        <button type="button" className="secondary-button" onClick={() => window.print()}>Cetak QR</button>
      </div>
      <div className="no-print">
        <p className="eyebrow">TOKEN RAHASIA · DITAMPILKAN SATU KALI</p>
        <code>{credential}</code>
        <button type="button" className="text-action" onClick={() => void copyCredential()}>{copied ? "Token tersalin" : "Salin token"}</button>
        <p className="muted">Simpan dan tempatkan QR ini di lokasi gate yang terkontrol. Token mentah tidak dapat ditampilkan kembali setelah halaman ditutup.</p>
      </div>
    </section>
  );
}
