PRODUCT REQUIREMENTS DOCUMENT (PRD)

GATEOPS

Personnel Presence & Movement Monitoring System

Versi: 1.0
Status: Draft — Consolidated Requirements
Platform: Web Application
Design Style: Apple Style — Light Mode
Navigation: Sidebar
Currency: Tidak relevan untuk sistem operasional

---

1. PRODUCT OVERVIEW

1.1 Nama Produk

GATEOPS — Personnel Presence & Movement Monitoring System.

1.2 Deskripsi Produk

GATEOPS merupakan aplikasi berbasis web untuk memantau kehadiran personel, mengelola transaksi keluar dan kembali melalui QR Code pada gate, melakukan tracking lokasi GPS saat personel berada di luar, serta menyediakan riwayat aktivitas dan laporan operasional.

Sistem memiliki empat role pengguna:

1. Super Admin
2. Komandan
3. Personel
4. Persit

Sistem menggunakan QR Code per gate untuk pencatatan transaksi keluar dan kembali. Status personel ditentukan secara otomatis berdasarkan transaksi QR Code yang berhasil.

GPS tracking aktif secara otomatis setelah transaksi keluar berhasil dan berhenti setelah transaksi kembali berhasil, selama sesi web aktif dan izin lokasi tersedia.

1.3 Audit Logging

- Semua perubahan penting pada akun, data personel, Gate, verifikasi pengaitan Persit, dan transaksi kehadiran wajib dicatat dalam audit log.
- Setiap catatan memuat identitas pelaku dan role, jenis tindakan, jenis/ID objek, waktu server, serta metadata yang relevan dan aman.
- Perubahan bisnis dan catatan audit harus disimpan dalam satu transaksi database yang sama; kegagalan salah satunya membatalkan keduanya.
- Audit log bersifat append-only melalui aplikasi.
- Password, password hash, token sesi, cookie, token QR mentah, dan rahasia autentikasi dilarang dicatat.
- Frekuensi pembaruan GPS tidak dicatat sebagai event audit individual.
- Hak akses pembacaan, masa retensi, pencarian, dan ekspor audit log belum ditetapkan dan tetap PENDING_OWNER_DECISION. Implementasi awal membatasi tampilan audit log kepada Super Admin sebagai least-privilege sementara.

---

2. TUJUAN PRODUK

1. Memantau status keberadaan personel secara digital.
2. Mencatat aktivitas keluar dan kembali secara terstruktur.
3. Mengetahui personel yang sedang berada di luar.
4. Menampilkan lokasi terakhir personel yang sedang di luar.
5. Mempermudah pengawasan melalui Dashboard Komandan.
6. Menyediakan riwayat aktivitas yang dapat ditelusuri.
7. Menyediakan laporan PDF.
8. Memungkinkan Persit memantau status personel yang telah terhubung dan diverifikasi.
9. Mengelola data personel, akun, gate dan QR Code dalam satu sistem.

---

3. PLATFORM DAN DESAIN

3.1 Platform

- Web application.
- Akses melalui browser.
- Sistem memiliki autentikasi login.
- UI responsif untuk perangkat yang didukung.

3.2 Design System

- Apple Style.
- Light Mode.
- Sidebar navigation.
- Tampilan minimalis, bersih, modern.
- Layout berbasis dashboard.
- Komponen tabel, cards, form, modal dan status badge.

3.3 Navigasi

Navigasi menyesuaikan role pengguna.

Pengguna hanya melihat menu yang sesuai dengan hak aksesnya.

Menu utama sistem:

1. Dashboard Komando
2. Data Personel
3. Perizinan & Keluar-Masuk
4. GPS Tracking & Notifikasi
5. Riwayat & Laporan
6. Mode Keluarga/Persit

Pengaturan sistem, akun, gate dan QR Code ditempatkan dalam area pengelolaan Super Admin dan bukan sebagai modul utama tambahan.

---

4. USER ROLES

4.1 Super Admin

Super Admin memiliki akses penuh terhadap informasi operasional dan pengelolaan sistem.

Hak akses:

- Melihat seluruh dashboard Komandan.
- Melihat seluruh data personel.
- Menambah data personel.
- Mengedit data personel.
- Menghapus personel secara permanen.
- Mengelola akun Super Admin.
- Mengelola akun Komandan.
- Mengelola akun Personel.
- Memverifikasi akun Persit.
- Mengelola gate.
- Mengelola QR Code gate.
- Melihat seluruh GPS tracking.
- Melihat seluruh riwayat aktivitas.
- Melakukan filter riwayat.
- Membuat dan mengunduh laporan PDF.
- Melakukan reset password pengguna.

4.2 Komandan

Komandan memiliki akses pemantauan operasional.

Hak akses:

- Melihat seluruh data personel.
- Melihat seluruh statistik.
- Melihat daftar personel DI LUAR.
- Melihat GPS tracking.
- Melihat lokasi terakhir personel.
- Melihat status GPS.
- Melihat aktivitas terbaru.
- Melihat seluruh riwayat aktivitas.
- Melakukan filter riwayat.
- Membuat dan mengunduh laporan PDF.
- Mengubah password sendiri.

Komandan tidak memiliki akses:

- Mengelola data personel.
- Menghapus personel.
- Mengelola akun pengguna.
- Mengelola gate.
- Mengelola QR Code.
- Memverifikasi Persit.

4.3 Personel

Personel hanya memiliki akses terhadap data dan aktivitas miliknya sendiri.

Hak akses:

- Melihat status kehadiran sendiri.
- Melakukan scan QR Code.
- Mengisi form keluar.
- Melakukan transaksi kembali.
- Melihat riwayat aktivitas pribadi.
- Melihat detail aktivitas pribadi.
- Mengubah password sendiri.

Personel tidak memiliki akses:

- Data personel lain.
- GPS personel lain.
- Riwayat personel lain.
- Pengelolaan akun.
- Pengelolaan data personel.
- Pengelolaan gate.
- Pengelolaan QR Code.

