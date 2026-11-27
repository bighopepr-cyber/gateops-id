# GATEOPS — Arsitektur Aplikasi dan Target Platform

## 1. Status dan keputusan Owner

Dokumen ini membedakan arsitektur target, kondisi kode yang sudah berjalan, dan detail yang belum diputuskan.

| Area | Baseline repository | Target yang diputuskan |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript | Next.js di Vercel |
| Business API | Next.js App Router Route Handlers (saat ini) | Supabase Edge Functions |
| Database | PostgreSQL melalui Prisma 7 | Supabase managed PostgreSQL |
| Authentication | Username/password, Argon2id, opaque DB session, HttpOnly cookie | Pertahankan kontrak autentikasi aplikasi selama migrasi |
| Local development/CI | PostgreSQL lokal/container | Pertahankan environment lokal yang reproducible |

- **Decision #58:** Vercel untuk frontend Next.js dan Supabase untuk PostgreSQL terkelola.
- **Decision #59:** Supabase Edge Functions menjadi backend business API.
- Keputusan ini tidak menyatakan bahwa project Supabase/Vercel sudah dibuat, terhubung, atau dideploy.

## 2. Arsitektur target

```text
Browser
  |
  | HTTPS + HttpOnly application session cookie
  v
Next.js Frontend (Vercel)
  |
  | BFF/proxy only when needed to forward HttpOnly session
  | No business rules or duplicated authorization
  v
Supabase Edge Functions (business API)
  |
  | Validate application session + account status
  | Enforce role, permission, and data scope
  v
Supabase PostgreSQL
  |
  +-- application users and sessions
  +-- gates and QR credentials
  +-- personnel presence and activities
  +-- GPS latest location
  +-- audit log
```

Next.js tetap menjadi frontend. Edge Functions memiliki business API dan validasi server-side. Next.js Route Handlers boleh menjadi BFF/proxy untuk kompatibilitas cookie, tetapi tidak boleh menjadi tempat kedua untuk business logic. Setelah seluruh pemanggil berpindah dan E2E terverifikasi, Route Handlers API lama dapat dihapus secara bertahap.

## 3. BFF bridge yang telah diimplementasikan

Next.js menyediakan route server-side `/api/edge/[...path]` sebagai jembatan terbatas menuju `/functions/v1/gateops-api`:

- Endpoint baca menggunakan GET pada allowlist `whoami`, `permission`, `gps-locations`, `command-dashboard`, `reports-data`, `activities`, `activity-detail`, `audit-logs`, `accounts`, `personnel`, dan `gates`. Pengelolaan Gate mengizinkan POST pada koleksi `/gates` dan PATCH pada `/gates/:id`; metode lain ditolak. Route ini bukan open proxy.
- BFF mengekstrak tepat satu cookie `gateops_session` dengan format token yang valid dan hanya meneruskan cookie tersebut.
- Header `x-gateops-service-key` dan `apikey` berasal dari environment server `GATEOPS_SERVICE_KEY` dan `SUPABASE_PUBLISHABLE_KEY`; tidak ada nilai dengan prefiks `NEXT_PUBLIC_`.
- `SUPABASE_URL` harus HTTPS, kecuali localhost/127.0.0.1 untuk pengembangan lokal.
- Request tidak di-cache, memiliki timeout 10 detik, dan response hanya meneruskan payload `data` atau pesan `error`; header upstream tidak diteruskan.
- Konfigurasi yang hilang, cookie tidak valid/duplikat, respons upstream non-JSON, dan kegagalan jaringan ditangani fail-closed.
- Bridge telah digunakan oleh UI dashboard, riwayat, audit, daftar akun/personel, dan pengelolaan Gate. Operasi bisnis lain yang belum dimigrasikan masih menggunakan Next.js Route Handlers/Prisma.

Environment opsional dicantumkan di `.env.example`. Untuk hosting, ketiga nilai harus disimpan sebagai environment variables server-side (bukan `NEXT_PUBLIC_*`). Tidak ada nilai kredensial yang dicantumkan di repository.

## 3. Baseline runtime saat ini

Kode yang sudah ada belum mengikuti topologi target sepenuhnya:

