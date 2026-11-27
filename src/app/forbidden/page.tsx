import Link from "next/link";
export default function ForbiddenPage(){return <main className="center-page"><div className="empty-icon">403</div><h1>Akses tidak diizinkan</h1><p className="muted">Akun Anda tidak memiliki izin untuk membuka halaman ini.</p><Link className="primary-button link-button" href="/dashboard">Kembali ke dashboard</Link></main>;}