Personel tidak dapat mengedit profil pribadi melalui sistem.

4.4 Persit

Persit dapat melakukan registrasi mandiri dan mengajukan pengaitan dengan personel berdasarkan NRP.

Hak akses:

- Registrasi mandiri.
- Login.
- Mengajukan pengaitan personel.
- Melihat identitas personel yang terhubung.
- Melihat status kehadiran personel yang terhubung.
- Mengubah password sendiri.

Persit tidak memiliki akses:

- GPS.
- Lokasi terakhir.
- Tujuan.
- Keperluan.
- Waktu keluar.
- Waktu kembali.
- Riwayat aktivitas.
- Data personel lain.
- Pengelolaan sistem.

---

5. ROLE ACCESS MATRIX

Fitur| Super Admin| Komandan| Personel| Persit
Dashboard Komando| Ya| Ya| Tidak| Tidak
Dashboard pribadi| Tidak| Tidak| Ya| Tidak
Dashboard Persit| Tidak| Tidak| Tidak| Ya
Lihat seluruh personel| Ya| Ya| Tidak| Tidak
Tambah personel| Ya| Tidak| Tidak| Tidak
Edit personel| Ya| Tidak| Tidak| Tidak
Hapus permanen personel| Ya| Tidak| Tidak| Tidak
Scan QR| Tidak| Tidak| Ya| Tidak
Transaksi keluar| Tidak| Tidak| Ya| Tidak
Transaksi kembali| Tidak| Tidak| Ya| Tidak
GPS tracking seluruh personel| Ya| Ya| Tidak| Tidak
GPS lokasi terakhir| Ya| Ya| Tidak| Tidak
Riwayat seluruh personel| Ya| Ya| Tidak| Tidak
Riwayat pribadi| Tidak| Tidak| Ya| Tidak
Laporan PDF| Ya| Ya| Tidak| Tidak
Pengelolaan gate| Ya| Tidak| Tidak| Tidak
Pengelolaan QR gate| Ya| Tidak| Tidak| Tidak
Pengelolaan akun| Ya| Tidak| Tidak| Tidak
Verifikasi Persit| Ya| Tidak| Tidak| Tidak
Mengubah password sendiri| Ya| Ya| Ya| Ya

---

6. MODULE 1 — DASHBOARD KOMANDO

Dashboard Komando merupakan dashboard pemantauan operasional yang tersedia untuk Super Admin dan Komandan.

6.1 Statistik Dashboard

Dashboard menampilkan:

- Total personel.
- Total personel DI DALAM.
- Total personel DI LUAR.

Status kehadiran hanya terdiri dari:

- DI DALAM.
- DI LUAR.

Tidak ada status TERLAMBAT, IZIN, CUTI, atau status kehadiran tambahan.

6.2 Daftar Personel DI LUAR

Dashboard menampilkan daftar personel yang sedang berada di luar.

Informasi:

- Nama.
- NRP.
- Pangkat.
- Jabatan.
- Gate keluar.
- Tujuan.
- Keperluan.
- Waktu keluar.
- Status GPS.

6.3 GPS Map

Dashboard menampilkan peta lokasi personel yang sedang DI LUAR.

Data yang ditampilkan:

- Nama personel.
- NRP.
- Pangkat.
- Jabatan.
- Lokasi terakhir.
- Waktu pembaruan lokasi terakhir.
- Status GPS.

Status GPS:

- AKTIF.
- OFFLINE.
- TIDAK AKTIF.

6.4 Latest Activity

Dashboard menampilkan aktivitas terbaru.

Informasi:

- Nama.
- NRP.
- Gate.
- Waktu transaksi.
- Jenis transaksi keluar atau kembali.
- Status aktivitas.

Urutan aktivitas:

Aktivitas terbaru ditampilkan paling atas.

6.5 Dashboard Super Admin

Dashboard Super Admin memiliki seluruh informasi Dashboard Komandan ditambah area pengelolaan sistem.

---

7. MODULE 2 — DATA PERSONEL

7.1 Data Personel

Data personel dikelola oleh Super Admin.

Field data personel:

Field| Keterangan
NRP| Nomor Registrasi Pokok
Nama| Nama lengkap
Pangkat| Pangkat personel
Jabatan| Jabatan personel
Username| Username akun
Password| Password akun

Tidak ada field foto, nomor telepon, atau pengelompokan unit yang ditetapkan.

7.2 CRUD Personel

Super Admin dapat:

- Membuat data personel.
- Mengedit data personel.
- Menghapus data personel secara permanen.

Komandan hanya dapat melihat data personel.

Personel tidak dapat mengedit data profil sendiri.

7.3 Penghapusan Personel

Penghapusan personel bersifat permanen.

Ketika personel dihapus:

- Data personel dihapus secara permanen.
- Akun login Personel yang melekat pada data personel ikut dihapus secara permanen.
- Semua akun Persit yang telah terverifikasi terhubung dengan personel tersebut ikut dihapus secara permanen.
- Sesi login Personel dan Persit terkait ikut dicabut/dihapus.
- Riwayat aktivitas terkait mengikuti penghapusan permanen.
- Data tidak dipertahankan sebagai riwayat personel yang telah dihapus.
- Penghapusan dilakukan sebagai satu operasi atomik; jika salah satu bagian gagal, seluruh operasi dibatalkan.

Akun Persit yang belum terverifikasi atau belum memiliki relasi terhubung tidak ikut dihapus hanya karena NRP yang diajukan sama.

---

8. MODULE 3 — PERIZINAN & KELUAR-MASUK

Modul ini digunakan oleh Personel untuk melakukan transaksi keluar dan kembali melalui QR Code gate.

Tidak terdapat proses pengajuan izin atau persetujuan izin.

8.1 Status Kehadiran

Status kehadiran:

- DI DALAM.
- DI LUAR.

Status awal personel:

DI DALAM.

Status kehadiran menentukan jenis transaksi scan QR.

8.2 Transaksi Keluar

Ketika personel berstatus DI DALAM:

1. Personel login.
2. Sistem menampilkan status DI DALAM.
3. Personel menekan tombol scan QR.
4. Sistem menampilkan form keluar.
5. Personel wajib mengisi tujuan.
6. Personel wajib mengisi keperluan.
7. Kamera belum dapat dibuka sebelum kedua field terisi.
8. Personel membuka kamera.
9. Personel scan QR Code gate.
10. Sistem mengidentifikasi gate berdasarkan QR Code.
11. Sistem memeriksa status gate.
12. Jika gate AKTIF, transaksi diproses.
13. Sistem mencatat waktu keluar.
14. Sistem menyimpan tujuan dan keperluan.
15. Sistem mengubah status kehadiran menjadi DI LUAR.
16. Sistem membuat aktivitas dengan status AKTIF.
17. Sistem mengaktifkan GPS tracking secara otomatis.
18. Dashboard diperbarui.

8.3 Form Keluar

Field wajib:

Field| Validasi
Tujuan| Wajib diisi
Keperluan| Wajib diisi

Tidak ada field tambahan yang ditetapkan.

Kamera tidak dapat dibuka sebelum form selesai diisi.

8.4 Transaksi Kembali

Ketika personel berstatus DI LUAR:

1. Personel login.
2. Sistem menampilkan status DI LUAR.
3. Personel menekan tombol scan QR.
4. Kamera langsung terbuka.
5. Tidak ada form tambahan.
6. Personel scan QR Code gate.
7. Sistem mengidentifikasi gate.
8. Sistem memeriksa status gate.
9. Jika gate AKTIF, transaksi diproses.
10. Sistem mencatat waktu kembali.
11. Sistem mengubah status kehadiran menjadi DI DALAM.
12. Sistem menutup aktivitas.
13. Sistem mengubah status aktivitas menjadi SELESAI.
14. Sistem menghentikan GPS tracking.
15. Sistem menghitung total durasi di luar.
16. Dashboard diperbarui.

8.5 Logika Transaksi Otomatis

Status Sebelum Scan| Proses| Status Setelah Scan
DI DALAM| Keluar| DI LUAR
DI LUAR| Kembali| DI DALAM

Tidak ada pemilihan manual jenis transaksi.

8.6 QR Gate NONAKTIF

Jika gate berstatus NONAKTIF:

- Transaksi keluar ditolak.
- Transaksi kembali ditolak.
- Status kehadiran tidak berubah.
- Tidak ada transaksi berhasil yang dicatat.

---

9. MODULE 4 — GPS TRACKING

9.1 Aktivasi GPS

GPS tracking diaktifkan secara otomatis setelah transaksi keluar berhasil.

GPS tracking berhenti setelah transaksi kembali berhasil.

GPS tracking berjalan selama sesi web aktif.

Tracking tidak diwajibkan berjalan ketika browser ditutup.

9.2 Interval GPS

Interval pengiriman lokasi:

30 detik.

GPS mengirimkan lokasi selama:

- Status kehadiran DI LUAR.
- Sesi web aktif.
- Izin lokasi tersedia.
- Koneksi memungkinkan pengiriman data.

9.3 GPS Status

Status GPS:

Status| Keterangan
AKTIF| GPS sedang mengirimkan data lokasi
OFFLINE| Koneksi internet terputus atau lokasi tidak dapat diperbarui akibat kondisi tracking yang ditetapkan sebagai offline
TIDAK AKTIF| GPS tracking tidak berjalan atau tidak diaktifkan

Status GPS tidak menggantikan status kehadiran.

9.4 GPS Tidak Tersedia Saat Keluar

Jika GPS tidak tersedia atau izin lokasi ditolak:

- Transaksi keluar tetap berhasil.
- Status kehadiran tetap DI LUAR.
- Aktivitas tetap AKTIF.
- GPS berstatus TIDAK AKTIF.
- Sistem tidak membatalkan transaksi keluar.

9.5 GPS OFFLINE

Jika koneksi internet terputus saat personel berada di luar:

- Dashboard menampilkan status OFFLINE.
- Lokasi terakhir yang berhasil diterima tetap ditampilkan.
- Waktu update terakhir tetap ditampilkan.
- Status kehadiran tetap DI LUAR.

9.6 Pemulihan Koneksi

Ketika koneksi internet kembali pulih:

- Tracking kembali aktif secara otomatis.
- GPS melanjutkan pengiriman lokasi setiap 30 detik.
- Tidak diperlukan scan QR ulang.
- Tidak diperlukan aktivasi manual.
- Dashboard memperbarui status setelah data lokasi kembali diterima.

9.7 Izin Lokasi Dicabut

Jika izin lokasi dicabut:

- Status tracking ditampilkan OFFLINE.
- Lokasi terakhir tetap ditampilkan.
- Waktu update terakhir tetap ditampilkan.
- Status kehadiran tetap DI LUAR.

9.8 Izin Lokasi Diberikan Kembali

Jika izin lokasi diberikan kembali:

- Tracking kembali aktif secara otomatis.
- GPS melanjutkan pengiriman setiap 30 detik.
- Tidak diperlukan scan ulang.
- Tidak diperlukan aktivasi manual.

9.9 Data GPS

GPS hanya menyimpan satu lokasi terbaru per personel.

Setiap update lokasi menggantikan lokasi sebelumnya.

Data:

- Latitude.
- Longitude.
- Waktu update terakhir.
- Status GPS.

Tidak ada GPS route history.

Tidak ada penyimpanan jalur perjalanan atau kumpulan titik GPS historis.

9.10 GPS Dashboard

GPS hanya dapat dilihat oleh:

- Super Admin.
- Komandan.

Dashboard menampilkan:

- Peta.
- Nama.
- NRP.
- Pangkat.
- Jabatan.
- Status GPS.
- Lokasi terakhir.
- Waktu update terakhir.

---

10. MODULE 5 — RIWAYAT & LAPORAN

10.1 Riwayat Aktivitas

Riwayat aktivitas tersedia untuk:

- Super Admin.
- Komandan.

Personel hanya dapat melihat riwayat aktivitas pribadi.