1. Browser mengakses aplikasi Next.js.
2. Halaman dan komponen React berjalan di Next.js App Router.
3. Business API saat ini masih berjalan pada `src/app/api/**/route.ts`.
4. Route Handlers memanggil helper autentikasi, authorization, dan Prisma.
5. Prisma mengakses PostgreSQL.
6. Sesi login menggunakan cookie HttpOnly `gateops_session` yang berisi opaque random token; database menyimpan SHA-256 hash dan waktu kedaluwarsa sesi.

Implementasi Edge Functions belum dianggap selesai hanya karena folder atau konfigurasi Supabase ditambahkan. Migrasi harus memindahkan eksekusi business logic, validasi identitas/permission, dan akses data yang sesungguhnya.

## 4. Kontrak autentikasi dan keamanan

### Application session tetap dipertahankan

GATEOPS saat ini tidak memakai Supabase Auth untuk login. Session cookie berisi opaque token acak dan record sesi berada di database. Supabase Edge gateway JWT verification tidak otomatis memvalidasi opaque session tersebut.

Karena cookie HttpOnly berada pada domain frontend, opsi BFF/proxy di Next.js dapat meneruskan token sesi ke Edge Function melalui kanal server-to-server. Jika BFF digunakan:

- BFF hanya meneruskan request dan response; tidak mengimplementasikan business rules.
- Kredensial service-to-service harus berada di environment server, tidak pernah pada browser.
- Edge Function tetap memvalidasi opaque session terhadap record sesi dan expiry di database.
- Token sesi tidak boleh dicatat ke log.
- BFF tidak boleh menjadi jalur yang melewati permission checks.

Alternatif pemanggilan langsung dari browser hanya boleh dipilih bila mekanisme session lintas origin dan keamanan cookie/token dirancang serta diuji. Jangan mengekspos token sesi atau service-role key untuk mengatasi masalah CORS.

### Otorisasi

Setiap Edge Function yang mengakses data terlindungi wajib:

1. Memvalidasi identitas/sesi aplikasi, termasuk expiry dan status akun.
2. Memastikan role dan permission sesuai kontrak RBAC GATEOPS.
3. Menerapkan cakupan data pada query, bukan hanya menyembunyikan UI.
4. Menolak akses default bila identitas atau permission tidak valid.
5. Menghindari penggunaan service-role client tanpa filter otorisasi yang berasal dari sesi terverifikasi.
6. Tidak menggunakan user-editable JWT metadata sebagai sumber keputusan authorization.

Platform JWT check dapat menjadi lapisan tambahan untuk credential yang memang sesuai, tetapi bukan pengganti validasi application session GATEOPS. Konfigurasi `verify_jwt` setiap fungsi harus mengikuti credential model yang dipilih dan diuji; jangan mematikannya sekadar untuk menghilangkan 401.

### Database dan transaksi

- Secret/service-role key hanya berada di Edge Functions atau runtime server yang terpercaya.
- Browser tidak mengakses database secara langsung.
- RLS perlu dirancang sebagai defense-in-depth sesuai model session GATEOPS; jangan mengaktifkan policy generik `auth.uid()` tanpa identity mapping yang benar.
- Operasi yang membutuhkan beberapa perubahan data harus tetap atomik. Untuk transaksi QR, status presence/activity dan audit event yang diwajibkan harus commit atau rollback bersama.
- Karena pola PostgREST request terpisah tidak otomatis membentuk satu transaksi multi-statement, operasi atomik perlu menggunakan PostgreSQL function/RPC atau mekanisme transaksi lain yang dibuktikan melalui test.
- Prisma saat ini dipakai untuk schema/data access/migrasi. Kompatibilitas Prisma Client dengan Deno Edge Runtime tidak boleh diasumsikan; jalur data access dan migrasi harus ditetapkan dan diverifikasi sebelum porting.

## 5. Strategi migrasi bertahap

Migrasi tidak boleh dilakukan dengan menyalin file Route Handler Node.js ke Deno. Kode existing menggunakan `server-only`, Next cookies/redirect, Prisma Client, dan Node crypto; API Edge Functions berjalan pada Deno runtime.

Tahapan implementasi:

1. **Foundation:** scaffold Supabase config/functions, helper CORS/HTTP/error, application-session validator, permission guard, dan data-access contract. Uji terhadap PostgreSQL lokal tanpa mengubah jalur produksi.
2. **Pilot read-only:** pindahkan satu endpoint baca dengan role scope, error contract, pagination, dan E2E yang memanggil Edge Function lokal.
3. **Domain migration:** pindahkan domain per domain, dimulai dari endpoint baca dan dilanjutkan operasi tulis; tiap domain memiliki parity test dan E2E.
4. **Transactional workflows:** migrasikan transaksi QR, audit log, GPS, dan proses multi-record dengan atomicity/rollback tests.
5. **Frontend cutover:** alihkan pemanggil UI ke Edge Functions melalui BFF bila diperlukan. Bandingkan hasil dan akses role dengan API lama.
6. **Retirement:** hapus API Route Handler lama hanya setelah tidak ada pemanggil tersisa dan seluruh CI/E2E relevan lulus.

Setiap tahap wajib mencatat progres, file berubah, test evidence, commit/PR/CI, dan status merge. Tidak ada tahap yang boleh ditandai VERIFIED tanpa bukti test/CI.

## 6. Local development dan CI

Pengembangan tetap harus reproducible tanpa project cloud:

- PostgreSQL lokal melalui Docker Compose.
- Supabase CLI dan Edge Runtime lokal untuk menjalankan/menguji functions.
- Prisma schema/migrations yang tersimpan di repository sampai jalur migrasi database diputuskan dan diuji.
- Unit test untuk session validation, permission, input, error contract, dan domain rules.
- Integration test dengan PostgreSQL lokal.
- E2E browser yang memverifikasi UI → BFF/Edge Function → PostgreSQL → authorization.
- CI menjalankan dependency audit, database migration, lint, typecheck, unit, integration/E2E, dan production build sesuai workflow.

Koneksi remote dan deployment harus diverifikasi terpisah. Tidak ada project cloud yang diasumsikan.

## 7. Keputusan teknis yang masih pending

- Apakah Supabase Auth akan menjadi identity provider tambahan/pengganti. Tidak ada migrasi auth tanpa keputusan Owner.
- Detail format dan autentikasi service-to-service antara Vercel BFF dan Edge Functions.
- Apakah browser boleh memanggil fungsi langsung atau semua request melewati BFF.
- Strategi RLS dan identity mapping untuk application sessions.
- Pilihan data access untuk Edge Functions (supabase-js/PostgREST, direct PostgreSQL, atau kombinasi).
- Strategi Prisma schema/migration dan transaksi atomik pada runtime Edge.
- Pembagian nama/fungsi per domain, API versioning, CORS, rate limiting, idempotency, dan timeout.
- Environment development/staging/production, secrets, deployment approval, rollback.
- Logging, error tracking, monitoring, backup, disaster recovery, RPO/RTO.
- Target performa, kapasitas, dan availability.

Keputusan tersebut harus ditetapkan dan diuji sebelum implementasi yang bergantung padanya.

## 8. Status implementasi

- Frontend Next.js dan Route Handlers lama: tersedia pada repository.
- Supabase Edge Functions sebagai target backend: diputuskan Owner, migrasi runtime belum dilakukan.
- Supabase cloud integration: belum diverifikasi.
- Vercel deployment: belum dilakukan.
- Production readiness: belum dinyatakan.


## 9. Implementasi awal Edge Function (branch fondasi)

Slice pertama menyediakan function `gateops-api` dengan endpoint internal `GET /whoami` dan `GET /permission?name=...`. Keduanya hanya menerima panggilan server-to-server yang menyertakan header `x-gateops-service-key`. Kunci ini merupakan secret aplikasi terpisah, harus sama pada pemanggil server Vercel dan Edge Function, dan tidak boleh dikirim ke browser atau dicatat pada log.

Supabase gateway JWT verification dimatikan hanya untuk function ini karena autentikasi aplikasi memakai opaque cookie, bukan Supabase JWT. Keamanan endpoint tidak dibiarkan anonim: handler memeriksa service key secara constant-time sebelum membaca cookie. Selanjutnya function menghitung SHA-256 dari nilai cookie `gateops_session`, mencari hash sesi yang belum expired pada database, lalu mengambil identitas dan role dari record user. Permission memakai modul role-permission bersama yang juga diimpor aplikasi Next.js.

