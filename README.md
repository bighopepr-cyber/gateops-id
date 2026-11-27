# GATEOPS

GATEOPS — Personnel Presence & Movement Monitoring System.

## Target platform

Pilihan platform target Owner adalah **Supabase + Vercel**: Vercel untuk frontend Next.js, Supabase untuk PostgreSQL terkelola, dan **Supabase Edge Functions untuk backend business API**. Kode saat ini masih menjalankan API melalui Next.js App Router Route Handlers dengan Prisma 7 dan autentikasi username/password berbasis sesi aplikasi; migrasi runtime ke Edge Functions belum dilakukan. Supabase Auth, strategi RLS, kompatibilitas session cookie, data access/transaksi Edge Runtime, pooling, backup, monitoring, dan disaster recovery tetap memerlukan desain teknis. Belum ada klaim project cloud terhubung atau deployment dilakukan.

Lihat [dokumen arsitektur](./docs/architecture.md) untuk pemisahan kondisi repository, target platform, keamanan, dan keputusan yang masih pending.

## Pengembangan lokal

Milestone awal menggunakan Next.js 16, PostgreSQL lokal, Prisma 7 dengan driver adapter pg, dan autentikasi sesi persisten. Supabase dan Vercel tidak diperlukan untuk pengembangan maupun pengujian lokal.

### Prasyarat
- Node.js 22.12+
- npm 10+
- Docker Engine / Docker Desktop dengan Docker Compose

### Setup
1. Salin `.env.example` menjadi `.env`.
2. Isi kredensial seed untuk satu atau beberapa role. Password seed minimal 12 karakter dan tidak memiliki nilai default.
3. Jalankan PostgreSQL: `docker compose up -d postgres`.
4. Instal dependency terkunci: `npm ci`.
5. Buat Prisma Client: `npm run db:generate`.
6. Terapkan migrasi yang tersimpan di repo: `npm run db:deploy`.
7. Buat akun yang dikonfigurasi: `npm run db:seed`.
8. Jalankan aplikasi: `npm run dev` dan buka http://localhost:3000.

### Perintah
- `npm ci` — instalasi deterministik dari `package-lock.json`.
- `npm run dev` — server lokal.
- `npm run lint` — ESLint.
- `npm run typecheck` — pemeriksaan TypeScript.
- `npm test` — unit test.
- `npm run test:e2e` — browser tests.
- `npm run build` — production build.
- `npm run db:migrate` — membuat dan menerapkan migrasi pengembangan.
- `npm run db:deploy` — menerapkan migrasi yang telah dikomit.
- `npm run db:seed` — seed akun development yang dikonfigurasi secara eksplisit.

### Akun awal
Atur pasangan environment `SEED_SUPER_ADMIN_*`, `SEED_KOMANDAN_*`, `SEED_PERSONEL_*`, dan/atau `SEED_PERSIT_*`. Untuk fixture lokal Persit yang terverifikasi, isi `SEED_PERSIT_LINKED_PERSONNEL_USERNAME` dengan username Personel seed; akun Persit yang belum terhubung dapat disiapkan lewat `SEED_PERSIT_PENDING_USERNAME/PASSWORD`. Script menolak pasangan yang tidak lengkap, memeriksa username lintas role, dan menyimpan password dengan Argon2id. Tidak ada akun/password bawaan.

### Status implementasi
Fondasi saat ini mencakup skema user/session, autentikasi password, sesi HttpOnly persisten, halaman login, dashboard role-aware, dan ubah password. Modul Super Admin untuk data personel, akun, pengelolaan gate, dan verifikasi Persit telah diimplementasikan pada branch fitur terkait. Fondasi kredensial QR Gate telah diimplementasikan pada branch fitur: Gate baru menerima token acak 256-bit yang hanya disimpan sebagai hash dan divalidasi server-side; token mentah menjadi payload QR tanpa URL/metadata, QR SVG dapat diunduh dan dicetak setelah Gate baru dibuat. Implementasi awal transaksi Personel juga tersedia pada branch fitur: scanner kamera, form keluar, transaksi keluar/kembali yang mengubah status dan menyimpan aktivitas secara atomik, pemeriksaan sesi dan Gate aktif, serta lock non-blocking per Personel. Verifikasi CI dan pengujian konkurensi/rollback masih berlangsung; jangan menganggap fitur telah VERIFIED sebelum bukti CI tersedia. Gate lama belum memiliki kredensial; regenerasi dan penghapusan Gate masih menunggu keputusan PRD. Pemindaian kamera memerlukan browser yang mendukung BarcodeDetector (misalnya Chrome/Edge versi terbaru); browser tanpa API tersebut menampilkan pesan dukungan dan belum dapat memindai. GPS tracking dasar juga sedang diimplementasikan pada branch fitur: lokasi aktual dikirim dari browser setiap 30 detik selama Personel DI LUAR dan sesi aktif, satu titik terbaru disimpan di PostgreSQL, dan lokasi hanya dapat dibaca Super Admin/Komandan. Status lokasi terakhir dihitung sebagai AKTIF sampai dengan 60 detik sejak pembaruan terakhir dan OFFLINE setelah lebih dari 60 detik; pembaruan tetap dikirim setiap 30 detik. Pencabutan izin lokasi yang sebelumnya diberikan saat halaman aktif mengubah status menjadi OFFLINE segera tanpa menghapus titik terakhir; saat izin diberikan kembali, lokasi aktual dikirim lagi dan status dipulihkan. Browser yang tidak menyediakan Permissions API tidak dapat melaporkan transisi izin secara real-time. Status TIDAK AKTIF, GPS tanpa data awal, sesi berakhir, dan GPS saat transaksi kembali gagal tetap menunggu keputusan §25.6. Peta dashboard interaktif, riwayat aktivitas, dan PDF belum diimplementasikan.

Lihat [PRD.md](./PRD.md) dan [AGENTS.md](./AGENTS.md).


### Riwayat aktivitas
- Super Admin dan Komandan membuka `/admin/history` untuk melihat seluruh aktivitas dengan filter tanggal, nama, NRP, Gate, tujuan, dan status.
- Personel membuka `/personnel/history` untuk melihat aktivitas miliknya sendiri dan detail pribadi.
- API `/api/activities` dan `/api/activities/[id]` menegakkan scope role di server; Persit ditolak. Aktivitas terbaru ditampilkan lebih dahulu, halaman dibatasi 20 baris, dan aktivitas AKTIF tidak menampilkan durasi.
- Laporan PDF belum termasuk slice ini karena periode dan layout masih PENDING di PRD §25.1.