Persit tidak dapat melihat riwayat aktivitas.

10.2 Data Riwayat

Field| Keterangan
Nama| Nama personel
NRP| NRP personel
Gate| Gate transaksi
Waktu keluar| Waktu transaksi keluar
Waktu kembali| Waktu transaksi kembali
Tujuan| Tujuan aktivitas
Keperluan| Keperluan aktivitas
Total durasi| Durasi personel di luar
Status aktivitas| AKTIF atau SELESAI

GPS lokasi terakhir tidak dimasukkan ke riwayat aktivitas.

10.3 Status Aktivitas

Status| Keterangan
AKTIF| Personel telah keluar dan belum kembali
SELESAI| Personel telah kembali

10.4 Aktivitas AKTIF

Jika personel belum kembali:

- Aktivitas ditampilkan.
- Status aktivitas AKTIF.
- Waktu kembali kosong.
- Total durasi tidak dihitung sebelum transaksi kembali.

10.5 Aktivitas SELESAI

Setelah transaksi kembali:

- Waktu kembali disimpan.
- Status menjadi SELESAI.
- Total durasi dihitung.
- Aktivitas disimpan sebagai riwayat.

10.6 Filter Riwayat

Filter yang tersedia:

- Tanggal.
- Nama personel.
- NRP.
- Gate.
- Tujuan.
- Status aktivitas AKTIF/SELESAI.

10.7 Pengurutan Riwayat

Default:

Aktivitas terbaru di bagian paling atas.

Descending.

10.8 Penyimpanan Riwayat

- Riwayat tidak dihapus otomatis.
- Riwayat disimpan tanpa batas waktu selama sistem berjalan.
- Penghapusan personel secara permanen juga menghapus riwayat terkait sesuai keputusan penghapusan personel.

---

11. LAPORAN PDF

11.1 Hak Akses

Laporan PDF hanya dapat dibuat dan diunduh oleh:

- Super Admin.
- Komandan.

11.2 Format

Format laporan:

PDF.

Tidak tersedia ekspor Excel atau CSV.

11.3 Isi Laporan

Laporan PDF mencakup:

Data Aktivitas

- Nama.
- NRP.
- Gate.
- Waktu keluar.
- Waktu kembali.
- Tujuan.
- Keperluan.
- Total durasi.
- Status aktivitas.

Statistik

- Jumlah personel DI DALAM.
- Jumlah personel DI LUAR.

Grafik

Grafik aktivitas keluar dan kembali.

11.4 Periode Laporan

Pemilihan periode laporan belum ditetapkan.

11.5 Layout PDF

Detail layout PDF, header, footer, format halaman, dan identitas laporan belum ditetapkan.

---

12. MODULE 6 — MODE KELUARGA/PERSIT

12.1 Registrasi Persit

Persit dapat melakukan registrasi mandiri.

Field registrasi:

Field| Keterangan
NRP| NRP personel yang akan ditautkan
Nama| Nama Persit
Username| Username login
Password| Password login

12.2 Proses Pengaitan

1. Persit membuka halaman registrasi.
2. Persit mengisi NRP.
3. Persit mengisi nama.
4. Persit mengisi username.
5. Persit mengisi password.
6. Persit mengirim registrasi.
7. Sistem mencatat permintaan pengaitan.
8. Super Admin melakukan verifikasi.
9. Jika disetujui, akun Persit terhubung dengan personel.
10. Persit dapat melihat data personel yang terhubung.

12.3 Verifikasi Persit

Verifikasi dilakukan oleh Super Admin.

Super Admin dapat memverifikasi permintaan pengaitan.

Detail penolakan, pembatalan, dan perubahan permintaan pengaitan belum ditetapkan.

12.4 Dashboard Persit

Dashboard Persit menampilkan identitas personel yang terhubung.

Field| Keterangan
NRP| NRP personel
Nama| Nama personel
Pangkat| Pangkat personel
Jabatan| Jabatan personel
Status| DI DALAM atau DI LUAR

Persit hanya dapat melihat status kehadiran dan identitas yang ditetapkan.

Persit tidak dapat melihat:

- GPS.
- Lokasi terakhir.
- Tujuan.
- Keperluan.
- Waktu keluar.
- Waktu kembali.
- Riwayat aktivitas.

---

13. MODULE 7 — PENGELOLAAN GATE & QR CODE

Area pengelolaan gate berada dalam area Super Admin.

13.1 Data Gate

Field gate:

Field| Keterangan
Nama gate| Nama gate
Lokasi gate| Lokasi gate
Status gate| AKTIF atau NONAKTIF

13.2 Pengelolaan Gate

Super Admin dapat:

- Membuat gate.
- Mengelola data gate.
- Mengubah nama gate.
- Mengubah lokasi gate.
- Mengubah status gate.

Detail penghapusan gate belum ditetapkan.

13.3 QR Code Gate

- Setiap gate memiliki QR Code masing-masing.
- QR Code bersifat tetap.
- QR Code tidak berubah selama gate masih aktif.
- QR Code dikelola oleh Super Admin.
- QR Code gate NONAKTIF tidak dapat digunakan.

13.4 Identifikasi Gate

QR Code digunakan untuk mengidentifikasi gate tempat transaksi berlangsung.

Sistem tidak meminta personel memasukkan gate secara manual.

---

14. MODULE 8 — ACCOUNT MANAGEMENT

Pengelolaan akun berada di area Super Admin.

14.1 Akun Super Admin

Field:

Field
Nama
Username
Password

Super Admin dapat mengelola akun Super Admin.

14.2 Akun Komandan

Field:

Field
NRP
Nama
Pangkat
Jabatan
Username
Password

14.3 Akun Personel

Field:

Field
NRP
Nama
Pangkat
Jabatan
Username
Password

14.4 Akun Persit

Field:

Field
NRP
Nama
Username
Password

Persit melakukan registrasi mandiri.

Pengaitan dengan personel tetap membutuhkan verifikasi Super Admin.

14.5 Aturan Username

