# PRD: PPPoE Manager (Frontend Only)

**Versi:** 0.2
**Status:** Draft — untuk vibe coding
**Scope tahap ini:** Frontend saja (Next.js + shadcn/ui), data via mock/local state, kontrak API disiapkan untuk integrasi backend FreeRADIUS di tahap berikutnya.

**Perubahan dari v0.1:** Istilah "user" sebelumnya bentrok — dipakai untuk dua hal berbeda (pelanggan PPPoE & pengguna aplikasi/admin). Di versi ini:
- **Customer** = pelanggan PPPoE (yang dulu disebut "user" di v0.1).
- **App User** = pengguna yang login ke dashboard (admin/operator), route `/users` sekarang khusus untuk ini.

---

## 1. Latar Belakang

Aplikasi internal untuk mengelola pelanggan PPPoE (mirip MixRadius tapi disederhanakan — hanya PPPoE, tanpa Hotspot/voucher). Backend nantinya akan berbasis **FreeRADIUS** dengan skema standar (`radcheck`, `radreply`, `radacct`, `nas`), tapi tahap ini hanya membangun **frontend**-nya dulu: UI untuk menambah/mengelola pelanggan PPPoE dan memonitor statistik pemakaian mereka.

Karena backend belum ada, semua data di tahap ini didekati dengan **mock data + TypeScript types** yang strukturnya sengaja dibuat 1:1 mendekati kolom-kolom RADIUS (`radcheck`, `radreply`, `radacct`, `nas`) supaya saat backend jadi, tinggal ganti data source dari mock ke fetch API tanpa ubah struktur komponen.

## 2. Tujuan

- Admin bisa menambah, mengedit, menonaktifkan, dan menghapus akun pelanggan PPPoE (**Customer**).
- Admin bisa memantau siapa saja yang sedang online (sesi aktif) secara real-time (polling).
- Admin bisa melihat statistik pemakaian data & durasi per customer (histori sesi).
- Admin bisa mengelola "profile"/paket (bandwidth plan) yang dipasang ke customer.
- Admin bisa mengelola daftar NAS (router MikroTik) yang terdaftar.
- Ada manajemen **App User** (pengguna dashboard/admin) terpisah dari data Customer — minimal CRUD dasar + role.
- Dashboard ringkas: total customer, customer aktif sekarang, total bandwidth terpakai, dsb.

## 3. Non-Goals (Bukan Cakupan Tahap Ini)

- Tidak ada Hotspot/voucher.
- Tidak ada billing/invoice/payment gateway.
- Tidak ada backend/API nyata — semua data mock, siap diganti nanti.
- Tidak ada sistem permission granular per role — App User cukup dibedakan `admin` vs `operator` tanpa matrix permission detail dulu.
- Tidak ada CoA/Disconnect-Request actual (tombol "Putuskan Koneksi" ada di UI tapi memanggil fungsi mock).

## 4. Tech Stack

- **Framework:** Next.js (App Router, kerangka sudah disiapkan user)
- **UI:** shadcn/ui + Tailwind
- **Bahasa:** TypeScript
- **State:** React state / TanStack Query (untuk simulasi fetching, mempermudah swap ke API asli nanti)
- **Charts:** `recharts` (untuk grafik statistik pemakaian)
- **Table:** `@tanstack/react-table` (dipakai di balik shadcn `DataTable` pattern)
- **Form & Validasi:** `react-hook-form` + `zod`
- **Icons:** `lucide-react`

## 5. Persona

- **App User (Admin/Operator)** — teknisi/pemilik ISP kecil (RT/RW Net / mini ISP) yang login ke dashboard untuk mengelola pelanggan PPPoE lewat satu atau beberapa router MikroTik. Butuh UI cepat, ringkas, jelas statusnya (online/offline), dan gampang cari customer tertentu.
- **Customer** — pelanggan PPPoE yang datanya dikelola lewat aplikasi ini. Customer tidak login ke aplikasi ini (bukan end-user portal, itu di luar scope).

---

## 6. Information Architecture (Struktur Halaman)