Akses database menggunakan Supabase Data API dengan secret key server-side pada header `apikey`. Secret key modern diambil dari `SUPABASE_SECRET_KEYS` (key bernama `default`); `SUPABASE_SECRET_KEY` dan kunci legacy `SUPABASE_SERVICE_ROLE_KEY` hanya fallback kompatibilitas. Function tidak menerima token database dari request. Endpoint ini tidak mengaktifkan CORS karena kontraknya server-to-server, bukan browser-to-Edge.

Variabel runtime yang diperlukan:
- `GATEOPS_SERVICE_KEY`: secret acak bersama antara BFF Vercel dan Edge Function.
- `SUPABASE_URL`: URL project Supabase.
- `SUPABASE_SECRET_KEYS`: JSON map secret API key Supabase; function menggunakan entri `default`. `SUPABASE_SECRET_KEY` atau `SUPABASE_SERVICE_ROLE_KEY` dapat dipakai sebagai fallback environment lokal.

Tidak ada BFF Next.js yang dialihkan pada slice ini, tidak ada domain bisnis yang dipindahkan, dan belum ada project cloud/deployment. Pengujian integrasi PostgreSQL untuk kontrak session resolver berjalan terhadap database CI; pengujian runtime hosted/PostgREST tetap harus dilakukan sebelum cutover.


## 10. Pilot migrasi baca lokasi GPS

Endpoint baca lokasi GPS dashboard telah dialihkan secara bertahap melalui jalur berikut: browser → Next.js BFF `/api/edge/gps-locations` → Supabase Edge Function `gateops-api/gps-locations` → Supabase Data API/PostgREST. BFF hanya meneruskan satu cookie aplikasi yang tervalidasi dan kredensial server-side. Browser tidak menerima secret Supabase atau service key.

Edge Function memvalidasi service credential, opaque application session yang belum kedaluwarsa, serta permission `gps-read`; role yang diizinkan tetap hanya SUPER_ADMIN dan KOMANDAN. Query PostgREST membatasi hasil ke PERSONEL berstatus DI_LUAR dengan koordinat dan waktu update lengkap, menyertakan maksimal satu aktivitas AKTIF terbaru, dan mengurutkan lokasi berdasarkan waktu update terbaru. Status GPS dihitung dengan aturan bersama: permission yang dicabut langsung OFFLINE, usia update lebih dari 60 detik OFFLINE, dan tepat 60 detik masih AKTIF.

Komponen dashboard menggunakan BFF Edge baru. Next.js API lama `/api/gps/locations` tetap dipertahankan sementara sebagai fallback dan pembanding; endpoint tersebut belum boleh dihapus sebelum verifikasi hosted runtime dan seluruh test parity diselesaikan. Unit test adapter memverifikasi filter PostgREST, pemetaan bentuk JSON, error handling, dan status GPS. CI lokal tidak membuktikan koneksi ke project Supabase hosted; verifikasi hosted tetap tertunda sampai project dan environment server dikonfigurasi.


## 11. Pilot migrasi Dashboard Komando

Dashboard Komando menggunakan jalur browser → Next.js BFF `/api/edge/command-dashboard` → Supabase Edge Function `gateops-api/command-dashboard` → Supabase Data API/PostgREST. BFF hanya meneruskan cookie sesi aplikasi dan kredensial server-side yang telah dibatasi; browser tidak menerima secret database atau service key.

Edge Function memvalidasi kredensial layanan, sesi opaque yang aktif, dan permission `command-dashboard`; hanya SUPER_ADMIN dan KOMANDAN yang diizinkan. Adapter mengambil tiga jumlah personel dengan exact count database (total, DI_DALAM, DI_LUAR), daftar personel DI_LUAR beserta satu aktivitas AKTIF terbaru, dan sepuluh aktivitas terakhir menurut `updated_at DESC`. Bentuk respons dipertahankan sesuai kontrak komponen Dashboard Komando; status GPS memakai helper bersama.