- Username wajib unik.
- Username tidak boleh sama dengan username akun lain.
- Keunikan berlaku lintas role.
- Sistem menolak username yang sudah digunakan.

14.6 Aturan Password

- Password bebas.
- Tidak ada aturan minimum panjang.
- Tidak ada kombinasi huruf, angka atau simbol yang diwajibkan.

14.7 Perubahan Password

Semua role dapat mengubah password sendiri.

14.8 Reset Password

Reset password dilakukan oleh Super Admin.

Proses:

1. Super Admin memilih akun.
2. Super Admin melakukan reset password.
3. Sistem menghasilkan password sementara otomatis.
4. Super Admin memberikan password sementara kepada pengguna.
5. Pengguna login menggunakan password sementara.
6. Pengguna wajib mengganti password sebelum masuk dashboard.

---

15. NOTIFIKASI

Tidak ada notifikasi untuk transaksi keluar maupun kembali.

Transaksi keluar dan kembali hanya menghasilkan pembaruan data pada sistem dan dashboard.

Tidak ada notifikasi keluar-masuk yang dikirim kepada pengguna.

---

16. DATA MODEL — KONSEPTUAL

Data model berikut merupakan struktur konseptual untuk kebutuhan sistem. Struktur database fisik belum ditetapkan.

16.1 Users

Field| Keterangan
User ID| Identifier akun
Role| Super Admin, Komandan, Personel, Persit
Username| Username unik
Password| Kredensial login
Account status| Status akun
Created at| Waktu pembuatan akun

16.2 Personnel

Field| Keterangan
Personnel ID| Identifier personel
NRP| NRP
Nama| Nama
Pangkat| Pangkat
Jabatan| Jabatan
Presence status| DI DALAM atau DI LUAR

16.3 Gates

Field| Keterangan
Gate ID| Identifier gate
Nama gate| Nama gate
Lokasi gate| Lokasi gate
Status gate| AKTIF atau NONAKTIF
QR reference| Referensi QR Code

16.4 Activities

Field| Keterangan
Activity ID| Identifier aktivitas
Personnel ID| Referensi personel
Gate ID| Gate keluar
Exit time| Waktu keluar
Return time| Waktu kembali
Tujuan| Tujuan
Keperluan| Keperluan
Duration| Total durasi
Activity status| AKTIF atau SELESAI

16.5 GPS Latest Location

Field| Keterangan
Personnel ID| Referensi personel
Latitude| Latitude
Longitude| Longitude
Last updated| Waktu update terakhir
GPS status| Status tracking

GPS hanya menyimpan lokasi terakhir.

16.6 Persit Link

Field| Keterangan
Persit user ID| Referensi akun Persit
Personnel ID| Referensi personel yang ditautkan setelah verifikasi
Linked personnel ID| Relasi akun Persit ke akun Personel; hanya diisi untuk pengaitan yang telah disetujui
Link status| Status pengaitan
Verification| Verifikasi Super Admin

---

17. SYSTEM STATES

17.1 Presence State

DI DALAM → DI LUAR → DI DALAM.

17.2 Activity State

AKTIF → SELESAI.

17.3 GPS State

GPS dapat memiliki status:

- AKTIF.
- OFFLINE.
- TIDAK AKTIF.

Untuk lokasi terakhir yang pernah diterima, status dihitung dari umur timestamp: AKTIF sampai dengan 60 detik (inklusif) sejak pembaruan terakhir; OFFLINE jika lebih dari 60 detik. Status GPS tidak menentukan presence status. Makna dan kondisi status TIDAK AKTIF masih menunggu keputusan Owner.

17.4 Gate State

- AKTIF.
- NONAKTIF.

Gate NONAKTIF menolak transaksi.

---

18. END-TO-END FLOW

18.1 Personel Keluar

Login → Dashboard Personel → Status DI DALAM → Scan QR → Form Tujuan & Keperluan → Kamera → Scan Gate QR → Validasi Gate → Transaksi berhasil → Status DI LUAR → Aktivitas AKTIF → GPS tracking aktif → Dashboard diperbarui.

18.2 Personel Kembali

Login → Dashboard Personel → Status DI LUAR → Scan QR → Kamera → Scan Gate QR → Validasi Gate → Transaksi berhasil → Status DI DALAM → Aktivitas SELESAI → GPS berhenti → Durasi dihitung → Dashboard diperbarui.

18.3 Persit Registrasi

Registrasi → NRP → Nama → Username → Password → Permintaan pengaitan → Verifikasi Super Admin → Pengaitan berhasil → Dashboard Persit.

18.4 Reset Password

Super Admin → Pilih akun → Reset password → Password sementara dihasilkan → Pengguna login → Wajib mengganti password → Dashboard.

---

19. UI PAGE STRUCTURE

19.1 Super Admin

- Dashboard.
- Data Personel.
- Detail Personel.
- Tambah Personel.
- Edit Personel.
- GPS Tracking.
- Riwayat Aktivitas.
- Laporan PDF.
- Pengelolaan Gate.
- Detail Gate.
- Pengelolaan QR.
- Account Management.
- Verifikasi Persit.
- Pengaturan akun sendiri.
- Ubah password.

19.2 Komandan

- Dashboard Komando.
- Data Personel.
- GPS Tracking.
- Riwayat Aktivitas.
- Laporan PDF.
- Pengaturan akun sendiri.
- Ubah password.

19.3 Personel

- Dashboard Personel.
- Form Keluar.
- Scan QR.
- Riwayat Aktivitas Pribadi.
- Detail Aktivitas Pribadi.
- Pengaturan akun sendiri.
- Ubah password.

19.4 Persit

- Registrasi.
- Login.
- Dashboard Persit.
- Pengaturan akun sendiri.
- Ubah password.

---

20. FUNCTIONAL REQUIREMENTS