```
/                         → redirect ke /dashboard
/login                    → halaman login App User (mock auth)
/dashboard                → ringkasan statistik global

/customers                → daftar semua pelanggan PPPoE (table)
/customers/new             → form tambah customer
/customers/[id]            → detail customer (info + histori sesi + grafik pemakaian)
/customers/[id]/edit        → form edit customer

/sessions                 → daftar sesi aktif (real-time-ish, semua customer, semua router)

/profiles                 → daftar paket/profile bandwidth
/profiles/new             → form tambah profile
/profiles/[id]/edit       → form edit profile

/routers                  → daftar NAS (router MikroTik terdaftar)
/routers/new              → form tambah router
/routers/[id]/edit        → form edit router

/users                    → daftar App User (admin/operator dashboard)
/users/new                → form tambah App User
/users/[id]/edit          → form edit App User

/settings                 → pengaturan aplikasi (opsional, low priority)
```

**Layout:** Sidebar navigasi kiri (shadcn `Sidebar` / custom pakai `Sheet` untuk mobile) + topbar berisi judul halaman & user menu. Gunakan shadcn `Breadcrumb` di setiap halaman detail.

Catatan navigasi: `/users` (App User management) sebaiknya diletakkan di bagian bawah sidebar / grup terpisah "Pengaturan Sistem", supaya tidak tertukar secara visual dengan menu `/customers` yang jadi menu utama.

---

## 7. Data Model (TypeScript — dipakai sebagai kontrak mock & API nanti)

```ts
// Merepresentasikan gabungan radcheck + radreply + metadata tambahan
// Ini PELANGGAN PPPoE, bukan pengguna aplikasi.
interface Customer {
  id: string;
  username: string;              // radcheck.username (login PPPoE, bukan login dashboard)
  fullName?: string;              // metadata tambahan, bukan kolom radius asli
  phone?: string;
  address?: string;
  status: "active" | "suspended" | "disabled";
  profileId: string;              // relasi ke BandwidthProfile (menentukan radreply: Mikrotik-Rate-Limit)
  staticIp?: string;              // radreply: Framed-IP-Address (opsional)
  nasId?: string;                 // NAS default/terakhir dipakai (opsional, bisa multi)
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;            // dari radacct terakhir
  currentSessionId?: string;      // jika sedang online, id sesi aktif
}

// Merepresentasikan Profile/Plan bandwidth (jadi radgroupreply / radreply per customer)
interface BandwidthProfile {
  id: string;
  name: string;                   // mis. "Paket 10Mbps"
  rateLimitDown: number;          // dalam Mbps
  rateLimitUp: number;            // dalam Mbps
  description?: string;
  customerCount: number;          // jumlah customer yang pakai profile ini (derived)
}

// Merepresentasikan baris NAS
interface NasRouter {
  id: string;
  name: string;                   // shortname
  ipAddress: string;              // nasname
  location?: string;
  type: "mikrotik";
  status: "online" | "offline" | "unknown"; // dari polling API MikroTik (mock dulu)
  activeSessionCount: number;      // derived
}

// Merepresentasikan satu baris radacct (histori/sesi) milik seorang Customer
interface Session {
  id: string;
  customerId: string;
  customerUsername: string;
  nasId: string;
  nasIpAddress: string;
  framedIp?: string;
  startedAt: string;
  stoppedAt?: string;              // null/undefined = masih online
  durationSeconds: number;         // derived, live-update jika online
  inputBytes: number;              // AcctInputOctets (upload dari sisi customer)
  outputBytes: number;             // AcctOutputOctets (download dari sisi customer)
  terminateCause?: string;         // "User-Request" | "Idle-Timeout" | dst
}

// Pengguna aplikasi/dashboard (BUKAN pelanggan PPPoE)
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator";
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt?: string;
}

// Ringkasan untuk dashboard
interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  onlineNow: number;
  totalRoutersOnline: number;
  totalRoutersOffline: number;
  totalTrafficTodayBytes: number;
  usageTrend: { date: string; bytes: number }[]; // untuk chart 7/30 hari
}
```

> Catatan: struktur `Session` sengaja memisahkan `inputBytes`/`outputBytes` mengikuti konvensi RADIUS accounting agar tidak perlu remapping besar saat sambung ke backend asli.

---

## 8. Kebutuhan Fitur per Halaman

### 8.1 `/dashboard`
- Cards ringkasan (shadcn `Card`): Total Customer, Customer Online, Customer Suspended, Router Online/Offline.
- Chart tren pemakaian bandwidth 7 hari terakhir (`recharts` Area/Line chart).
- Tabel ringkas "5 sesi aktif terbaru" dengan link ke `/sessions`.
- Tabel ringkas "customer baru ditambahkan" (opsional).

