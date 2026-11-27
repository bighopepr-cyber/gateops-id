"use client";
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="center-page"><h1>Terjadi gangguan</h1><p className="muted">Halaman tidak dapat dimuat. Coba muat ulang.</p><button className="primary-button" onClick={()=>reset()}>Coba lagi</button></main>;}