Endpoint Next.js `/api/dashboard/command` tetap tersedia sebagai fallback dan sumber parity browser E2E sementara. E2E CI mengintersep endpoint BFF baru dan meneruskan request ke endpoint lama yang membaca PostgreSQL CI; adapter PostgREST diuji terpisah dengan kontrak query dan mapping. Pengujian tersebut tidak membuktikan runtime Supabase hosted. Endpoint lama tidak boleh dihapus sebelum verifikasi hosted runtime dan parity penuh selesai.


## 12. Pilot migrasi data laporan

Endpoint baca dataset laporan tersedia melalui browser → Next.js BFF `/api/edge/reports-data` → Supabase Edge Function `gateops-api/reports-data` → Supabase Data API/PostgREST. BFF tetap hanya meneruskan cookie sesi aplikasi yang tervalidasi dan kredensial server-side; browser tidak menerima secret database atau service key.

Edge Function memvalidasi service credential, opaque session aktif, permission `reports-create`, dan role SUPER_ADMIN/KOMANDAN sebelum query. Adapter PostgREST mengambil exact count personel (total, DI_DALAM, DI_LUAR), exact count seluruh transaksi dan transaksi yang telah kembali, serta seluruh aktivitas berurutan `exit_at DESC, id DESC`. Pengambilan aktivitas menggunakan Range pagination dan memastikan jumlah row sesuai exact count agar dataset tidak diam-diam terpotong oleh batas halaman API. Mapping respons mempertahankan kontrak lama termasuk relasi personel, gate keluar/kembali, timestamp ISO, durasi, tujuan, keperluan, dan status.

Endpoint Next.js `/api/reports/data` tetap dipertahankan sebagai fallback dan sumber parity browser E2E. Unit tests menguji query/count, mapping, timestamp, pagination lintas 1.000 row, malformed data, dan error. Browser E2E menguji endpoint BFF baru melalui parity bridge ke endpoint lama yang didukung PostgreSQL CI; ini bukan hosted Supabase runtime verification. Periode, layout PDF, header/footer, format halaman, dan detail grafik tetap PENDING_OWNER_DECISION sesuai PRD §25.1; slice ini tidak menambahkan atau mengasumsikan UI/PDF.


## 13. Riwayat aktivitas melalui Supabase Edge

Daftar riwayat aktivitas dan detail transaksi menggunakan browser → Next.js BFF `/api/edge/activities` atau `/api/edge/activity-detail` → Supabase Edge Function `gateops-api/activities` atau `gateops-api/activity-detail` → Supabase Data API/PostgREST. BFF meneruskan hanya parameter query yang diizinkan, menolak parameter tidak dikenal/duplikat, dan mempertahankan metadata pagination yang tervalidasi.

Edge Function memeriksa permission dari role map server-side: SUPER_ADMIN/KOMANDAN dengan `activity-read-all` dapat membaca semua personel; PERSONEL dengan `personal-activity-read` dibatasi oleh `personnel_id` sesi aktif; PERSIT dan role lain ditolak. Query parser memvalidasi rentang tanggal, filter nama/NRP/gate/tujuan/status, dan pagination. Filter gate mencari ID Gate terlebih dahulu lalu membandingkan `exit_gate_id` atau `return_gate_id` pada tabel aktivitas; ini menghindari OR lintas embedded resource yang tidak didukung PostgREST. Daftar menggunakan exact count, sort `exit_at DESC`, dan range page/pageSize. Detail hanya mengembalikan satu aktivitas dan menyertakan lokasi gate; akses Personel terhadap ID milik akun lain menghasilkan 404.

Komponen daftar, modal detail, dan halaman detail Personel menggunakan BFF Edge. Route Handler Next.js `/api/activities` dan `/api/activities/[id]` tetap tersedia sebagai fallback serta sumber parity browser E2E berbasis PostgreSQL CI. Adapter PostgREST dan parser query diuji dengan unit tests; browser E2E membuktikan UI/role/scope terhadap route legacy melalui bridge, bukan hosted Supabase runtime. Tidak ada klaim deployment.


## 14. Audit Log melalui Supabase Edge

Audit Log Super Admin dibaca melalui browser → Next.js BFF `/api/edge/audit-logs` → Supabase Edge Function `gateops-api/audit-logs` → Supabase Data API/PostgREST. BFF meneruskan hanya parameter `page` dan `pageSize`, menolak parameter tidak dikenal/duplikat, dan memvalidasi array data serta metadata pagination sebelum merespons.