**Acceptance criteria:**
- Semua angka berasal dari `DashboardStats` mock, mudah diganti ke fetch API.
- Responsive: cards jadi grid 2 kolom di mobile, 4 kolom di desktop.

### 8.2 `/customers` (Daftar Pelanggan PPPoE)
- `DataTable` (shadcn + tanstack table) dengan kolom: Username, Nama, Profile, Status (badge), IP Statis, Terakhir Online, Aksi.
- Search by username/nama.
- Filter by status (active/suspended/disabled) dan by profile.
- Badge status pakai warna: hijau (active), kuning (suspended), abu (disabled).
- Kolom "Online" indikator titik hijau jika `currentSessionId` ada.
- Aksi per baris (dropdown `DropdownMenu`): Lihat Detail, Edit, Suspend/Aktifkan, Putuskan Koneksi (jika online), Hapus.
- Tombol "Tambah Customer" → `/customers/new`.
- Pagination di table.

### 8.3 `/customers/new` & `/customers/[id]/edit`
- Form pakai `react-hook-form` + `zod`, komponen shadcn `Form`.
- Field: Username PPPoE (required, unique-check mock), Password PPPoE (required saat create, optional saat edit — placeholder "kosongkan jika tidak diubah"), Nama Lengkap, No. HP, Alamat, Profile (Select dari daftar `BandwidthProfile`), IP Statis (opsional, validasi format IP), Status (Select).
- Validasi: username tidak boleh mengandung spasi, password minimal 6 karakter.
- Submit → toast sukses (`sonner`/shadcn toast) → redirect ke `/customers` atau `/customers/[id]`.

### 8.4 `/customers/[id]` (Detail Customer)
- Header: username + status badge + tombol aksi cepat (Edit, Suspend, Putuskan Koneksi).
- Section info: profile aktif, IP statis, tanggal dibuat, terakhir online.
- Section "Sesi Saat Ini" (jika online): durasi berjalan (live counter), data terpakai (live-updating dari mock interval), router yang dipakai.
- Section "Histori Sesi": tabel `Session[]` khusus customer ini, kolom: Tanggal, Durasi, Download, Upload, Router, Sebab Putus.
- Chart pemakaian data 30 hari terakhir untuk customer ini.

### 8.5 `/sessions` (Monitoring Sesi Aktif)
- Ini halaman monitoring utama — tabel semua sesi yang sedang `stoppedAt == null`.
- Kolom: Username Customer, Router (NAS), IP Framed, Mulai Sejak, Durasi (live), Download, Upload, Aksi (Putuskan Koneksi).
- Auto-refresh tiap beberapa detik (pakai `setInterval` + mock data generator, nanti diganti polling API/WebSocket).
- Filter by router (NAS).
- Total di header: "X customer online dari Y total customer".

### 8.6 `/profiles`
- Daftar `BandwidthProfile` dalam table/card: Nama, Rate Limit Down/Up, Jumlah Customer Terpasang.
- Tambah/Edit/Hapus profile (hapus diblokir jika masih ada customer yang pakai — tampilkan alert).

### 8.7 `/routers`
- Daftar `NasRouter`: Nama, IP, Lokasi, Status (badge online/offline), Jumlah Sesi Aktif.
- Tambah/Edit/Hapus router.
- Detail router (opsional tahap ini) bisa ditunda ke v2.

### 8.8 `/users` (App User — Pengguna Dashboard)
- `DataTable`: Nama, Email, Role (badge: admin/operator), Status, Terakhir Login, Aksi.
- Tambah/Edit/Hapus App User, ubah role, aktif/nonaktifkan.
- Ini terpisah total dari data `Customer` — jangan disatukan tabel/route-nya.

### 8.9 `/login`
- Form sederhana email/password, mock auth terhadap data `AppUser` (redirect ke `/dashboard` jika berhasil, tanpa validasi backend nyata — bisa hardcode kredensial demo).

---

## 9. Komponen shadcn yang Dipakai

`Card`, `Table` (via DataTable pattern), `Button`, `Badge`, `Input`, `Select`, `Form`, `Label`, `Dialog` (untuk konfirmasi hapus/putus koneksi), `DropdownMenu`, `Sheet` (sidebar mobile), `Breadcrumb`, `Tabs` (di halaman detail customer: Info / Histori / Statistik), `Skeleton` (loading state), `Toast`/`Sonner`, `Avatar` (opsional untuk user menu), `Separator`.

---

## 10. Kontrak API (Untuk Integrasi Backend Nanti — Tidak Diimplementasi Sekarang)