ID| Requirement
FR-01| Sistem menyediakan autentikasi login
FR-02| Sistem memiliki empat role
FR-03| Sistem membatasi akses berdasarkan role
FR-04| Sistem menampilkan dashboard sesuai role
FR-05| Super Admin dapat mengelola personel
FR-06| Super Admin dapat menghapus personel permanen
FR-07| Sistem menyediakan scan QR
FR-08| Sistem menentukan transaksi berdasarkan status kehadiran
FR-09| Form keluar wajib diisi sebelum kamera dibuka
FR-10| Transaksi kembali tidak memerlukan form
FR-11| QR Code mengidentifikasi gate
FR-12| Gate NONAKTIF menolak transaksi
FR-13| Transaksi keluar mencatat waktu keluar
FR-14| Transaksi kembali mencatat waktu kembali
FR-15| Sistem menghitung durasi setelah personel kembali
FR-16| Sistem mengaktifkan GPS setelah keluar berhasil
FR-17| Sistem menghentikan GPS setelah kembali berhasil
FR-18| Sistem mengirim GPS setiap 30 detik selama tracking berjalan
FR-19| Sistem menyimpan satu lokasi GPS terbaru
FR-20| Sistem menampilkan GPS status
FR-21| Sistem menampilkan OFFLINE jika tidak ada pembaruan lokasi selama lebih dari 60 detik sejak gpsUpdatedAt terakhir
FR-22| Sistem memulihkan tracking secara otomatis saat koneksi pulih
FR-23| Sistem menyediakan riwayat aktivitas
FR-24| Sistem menyediakan filter riwayat
FR-25| Sistem mengurutkan riwayat terbaru terlebih dahulu
FR-26| Sistem menyimpan riwayat tanpa penghapusan otomatis
FR-27| Sistem menyediakan laporan PDF
FR-28| Sistem menyediakan registrasi Persit
FR-29| Sistem menyediakan verifikasi Persit oleh Super Admin
FR-30| Persit hanya melihat identitas dan status personel terkait
FR-31| Username harus unik
FR-32| Semua role dapat mengubah password sendiri
FR-33| Super Admin dapat reset password
FR-34| Reset password menghasilkan password sementara
FR-35| Pengguna wajib mengganti password sementara
FR-36| Sistem tidak mengirim notifikasi transaksi keluar dan kembali

---

21. ACCEPTANCE CRITERIA

21.1 Exit

- Personel berstatus DI DALAM.
- Form tujuan dan keperluan harus lengkap.
- Kamera tidak dapat dibuka sebelum form lengkap.
- QR gate AKTIF dapat diproses.
- Transaksi berhasil mengubah status menjadi DI LUAR.
- Aktivitas menjadi AKTIF.
- GPS tracking diaktifkan.

21.2 Return

- Personel berstatus DI LUAR.
- Kamera dapat langsung dibuka.
- Tidak ada form kembali.
- QR gate AKTIF dapat diproses.
- Status menjadi DI DALAM.
- Aktivitas menjadi SELESAI.
- Durasi dihitung.
- GPS dihentikan.

21.3 GPS

- GPS aktif setelah keluar berhasil.
- GPS update setiap 30 detik.
- GPS menyimpan satu lokasi terbaru.
- GPS berstatus AKTIF jika lokasi terakhir diperbarui dalam 60 detik terakhir (termasuk tepat 60 detik).
- GPS berstatus OFFLINE jika lokasi terakhir tidak diperbarui selama lebih dari 60 detik.
- Status dihitung dari waktu pembaruan terakhir; pembaruan lokasi baru mengembalikan status menjadi AKTIF.
- GPS tidak wajib berjalan saat browser ditutup.
- GPS tidak mengubah status kehadiran.

21.4 Gate

- Gate memiliki nama, lokasi dan status.
- Gate AKTIF dapat digunakan.
- Gate NONAKTIF tidak dapat digunakan.
- Setiap gate memiliki QR Code sendiri.

21.5 Persit

- Persit dapat registrasi mandiri.
- Persit dapat mengajukan pengaitan berdasarkan NRP.
- Super Admin dapat melakukan verifikasi.
- Persit hanya melihat identitas dan status personel yang terhubung.

21.6 Riwayat

- Riwayat mencatat seluruh field yang ditetapkan.
- Aktivitas AKTIF memiliki waktu kembali kosong.
- Durasi aktivitas AKTIF belum dihitung.
- Aktivitas SELESAI memiliki waktu kembali dan durasi.
- Filter riwayat tersedia.
- Riwayat terbaru ditampilkan paling atas.

21.7 Account Management

- Username unik.
- Password tidak memiliki aturan minimum.
- Semua role dapat mengubah password sendiri.
- Super Admin dapat reset password.
- Password sementara dihasilkan otomatis.
- Pengguna wajib mengganti password sementara sebelum masuk dashboard.

---

22. NON-FUNCTIONAL REQUIREMENTS

Ketentuan berikut merupakan kebutuhan non-fungsional yang perlu menjadi perhatian implementasi. Nilai teknis dan target kuantitatif belum ditetapkan.

22.1 Security

- Autentikasi pengguna.
- Role-based access control.
- Pembatasan akses data sesuai role.
- Proteksi terhadap akses data yang tidak diizinkan.
- Keamanan penyimpanan kredensial.

22.2 Performance

- Dashboard dapat memuat data operasional.
- Pembaruan GPS dapat diproses sesuai interval.
- Scan QR dapat memproses transaksi.
- Riwayat dapat difilter.

Target waktu respons belum ditetapkan.

22.3 Reliability

- Sistem harus mempertahankan data transaksi yang berhasil.
- Sistem harus menampilkan kondisi tracking sesuai data yang tersedia.
- Sistem harus mempertahankan status kehadiran ketika GPS mengalami gangguan.

22.4 Compatibility

Sistem berbasis web.

Daftar browser, versi browser, dan perangkat yang didukung belum ditetapkan.

22.5 Data Integrity

- Status kehadiran.
- Status aktivitas.
- Waktu keluar.
- Waktu kembali.
- Gate transaksi.
- Tujuan.
- Keperluan.
- GPS latest location.

Data tersebut harus disimpan dan ditampilkan sesuai hasil transaksi sistem.