Edge Function mensyaratkan permission `audit-read` dan role SUPER_ADMIN. Adapter hanya memilih field yang telah tersedia pada kontrak lama: identitas actor, role, action, entity type/ID, metadata, dan created_at; actor_user_id tidak diekspos. Exact count, page size maksimum 100, serta urutan `created_at DESC, id DESC` dipertahankan. Metadata divalidasi sebagai object datar dengan nilai primitive, sesuai kontrak writer yang menolak key sensitif.

UI AuditLogViewer menggunakan BFF Edge. Next.js `/api/admin/audit-logs` tetap tersedia sebagai fallback dan sumber parity browser E2E berbasis PostgreSQL CI. Unit tests menguji mapping, exact count, pagination, metadata dan error; browser E2E memakai parity bridge dan bukan hosted Supabase runtime verification.


## 15. Daftar akun dan personel melalui Supabase Edge

GET `/api/edge/accounts` dan `/api/edge/personnel` digunakan oleh AccountManagement dan PersonnelManagement melalui Next.js BFF. Edge Function memvalidasi permission `accounts-manage`/role SUPER_ADMIN untuk daftar akun serta `personnel-read` untuk daftar personel (SUPER_ADMIN/KOMANDAN). Account list tetap memuat semua role termasuk PERSIT; personnel list hanya role PERSONEL. Field dan urutan mengikuti kontrak Next.js lama, dengan exact count dan Range pagination untuk mencegah pemotongan default Data API di atas 1.000 row. Password hash, session, dan credential tidak dipilih.

POST/PATCH/DELETE/reset-password tetap melalui Next.js/Prisma pada slice ini. Operasi tersebut menggunakan Argon2id dan transaksi audit/session revoke; pemindahannya memerlukan implementasi Deno-compatible Argon2id serta transaksi/RPC PostgreSQL teruji, sehingga tidak disamakan dengan migrasi read-only. Browser E2E menguji UI dan role melalui parity bridge ke endpoint lama berbasis PostgreSQL CI; hosted Supabase runtime belum diverifikasi.


## 15. Hardening pembacaan Audit Log

Adapter Edge menolak metadata audit dengan key yang mengandung indikator password, token, secret, cookie, credential, hash, atau authorization. Nilai metadata dibatasi pada scalar JSON (null, string, boolean, dan number finite); object/array bersarang ditolak. Untuk setiap halaman, jumlah row wajib sama dengan `min(pageSize, total - offset)` berdasarkan exact count; ketidaksesuaian menyebabkan request gagal tertutup. Endpoint menggunakan guard eksplisit SUPER_ADMIN dan permission `audit-read`. Batas verifikasi hosted Supabase runtime dan deployment tetap berlaku.


## 16. Pengelolaan Gate melalui Supabase Edge

UI Pengelolaan Gate menggunakan `/api/edge/gates` untuk membaca dan membuat Gate, serta `/api/edge/gates/:id` untuk perubahan nama, lokasi, dan status. BFF hanya mengizinkan GET/POST pada koleksi Gate dan PATCH pada ID yang tervalidasi; query string ditolak dan body dibatasi ukuran serta format JSON.

Edge Function mensyaratkan sesi aplikasi aktif, role SUPER_ADMIN, dan permission `gate-manage`. Pembuatan Gate menghasilkan token acak 256-bit, menyimpan SHA-256 hash saja, dan mengembalikan token mentah tepat satu kali pada respons create. Daftar Gate tidak memilih `qr_token_hash`; operasi update tidak dapat mengubah kredensial QR.

Mutasi Gate dan Audit Log dilakukan oleh PostgreSQL RPC `gateops_create_gate` dan `gateops_update_gate` dalam satu transaksi database. Fungsi RPC hanya dapat dipanggil oleh service_role pada Supabase (PUBLIC execute dicabut). Migrasi SQL disimpan di Prisma migrations agar CI dapat menerapkannya pada PostgreSQL bersih. Next.js Route Handlers lama tetap dipertahankan sebagai fallback dan parity target E2E; penghapusan Gate dan regenerasi QR tetap PENDING sesuai PRD.