Frontend dibangun dengan asumsi endpoint berikut akan tersedia, supaya layer data-fetching (`lib/api/*.ts`) tinggal diarahkan ke URL asli:

```
GET    /api/dashboard/stats

GET    /api/customers?search=&status=&profileId=&page=
POST   /api/customers
GET    /api/customers/:id
PATCH  /api/customers/:id
DELETE /api/customers/:id
POST   /api/customers/:id/disconnect

GET    /api/sessions?active=true&nasId=
GET    /api/customers/:id/sessions

GET    /api/profiles
POST   /api/profiles
PATCH  /api/profiles/:id
DELETE /api/profiles/:id

GET    /api/routers
POST   /api/routers
PATCH  /api/routers/:id
DELETE /api/routers/:id

GET    /api/users            # App User (admin/operator), BUKAN customer
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id
```

**Prinsip desain layer data:** semua komponen page memanggil fungsi dari `lib/api/*.ts` (bukan mock langsung di komponen), sehingga saat backend siap, cukup ubah isi fungsi tersebut dari "return mock data" menjadi "fetch ke endpoint asli" tanpa menyentuh komponen UI.

---

## 11. Struktur Folder yang Disarankan

```
app/
  (auth)/login/page.tsx
  (dashboard)/
    dashboard/page.tsx
    customers/page.tsx
    customers/new/page.tsx
    customers/[id]/page.tsx
    customers/[id]/edit/page.tsx
    sessions/page.tsx
    profiles/page.tsx
    profiles/new/page.tsx
    profiles/[id]/edit/page.tsx
    routers/page.tsx
    routers/new/page.tsx
    routers/[id]/edit/page.tsx
    users/page.tsx              # App User management
    users/new/page.tsx
    users/[id]/edit/page.tsx
    layout.tsx                  # sidebar + topbar
components/
  ui/                            # shadcn generated components
  data-table/
  status-badge.tsx
  customer-form.tsx
  profile-form.tsx
  router-form.tsx
  app-user-form.tsx
  session-live-timer.tsx
  usage-chart.tsx
lib/
  api/
    customers.ts
    sessions.ts
    profiles.ts
    routers.ts
    users.ts                    # App User
    dashboard.ts
  mock/
    customers.mock.ts
    sessions.mock.ts
    profiles.mock.ts
    routers.mock.ts
    users.mock.ts                # App User
  types.ts                       # semua interface di section 7
```

---

## 12. Non-Functional Requirements

- Responsive (mobile-friendly, minimal untuk halaman dashboard & customers).
- Loading state pakai `Skeleton` di semua tabel/card saat "fetching" mock (simulasikan delay ~300-500ms biar pattern loading kebentuk dari awal).
- Empty state jelas (mis. "Belum ada customer, tambahkan sekarang" dengan CTA).
- Konsisten format angka: bytes ditampilkan human-readable (KB/MB/GB), durasi ditampilkan `HH:MM:SS` atau "2h 15m".
- Konfirmasi (`Dialog`) wajib untuk aksi destruktif: hapus customer/router/profile/app user, putuskan koneksi.

---

## 13. Fase Pengembangan (Urutan Disarankan untuk Vibe Coding)

1. Layout dasar (sidebar, topbar, routing) + login mock (pakai `AppUser`).
2. Types & mock data generators (section 7).
3. `/dashboard` (paling mudah divalidasi visual, cepat kelihatan progress).
4. `/customers` list + `/customers/new` + `/customers/[id]/edit` (CRUD inti).
5. `/customers/[id]` detail + histori sesi + chart.
6. `/sessions` (monitoring real-time-ish).
7. `/profiles` dan `/routers` (CRUD sekunder, pattern mirip customers).
8. `/users` (App User management — prioritas rendah, bisa paling akhir).
9. Polish: empty states, loading skeletons, toast, konfirmasi dialog.

---

## 14. Open Questions (Perlu Diputuskan Sebelum/Selama Coding)

- Apakah role `operator` di App User dibatasi aksinya (mis. tidak bisa hapus customer), atau punya akses penuh sama seperti `admin` di v1?
- Apakah IP statis per customer wajib diisi atau default dynamic pool?
- Interval "live update" sesi aktif di UI — berapa detik idealnya untuk simulasi (mis. 5 detik)?
- Apakah grafik statistik butuh breakdown per router, atau agregat saja cukup untuk v1?