---

23. OUT OF SCOPE

Fitur berikut tidak termasuk dalam ketentuan yang telah ditetapkan:

- Pengajuan izin keluar.
- Persetujuan izin keluar.
- Notifikasi keluar.
- Notifikasi kembali.
- GPS route history.
- Penyimpanan kumpulan titik GPS historis.
- GPS untuk Persit.
- GPS untuk Personel sebagai pengguna dashboard.
- Riwayat personel lain untuk Personel.
- Riwayat untuk Persit.
- Ekspor Excel.
- Ekspor CSV.
- Pengelompokan personel berdasarkan unit.
- Status kehadiran tambahan selain DI DALAM dan DI LUAR.
- Tracking wajib ketika browser ditutup.

---

24. DECISION REGISTER

No.| Keputusan| Status
1| Nama GATEOPS| Diputuskan
2| Platform web| Diputuskan
3| Apple Style, Light Mode, Sidebar| Diputuskan
4| Empat role| Diputuskan
5| Enam modul utama| Diputuskan
6| Tidak ada pengajuan izin| Diputuskan
7| Form keluar dua field| Diputuskan
8| QR scan login| Diputuskan
9| QR per gate| Diputuskan
10| Transaksi otomatis berdasarkan status| Diputuskan
11| Exit mengaktifkan GPS| Diputuskan
12| Return menghentikan GPS| Diputuskan
13| GPS interval 30 detik| Diputuskan
14| GPS hanya Super Admin dan Komandan| Diputuskan
15| GPS latest location only| Diputuskan
16| Persit verifikasi Super Admin| Diputuskan
17| Tidak ada notifikasi keluar/kembali| Diputuskan
18| Status DI DALAM/DI LUAR| Diputuskan
19| Aktivitas AKTIF/SELESAI| Diputuskan
20| Riwayat filter| Diputuskan
21| PDF saja| Diputuskan
22| Super Admin dan Komandan dapat PDF| Diputuskan
23| Tidak ada pengelompokan unit| Diputuskan
24| Field personel| Diputuskan
25| Field Komandan| Diputuskan
26| Field Super Admin| Diputuskan
27| Field Persit| Diputuskan
28| Username unik| Diputuskan
29| Password tanpa aturan minimum| Diputuskan
30| Semua role dapat ubah password| Diputuskan
31| Reset password oleh Super Admin| Diputuskan
32| Password sementara otomatis| Diputuskan
33| Wajib mengganti password sementara| Diputuskan
34| QR Code tetap| Diputuskan
35| Scan berulang diproses berdasarkan status terbaru| Diputuskan
36| Scan bersamaan diproses berdasarkan status yang dibaca| Diputuskan
37| Tracking tidak wajib saat browser ditutup| Diputuskan
38| Offline ditampilkan di dashboard tracking| Diputuskan
39| GPS pulih otomatis saat koneksi pulih| Diputuskan
40| GPS offline saat izin lokasi dicabut| Diputuskan
41| GPS otomatis pulih saat izin diberikan kembali| Diputuskan
42| Zona waktu mengikuti perangkat| Diputuskan
43| Format tanggal: 25 November 2026, 17:40| Diputuskan
44| Riwayat terbaru paling atas| Diputuskan
45| Riwayat tanpa penghapusan otomatis| Diputuskan
46| Penghapusan personel juga menghapus akun login Personel, akun Persit terverifikasi yang terhubung, sesi terkait, dan riwayat aktivitas secara atomik| Diputuskan oleh Owner
47| Payload QR Gate berisi token acak rahasia mentah saja, tanpa URL, ID Gate, atau metadata tambahan| Diputuskan oleh Owner
48| Setiap Gate baru mendapat token acak kriptografis 256-bit yang unik; database hanya menyimpan SHA-256 hash dan token mentah hanya diberikan satu kali saat pembuatan oleh Super Admin| Diputuskan oleh Owner
49| Validasi token QR dilakukan di server dengan perbandingan constant-time dan hanya Gate berstatus AKTIF yang valid| Diputuskan oleh Owner
50| Pemindaian QR wajib online; jika koneksi terputus saat pemindaian, transaksi langsung ditolak tanpa antrean offline/pemrosesan tertunda dan Personel harus memindai ulang setelah koneksi pulih| Diputuskan oleh Owner
51| Pesan untuk QR Gate tidak valid atau tidak dikenal: “QR Gate tidak valid atau tidak dikenal. silahkan pindai lagi”| Diputuskan oleh Owner
52| Jika QR Gate tidak valid/tidak dikenal, status kehadiran dan aktivitas Personel tidak berubah; kamera scanner tetap aktif agar Personel dapat langsung memindai ulang| Diputuskan oleh Owner
53| Jika sesi login Personel berakhir ketika pemindaian berlangsung, transaksi langsung ditolak tanpa mengubah status kehadiran/aktivitas; kamera scanner dihentikan dan Personel wajib login kembali sebelum memindai ulang| Diputuskan oleh Owner
54| Hanya satu request transaksi QR yang boleh diproses pada satu waktu untuk Personel yang sama; request lain yang datang saat transaksi pertama masih berlangsung langsung ditolak tanpa retry otomatis atau pemrosesan tertunda, dan tidak mengubah status kehadiran/aktivitas maupun membuat transaksi tambahan| Diputuskan oleh Owner
55| Jika penyimpanan transaksi QR gagal, seluruh perubahan transaksi dibatalkan secara atomik; status kehadiran dan aktivitas tetap seperti sebelum request, tidak ada data transaksi parsial, Personel menerima pesan kegagalan dan harus melakukan scan ulang secara manual setelah siap tanpa retry otomatis atau antrean| Diputuskan oleh Owner
56| Jika kamera gagal dibuka, izin kamera ditolak, atau QR tidak dapat terbaca, sistem tidak membuat transaksi dan tidak mengubah status kehadiran maupun aktivitas; sistem menampilkan pesan kesalahan yang menjelaskan masalah dan menyediakan opsi untuk mencoba membuka kamera kembali setelah masalah diperbaiki| Diputuskan oleh Owner
57| GPS berstatus OFFLINE jika tidak ada pembaruan lokasi selama lebih dari 60 detik sejak gpsUpdatedAt terakhir; sampai dengan 60 detik (inklusif) tetap AKTIF; interval pengiriman tetap 30 detik| Diputuskan oleh Owner
58| Platform target: Vercel untuk hosting aplikasi web Next.js dan Supabase untuk PostgreSQL terkelola| Diputuskan oleh Owner
59| Backend business API menggunakan Supabase Edge Functions; frontend web menggunakan Next.js di Vercel| Diputuskan oleh Owner

---

25. ITEMS NOT YET DEFINED

Bagian ini bukan keputusan baru. Ini adalah daftar detail yang belum ditetapkan dalam pembahasan dan tidak boleh dianggap sebagai keputusan final.

25.1 PDF

- Pemilihan periode laporan.
- Layout PDF.
- Header dan footer.
- Format halaman.
- Detail grafik.

25.2 Account Management

- Status akun dan mekanisme deaktivasi akun.
- Detail penghapusan akun selain penghapusan personel.


25.3 Persit

- NRP tidak ditemukan.
- NRP sudah terhubung.
- Permintaan pengaitan ditolak.
- Perubahan pengaitan.
- Penghapusan pengaitan.

25.4 Gate

- Penghapusan gate.
- Mekanisme regenerasi QR.
- Penerbitan kredensial QR untuk Gate yang sudah ada sebelum fitur kredensial diterapkan.

25.5 Transaction Processing


25.6 GPS

- Penanganan GPS yang tidak memberikan data.
- Definisi dan kondisi penggunaan status TIDAK AKTIF.
- Penanganan browser yang membatasi GPS.
- Penanganan GPS saat sesi login berakhir.
- Penanganan GPS ketika personel kembali tetapi transaksi gagal.

25.7 UI

- Empty states.
- Error states.
- Loading states.
- Confirmation dialog.
- Pagination.
- Detail tampilan tabel.
- Detail tampilan mobile.
- Detail halaman login.
- Detail halaman scan.
- Detail halaman riwayat.
- Detail halaman pengelolaan akun.

25.8 Technical Architecture

**Sudah ditetapkan oleh Owner:**
- Decision #58: Vercel untuk hosting frontend web Next.js dan Supabase sebagai platform database PostgreSQL terkelola.
- Decision #59: Backend business API menggunakan Supabase Edge Functions.
- Frontend web menggunakan Next.js App Router.

**Baseline repository saat ini (belum seluruhnya dimigrasikan):**
- Framework: Next.js 16 App Router.
- API yang berjalan saat ini masih menggunakan Next.js App Router Route Handlers.
- Database development dan CI menggunakan PostgreSQL; data access dan migrasi saat ini menggunakan Prisma 7.
- Autentikasi saat ini menggunakan username/password dan opaque application session berbasis cookie HttpOnly serta session record di database.

**Kontrak arsitektur target:**
- Next.js di Vercel bertanggung jawab atas UI dan frontend delivery.
- Supabase Edge Functions bertanggung jawab atas business API dan validasi request server-side.
- Next.js Route Handlers hanya dipertahankan sebagai BFF/proxy bila dibutuhkan untuk meneruskan cookie session HttpOnly ke Edge Functions; business rules tidak boleh diduplikasi di BFF.
- Autentikasi username/password dan sesi aplikasi yang sudah ada harus tetap berfungsi selama migrasi. Supabase Auth tidak otomatis menggantikan autentikasi aplikasi.
- Setiap Edge Function wajib memvalidasi sesi aplikasi, status akun, role, permission, dan cakupan data sebelum operasi sensitif. Validasi JWT gateway saja tidak menggantikan otorisasi aplikasi.
- Secret/service-role key hanya berada di server/Edge Functions dan tidak boleh diekspos ke browser.
- Operasi bisnis yang membutuhkan beberapa perubahan data harus tetap atomik; gunakan transaksi PostgreSQL/RPC yang teruji bila pola akses Edge Functions tidak menyediakan transaksi multi-statement.
- Route Handlers lama tidak boleh dihapus sebelum semua pemanggil, kontrak respons, dan E2E dialihkan dan lolos verifikasi.

**Masih PENDING_OWNER_DECISION / perlu desain teknis sebelum implementasi:**
- Apakah Supabase Auth akan digunakan sebagai identity provider tambahan/pengganti (perubahan ini memerlukan keputusan Owner dan rencana migrasi akun/sesi).
- Strategi RLS dan relasi identitas sesi aplikasi dengan kebijakan database.
- Detail BFF/proxy, format credential antar Vercel dan Edge Functions, dan proteksi pemanggilan service-to-service.
- Data access Edge Functions: PostgREST/supabase-js, direct PostgreSQL, atau kombinasi; termasuk strategi migrasi Prisma.
- Pembagian fungsi per domain, API contract/versioning, CORS, rate limiting, dan idempotency.
- Infrastruktur koneksi database, pooling, dan jaringan.
- Logging terpusat, error tracking, dan monitoring.
- Backup, retensi, point-in-time recovery, dan disaster recovery.
- Environment development/staging/production, strategi deployment, migrasi production, dan rollback.
- Target performa, kapasitas, dan ketersediaan sistem.

---

26. PRODUCT SUMMARY

GATEOPS adalah sistem pemantauan kehadiran dan pergerakan personel berbasis web yang menggunakan QR Code per gate untuk transaksi keluar dan kembali, GPS tracking untuk personel yang berada di luar, dashboard operasional untuk Super Admin dan Komandan, riwayat aktivitas serta laporan PDF.

Sistem memiliki empat role:

- Super Admin.
- Komandan.
- Personel.
- Persit.

Sistem mengutamakan pencatatan transaksi yang terstruktur, status kehadiran yang jelas, pemantauan lokasi terakhir, pembatasan akses berdasarkan role, dan pengelolaan data operasional.
