<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MicroRAD PPPoE Manager — Arsitektur & Spesifikasi Sistem

MicroRAD adalah sistem manajemen ISP / PPPoE terpadu full-stack yang mengintegrasikan **Next.js 16 App Router** (React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui + Biome), **PostgreSQL 16** via **Prisma ORM 7**, **Better-Auth** (dual-instance auth), **FreeRADIUS v3** (modul `rlm_sql` PostgreSQL), dan **MikroTik RouterOS** (protokol binari API + RADIUS CoA RFC 5176).

Dokumen ini adalah **sumber kebenaran tunggal** (Single Source of Truth) untuk arsitektur, skema database, logika bisnis, integrasi jaringan, kontrak REST API, RBAC, dan konvensi pengembangan aplikasi.

---

## 1. Topologi Infrastruktur & Alur Data

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Docker Compose Network (`microrad-net` 172.30.0.0/24)                                   │
│                                                                                         │
│  [microrad-postgres] (172.30.0.2:5432 / localhost:5432)                                 │
│    └─ DB `microrad`: Tabel Aplikasi + Tabel Shared FreeRADIUS (rlm_sql)                 │
│                                                                                         │
│  [microrad-freeradius] (172.30.0.3 / localhost:1812, 1813 UDP, 3799 UDP)                │
│    └─ Alpine FreeRADIUS 3.21 + driver postgresql                                        │
│       - `read_clients = yes` (baca client MikroTik dari tabel `nas`)                    │
│       - Baca `radcheck` (password/reject/bind-nas) & `radreply` (IP/QoS Rate-Limit)     │
│       - Tulis `radacct` (accounting sesi) & `radpostauth` (riwayat login auth)          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
        ▲                                                              ▲
        │ Prisma Client (SQL / TCP 5432)                               │ UDP 1812/1813 (AAA)
        ▼                                                              ▼
┌──────────────────────────────────────────────┐            ┌─────────────────────────────┐
│ Next.js 16 Backend & Web App (Host/Server)   │            │ MikroTik RouterOS           │
│  - REST API `/api/v1/*`                      │ API TCP    │ (PPPoE Server / NAS Client) │
│  - Better-Auth (App & Portal Instances)      ├───────────►│  - `/ppp/active/print`      │
│  - Background Poller (`instrumentation.ts`)  │ Port 8728  │  - `/system/identity/print` │
│  - Atomic `radsync` ke FreeRADIUS            │            │  - CoA Kick (UDP 3799)      │
└──────────────────────────────────────────────┘            └─────────────────────────────┘
```

### Siklus Alur Data PPPoE & Accounting
1. **Autentikasi PPPoE**: Pelanggan dial PPPoE ke MikroTik $\rightarrow$ MikroTik kirim `Access-Request` (port 1812 UDP) ke FreeRADIUS $\rightarrow$ FreeRADIUS membaca tabel `radcheck` (`Cleartext-Password`, `Auth-Type := Reject`, `NAS-IP-Address`) dan `radreply` (`Framed-IP-Address`, `Mikrotik-Rate-Limit`).
2. **Accounting Live (`radacct`)**: MikroTik mengirim paket `Acct-Status-Type` (`Start`, `Interim-Update` per 1 menit, `Stop`) ke FreeRADIUS (port 1813 UDP) $\rightarrow$ FreeRADIUS menulis langsung ke tabel `radacct`.
3. **Live Session & Traffic Stats**: Aplikasi membaca sesi aktif langsung dari tabel `radacct` (`acctStopTime IS NULL`), melakukan inflasi real-time durasi dan byte berdasarkan selisih waktu `acctUpdateTime`.
4. **Heartbeat Poller Router**: Poller background (`src/lib/mikrotik-sync.ts`) dijalankan via `src/instrumentation.ts` setiap 30 detik (`MIKROTIK_SYNC_INTERVAL_MS`), memverifikasi koneksi ping (ICMP / TCP fallback) ke router dan memperbarui status router (`online`/`offline`) secara otomatis tanpa mewajibkan kredensial API.
5. **Disconnect / Kick Session**: Admin memutuskan sesi melalui UI $\rightarrow$ aplikasi memicu Disconnect-Request RADIUS CoA (RFC 5176) ke port 3799 UDP atau fallback memanggil API RouterOS `/ppp/active/remove`.
6. **Sinkronisasi Atomik (`radsync`)**: Setiap mutasi pelanggan, profil bandwidth, dan router NAS di database dieksekusi bersamaan dengan pembaruan tabel FreeRADIUS (`radcheck`, `radreply`, `nas`) dalam satu transaksi database (`Prisma.TransactionClient`).

---

## 2. Arsitektur Autentikasi Ganda (Better-Auth)

Sistem menggunakan **dua instance Better-Auth** yang terisolasi untuk membedakan pengguna manajemen sistem dan pelanggan portal:

| Aspek | Instance #1: User Sistem (`auth`) | Instance #2: User Portal (`authPortal`) |
|---|---|---|
| **Rute Endpoint** | `/api/auth/*` | `/api/auth/portal/*` |
| **Konteks Pengguna** | Administrator & Operator NOC/Finance | Pelanggan Internet (Customer Self-Care) |
| **Model Database** | `AppUser`, `AppSession`, `AppAccount`, `AppVerification` | `PortalUser`, `PortalSession`, `PortalAccount`, `PortalVerification` |
| **Tabel DB** | `app_user`, `app_session`, `app_account`, `app_verification` | `portal_user`, `portal_session`, `portal_account`, `portal_verification` |
| **Prefix Cookie** | `microrad_app` | `microrad_portal` |
| **Identifier Login** | Email atau Username (plugin `username()`) | Email terdaftar pelanggan |
| **Relasi Domain** | `AppUser.roleId` $\rightarrow$ `Role` (RBAC) | `PortalUser.customerId` $\rightarrow$ `Customer.id` (1-to-1) |
| **Audit Hook** | Auto-insert `GlobalLog` (sumber: `"Aplikasi"`) | Auto-insert `PortalLoginLog` & `GlobalLog` (sumber: `"Portal Langganan"`) |
| **Client Hook** | `useAuth()` via `authClient` (`@/lib/auth-client`) | `usePortal()` via `PortalContext` (`@/lib/portal-context`) |
| **Status Guard** | Status `disabled` tidak dapat login manajemen | Status `disabled` diblokir dari login portal via `databaseHooks.session.create.before` & auto-invalidation sesi aktif |

---

## 3. Skema Basis Data & Model Prisma (`prisma/schema.prisma`)

Generator Prisma ORM 7 dikonfigurasi ke output `../src/generated/prisma` menggunakan driver adapter `@prisma/adapter-pg`.

### A. Tabel Domain Aplikasi

- **`Customer` (`customer`)**:
  - `id` (String PK, format `cust-<timestamp>`)
  - `username` (String Unique — login PPPoE / `radcheck.username`, case-insensitive di layer API, auto-generated unik format `user_<6-digit>`, jika diganti otomatis trigger `moveCustomerRadius` ke tabel RADIUS)
  - `password` (String? — password PPPoE dial-in, auto-generated 8 karakter)
  - `fullName`, `email`, `phone`, `address` (Metadata kontak pelanggan; `email` digunakan untuk pembuatan akun `PortalUser`)
  - `status` (`"active"` | `"suspended"` | `"disabled"`)
  - `profileId` (FK $\rightarrow$ `PppProfile.id` — Paket Layanan: Kecepatan & Tarif Bulanan)
  - `profileGroupId` (FK $\rightarrow$ `ProfileGroup.id` — Lokasi Node: Router NAS, Gateway & IP Pool)
  - `staticIp` (String? — IP statis pelanggan / `Framed-IP-Address`)
  - `nasId` (FK $\rightarrow$ `NasRouter.id`? — otomatis diturunkan dari `profileGroup.nasId`)
  - `bindOnNas` (Boolean, default `false` — kunci dial login hanya melalui router NAS milik `profileGroup`)
  - `createdAt`, `updatedAt`, `lastSeenAt` (DateTime)
  - `portalUser` (Relasi 1-to-1 ke `PortalUser` untuk login Customer Self-Care)

- **`Bandwidth` (`bandwidth_config`)**:
  - `id` (String PK, format `bw-<timestamp>`), `name` (String)
  - Parameter Dasar (CIR / MIR): `minDownload`, `minDownloadUnit` (`Kbps` | `Mbps`), `minUpload`, `minUploadUnit` (`Kbps` | `Mbps`), `maxDownload` (Int), `maxDownloadUnit` (`Kbps` | `Mbps`), `maxUpload` (Int), `maxUploadUnit` (`Kbps` | `Mbps`)
  - Parameter QoS MikroTik Burst (All-or-Nothing Rule): `burstLimitDownload`, `burstLimitDownloadUnit`, `burstLimitUpload`, `burstLimitUploadUnit`, `burstThresholdDownload`, `burstThresholdDownloadUnit`, `burstThresholdUpload`, `burstThresholdUploadUnit`, `burstTime` (detik 1-600)
  - `pppProfileCount` (Derived di API dari jumlah `PppProfile` terkait)

- **`ProfileGroup` (`profile_group`)**:
  - `id` (String PK, format `grp-<timestamp>`), `name` (String)
  - `nasId` (FK $\rightarrow$ `NasRouter.id`)
  - `type` (`"PPP"`), `ipModule` (`"sql"` | `"mikrotik_pool"`)
  - `localAddress` (String IPv4 Gateway PPP — divalidasi tidak boleh berada di antara `rangeIpStart` s.d `rangeIpEnd`)
  - `rangeIpStart` (String IPv4), `rangeIpEnd` (String IPv4)
  - `dnsServers` (String — default `"8.8.8.8,8.8.4.4"`)
  - `parentQueue` (String?)
  - `customerCount` (Derived di API dari jumlah `Customer` terkait)

- **`PppProfile` (`ppp_profile`)**:
  - `id` (String PK, format `ppp-<timestamp>`), `name` (String), `price` (Int IDR/bulan)
  - `bandwidthId` (FK $\rightarrow$ `Bandwidth.id`)
  - `priority` (Int 1–8, default 8)
  - `customerCount` (Derived di API dari jumlah `Customer` terkait)

- **`NasRouter` (`nas_router`)**:
  - `id` (String PK, format `nas-<timestamp>`), `name` (String), `ipAddress` (String Unique — `nasname`), `location` (String?), `type` (`"mikrotik"`)
  - `status` (`"online"` | `"offline"` | `"unknown"` — determined by live poller)
  - Kredensial API: `apiUsername`, `apiPassword`, `apiPort` (default 8728)
  - Pengaturan RADIUS: `radiusSecret`, `radiusEnabled` (Boolean), `syncEnabled` (Boolean)
  - `lastSeenAt`, `lastSyncedAt` (DateTime)

- **`Invoice` (`invoice`)**:
  - `id` (String PK, format `inv-<timestamp>`), `invoiceNumber` (String Unique, `INV/YYYY/MM/SEQ`)
  - `customerId` (FK $\rightarrow$ `Customer`), Snapshot Pelanggan: `customerUsername`, `customerFullName`, `customerPhone`, `customerAddress`
  - `profileId`, `profileName` (Snapshot profil)
  - Periode: `periodMonth` (1–12), `periodYear` (Int)
  - Kalkulasi (IDR): `subtotal`, `taxPercent` (0–100), `tax`, `discount`, `adminFee` (default 2500), `installationFee`, `totalAmount`
  - `status` (`"paid"` | `"unpaid"` | `"overdue"` | `"cancelled"`)
  - `issueDate`, `dueDate`, `paidAt` (DateTime)
  - `paymentMethod` (`qris` | `transfer_bca` | `transfer_mandiri` | `transfer_bri` | `cash` | `other`), `paymentReference`, `notes`
  - *Unique constraint*: `@@unique([customerId, periodYear, periodMonth])`

- **`PaymentRecord` (`payment_record`)**:
  - `id` (String PK, format `pay-<timestamp>`), `invoiceId` (FK $\rightarrow$ `Invoice`), `invoiceNumber`, `customerId` (FK $\rightarrow$ `Customer`), `customerName`, `amount` (Int IDR), `paymentMethod`, `paymentReference`, `paidAt`, `receivedBy`, `notes`

- **`Role` (`role`)**:
  - `id` (String PK), `name`, `description`, `permissions` (String[] — 27 literals), `system` (Boolean — role sistem tidak bisa dihapus)

- **`CompanyProfile` (`company_profile`)**:
  - `id` (Int PK 1), `brandName`, `fullName`, `address`, `phone`, `email`, `website`, `npwp`, `licenseNo`

- **Audit Logs**:
  - `GlobalLog` (`global_log`): `id, timestamp, ipAddress, userAgent, userName, source ("Aplikasi" | "Portal Langganan" | "API")`
  - `PortalLoginLog` (`portal_login_log`): `id, customerId, customerUsername, loginAt, ipAddress, userAgent, source`
  - `PortalSessionLog` (`portal_session_log`): `id, customerId, customerUsername, nasIpAddress, framedIp, startedAt, stoppedAt, durationSeconds, inputBytes, outputBytes, terminateCause`
  - `WaTemplate` (`wa_template`): `id (1), template, updatedAt`

### B. Tabel Shared FreeRADIUS v3 (`rlm_sql` PostgreSQL)

> **PENTING**: Query modul bawaan FreeRADIUS membaca/menulis identifier tanpa tanda kutip ganda sehingga PostgreSQL memetakan kolom ke format **LOWERCASE**. Semua mapping `@map("...")` pada model FreeRADIUS wajib mempertahankan penamaan lowercase.

- **`RadCheck` (`radcheck`)**: `id` (Serial PK), `username`, `attribute`, `op` (`:=`), `value`
  - Record: `Cleartext-Password` (password pelanggan), `Auth-Type := Reject` (pelanggan suspended/disabled), `Simultaneous-Use := 1` (Single Session) / `Simultaneous-Use := N` (Multi Session).
- **`RadNasAllow` (`radnasallow`)**: `id` (Serial PK), `username`, `nasipaddress`
  - Whitelist router NAS per user: dibaca oleh policy unlang FreeRADIUS `check_nas_binding` saat `bindOnNas = true`.
- **`RadReply` (`radreply`)**: `id` (Serial PK), `username`, `attribute`, `op` (`:=`), `value`
  - Record: `Framed-IP-Address` (IP statis), `Mikrotik-Rate-Limit` (QoS string format MikroTik), `MS-Primary-DNS-Server`, `MS-Secondary-DNS-Server`.
- **`RadAcct` (`radacct`)**: Dikelola langsung oleh FreeRADIUS saat menerima Accounting packet. Kolom: `radacctid`, `acctsessionid`, `acctuniqueid`, `username`, `nasipaddress`, `framedipaddress`, `acctstarttime`, `acctupdatetime`, `acctstoptime`, `acctsessiontime`, `acctinputoctets`, `acctoutputoctets`, `acctterminatecause`, dll.
- **`RadPostAuth` (`radpostauth`)**: Riwayat respon auth (`Access-Accept`/`Access-Reject`).
- **`Nas` (`nas`)**: Daftar router NAS (`nasname` = IP MikroTik, `secret` = shared secret).

---

## 4. Mesin Integrasi RADIUS, MikroTik & Poller (`src/lib/*`)

### A. Sinkronisasi Data Atomik (`src/lib/radsync.ts`)
Semua operasi mutasi data yang mempengaruhi otentikasi/otorisasi RADIUS dijalankan dalam transaksi Prisma bersama data master:
- **Pelanggan Aktif**: Menulis `radcheck` (`Cleartext-Password`), menghapus `Auth-Type := Reject`.
- **Pelanggan Suspended / Disabled**: Menulis `radcheck` (`Auth-Type := Reject`), password lama tetap disimpan agar ketika diaktifkan kembali tidak perlu reset password.
- **Session Control (`Simultaneous-Use`)**: Menulis `radcheck` `Simultaneous-Use` := `1` (Single Session) atau `maxSimultaneous` (Multi Session).
- **NAS Whitelist Binding (`radnasallow`)**: Saat `bindOnNas = true`, menulis baris router IP yang diizinkan ke tabel `radnasallow`. FreeRADIUS mengevaluasi policy `check_nas_binding` untuk menolak router yang tidak di-whitelist. Jika `bindOnNas = false`, baris di `radnasallow` dihapus sehingga bebas login dari router NAS mana pun.
- **Profil Bandwidth & DNS**: Menulis `radreply` `Mikrotik-Rate-Limit` dan `MS-Primary-DNS-Server` / `MS-Secondary-DNS-Server`.
- **Bulk PPP Profile Sync**: Saat konfigurasi bandwidth atau PPP Profile diedit, `syncPppProfileRadiusBulk` memperbarui atribut `Mikrotik-Rate-Limit` di `radreply` untuk semua pelanggan yang menggunakan paket tersebut.
- **Router NAS**: Menulis/memperbarui baris pada tabel `nas` untuk dibaca oleh FreeRADIUS (`read_clients = yes`).

### B. Format MikroTik QoS Rate-Limit (`src/lib/radius-format.ts`)
Atribut `Mikrotik-Rate-Limit` disusun dengan format baku RouterOS:
$$\text{RateLimit} = \text{rx/tx [burst-limit] [burst-threshold] [burst-time] [priority] [limit-at (CIR)]}$$
Contoh: `10M/10M 15M/15M 8M/8M 10/10 8 5M/5M` (Download/Upload).

### C. Client API MikroTik Native (`src/lib/mikrotik-client.ts`)
Menggunakan implementasi protokol binari API RouterOS mandiri melalui koneksi raw TCP Socket (port 8728), mendukung RouterOS v6 dan v7 (termasuk penanganan respon `!empty` dan MD5 challenge/plaintext login).

### D. Live Sesi & History Accounting (`src/lib/radacct-sessions.ts` & `src/lib/usage-real.ts`)
- Sesi aktif dibaca dari `radacct` (`acctStopTime IS NULL`).
- Durasi real-time dan estimasi pertumbuhan byte upload/download dihitung dari `acctUpdateTime` terakhir.
- Riwayat statistik penggunaan 30 hari harian dan 12 bulan bulanan dihitung secara presisi dari data `radacct` tanpa menggunakan data sintetik.

---

## 5. Pemetaan Rute Frontend & URL State (`nuqs`)

### A. Rute Aplikasi

| Modul | Route Dashboard | Route Portal Pelanggan | Keterangan & Proteksi |
|---|---|---|---|
| **Autentikasi** | `/login` | `/portal/login` | Login user sistem / login self-care portal |
| **Dashboard** | `/dashboard` | `/portal` | Ringkasan statistik operasional / status langganan |
| **Pelanggan** | `/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit` | — | Manajemen data teknis & PPPoE pelanggan |
| **Paket & Layanan: PPP Profile** | `/ppp-profiles`, `/ppp-profiles/new`, `/ppp-profiles/[id]/edit` | — | Paket layanan PPPoE & harga bulanan |
| **Paket & Layanan: Bandwidth** | `/bandwidths`, `/bandwidths/new`, `/bandwidths/[id]/edit` | — | Konfigurasi kecepatan (MIR/CIR) & Burst QoS |
| **Paket & Layanan: Profile Group** | `/profile-groups`, `/profile-groups/new`, `/profile-groups/[id]/edit` | — | Group router NAS, IP pool & gateway |
| **Router NAS** | `/routers`, `/routers/new`, `/routers/[id]/edit` | — | Konfigurasi MikroTik & status sync |
| **Sesi PPPoE** | `/sessions` | `/portal/usage`, `/portal/logs` | Monitoring sesi live & riwayat pemakaian |
| **Billing** | `/billing`, `/billing/[id]` | `/portal/billing`, `/portal/payments` | Invoicing, tagihan, cetak nota, & histori bayar |
| **Pengguna Sistem** | `/users`, `/users/new`, `/users/[id]/edit` | — | Pengguna internal aplikasi (admin/operator) |
| **Role & Hak Akses** | `/roles` | — | Konfigurasi RBAC (Admin only) |
| **Log Aktivitas** | `/logs` | `/portal/logs` | Audit trail login & sesi PPPoE |
| **Pengaturan** | `/settings` | — | Profil perusahaan & template WhatsApp |

### B. Kontrak URL Query State (`nuqs`)

Semua filter, pencarian, dan pagination tabel tersinkronisasi di URL query string dan wajib dibungkus `<Suspense>`:

| Key | Parser & Default | Keterangan & Batasan | Modul yang Menggunakan |
|---|---|---|---|
| `page` | `parseAsInteger.withDefault(1)` | Halaman aktif (1-indexed, clamp $\ge 1$) | Semua tabel |
| `limit` | `parseAsInteger.withDefault(10)` | Baris per halaman (pilihan: 10, 25, 50) | Semua tabel |
| `search` | `parseAsString.withDefault("")` | Keyword pencarian teks | customers, sessions, billing, users, logs |
| `status` | `parseAsString.withDefault("all")` | Filter status entitas | customers, billing, users, logs (source) |
| `profile` | `parseAsString.withDefault("all")` | Filter berdasarkan `profileId` | customers |
| `router` | `parseAsString.withDefault("all")` | Filter berdasarkan IP Router / NAS ID | sessions, customers |
| `role` | `parseAsString.withDefault("all")` | Filter berdasarkan `roleId` | users |
| `month` | `parseAsString.withDefault("all")` | Filter bulan periode tagihan (1–12) | billing |
| `paysearch` | `parseAsString.withDefault("")` | Pencarian tab riwayat pembayaran | billing |
| `tab` | `parseAsString.withDefault("invoices")` | Tab aktif antarmuka | billing, customer detail, portal usage |
| `year` | `parseAsInteger.withDefault(currentYear)` | Filter tahun grafik analitik | customer detail, portal usage |
| `from` / `to` | `parseAsString.withDefault("")` | Rentang tanggal audit log | logs |

---

## 6. Kontrak REST API Backend (`/api/v1/*`)

Seluruh endpoint API mengembalikan format JSON standar:
- **Sukses**: `{ data: T }` atau `{ data: T[], total: number }` (paginasi).
- **Gagal**: `{ error: string }` dengan HTTP status code yang sesuai (400, 401, 403, 404, 409, 500).

```
GET    /api/v1/customers                     -> List pelanggan (search, status, profile, router, page, limit)
POST   /api/v1/customers                     -> Tambah pelanggan baru (+ atomic radsync)
GET    /api/v1/customers/:id                 -> Detail pelanggan + profil + status sesi
PUT    /api/v1/customers/:id                 -> Update pelanggan (+ atomic radsync)
DELETE /api/v1/customers/:id                 -> Hapus pelanggan (+ radsync cleanup + terminate sesi)
POST   /api/v1/customers/:id/disconnect      -> Putus koneksi PPPoE aktif pelanggan

GET    /api/v1/bandwidths                    -> List konfigurasi bandwidth (+ pppProfileCount)
POST   /api/v1/bandwidths                    -> Tambah bandwidth baru (CIR/MIR + all-or-nothing Burst QoS)
GET    /api/v1/bandwidths/:id                -> Detail bandwidth
PUT    /api/v1/bandwidths/:id                -> Update bandwidth (+ bulk radsync ke seluruh PPP Profile terkait)
DELETE /api/v1/bandwidths/:id                -> Hapus bandwidth (ditolak jika masih digunakan PPP Profile)

GET    /api/v1/profile-groups                -> List profile groups (+ pppProfileCount)
POST   /api/v1/profile-groups                -> Tambah profile group (validasi IP range vs Local Gateway)
GET    /api/v1/profile-groups/:id            -> Detail profile group
PUT    /api/v1/profile-groups/:id            -> Update profile group
DELETE /api/v1/profile-groups/:id            -> Hapus profile group (ditolak jika masih digunakan PPP Profile)

GET    /api/v1/ppp-profiles                  -> List PPP profiles (+ customerCount)
POST   /api/v1/ppp-profiles                  -> Tambah PPP profile baru
GET    /api/v1/ppp-profiles/:id              -> Detail PPP profile
PUT    /api/v1/ppp-profiles/:id              -> Update PPP profile (+ bulk radsync ke seluruh pelanggan terkait)
DELETE /api/v1/ppp-profiles/:id              -> Hapus PPP profile (ditolak jika masih digunakan pelanggan)

GET    /api/v1/routers                       -> List router NAS (+ activeSessionCount derived)
POST   /api/v1/routers                       -> Tambah router (+ insert row nas FreeRADIUS)
GET    /api/v1/routers/:id                   -> Detail router
PUT    /api/v1/routers/:id                   -> Update konfigurasi router (+ update row nas)
DELETE /api/v1/routers/:id                   -> Hapus router (ditolak jika ada sesi aktif/pelanggan terkait)
POST   /api/v1/routers/:id/ping              -> Uji konektivitas API MikroTik secara live
POST   /api/v1/routers/:id/sync-now          -> Jalankan heartbeat & sinkronisasi manual sekarang
POST   /api/v1/routers/:id/connect-radius    -> Konfigurasi /radius & /ppp aaa pada MikroTik via API
POST   /api/v1/routers/:id/disconnect-radius -> Nonaktifkan konfigurasi RADIUS pada MikroTik

GET    /api/v1/sessions                      -> List sesi PPPoE aktif dari radacct (search, router, limit)
POST   /api/v1/sessions/:id/disconnect       -> Putus sesi spesifik via CoA Disconnect / API RouterOS

GET    /api/v1/billing                       -> List invoice & pembayaran (status, month, search, page, limit)
POST   /api/v1/billing                       -> Buat invoice manual tunggal
GET    /api/v1/billing/:id                   -> Detail invoice + histori pembayaran
PUT    /api/v1/billing/:id                   -> Update status/catatan invoice
DELETE /api/v1/billing/:id                   -> Hapus invoice (hanya yang belum dibayar)
POST   /api/v1/billing/:id/pay               -> Transaksi pelunasan tagihan (+ buat PaymentRecord)
POST   /api/v1/billing/:id/cancel            -> Batalkan invoice
POST   /api/v1/billing/:id/reminder          -> Format pesan pengingat WhatsApp
POST   /api/v1/billing/bulk-generate         -> Generate tagihan massal untuk seluruh pelanggan aktif
GET    /api/v1/billing/summary               -> Ringkasan finansial (total pendapatan, tertunggak, overdue)
GET    /api/v1/billing/months                -> Daftar bulan periode invoice yang tersedia di database

GET    /api/v1/dashboard                     -> Metrik operasional, router online, dan grafik tren 7 hari
GET    /api/v1/users                         -> List pengguna sistem
POST   /api/v1/users                         -> Tambah pengguna sistem (+ buat akun Better-Auth)
GET    /api/v1/users/:id                     -> Detail pengguna sistem
PUT    /api/v1/users/:id                     -> Update profil & role pengguna
DELETE /api/v1/users/:id                     -> Hapus pengguna (mencegah penghapusan admin terakhir)

GET    /api/v1/roles                         -> List role sistem & custom RBAC
POST   /api/v1/roles                         -> Buat role baru
GET    /api/v1/roles/:id                     -> Detail role
PUT    /api/v1/roles/:id                     -> Update role & permission
DELETE /api/v1/roles/:id                     -> Hapus role custom (role sistem ditolak)

GET    /api/v1/logs                          -> List audit trail global_log (source, from, to, search, page, limit)
GET    /api/v1/settings                      -> Ambil profil perusahaan & template WhatsApp
PUT    /api/v1/settings                      -> Simpan profil perusahaan & template WhatsApp
POST   /api/v1/radius/reload                 -> Trigger reload konfigurasi FreeRADIUS

GET    /api/v1/portal/me                     -> Agregat data profil, tagihan, sesi, & usage pelanggan login
```

---

## 7. Sistem Otorisasi & RBAC

Sistem mengimplementasikan **Role-Based Access Control (RBAC)** ketat di sisi server (`src/lib/rbac.ts` & `src/lib/api-auth.ts`):

### A. 27 Granular Permissions

| Resource | `read` | `create` | `update` | `delete` |
|---|:---:|:---:|:---:|:---:|
| `customer` | `customer.read` | `customer.create` | `customer.update` | `customer.delete` |
| `billing` | `billing.read` | `billing.create` | `billing.update` | `billing.delete` |
| `session` | `session.read` | `session.create` | `session.update` | `session.delete` |
| `profile` | `profile.read` | `profile.create` | `profile.update` | `profile.delete` |
| `router` | `router.read` | `router.create` | `router.update` | `router.delete` |
| `user` | `user.read` | `user.create` | `user.update` | `user.delete` |
| **System** | `log.read` | — | `setting.update` (`setting.read`) | — |

### B. Aturan Otorisasi
- **Administrator (`role-admin`)**: Memiliki bypass akses penuh ke semua rute dan mutasi data API.
- **Role Kustom & Manager**: Wajib diverifikasi melalui helper `requirePermission(permission)` pada setiap handler API.
- **Proteksi UI Rute**: Dieksekusi melalui `canAccessRoute(user, pathname)` di layout dashboard.

---

## 8. Aturan Bisnis Modul Billing

1. **Format Penomoran Invoice**: `INV/YYYY/MM/SEQ` (SEQ: nomor urut 3 digit per periode bulan/tahun).
2. **Aturan Jatuh Tempo (`dueDate`)**:
   $$\text{Bulan Jatuh Tempo} = \text{Periode Target} + 1\text{ bulan}$$
   $$\text{Tanggal} = \text{Tanggal registrasi (createdAt) pelanggan (fallback: tanggal 10)}$$
   $$\text{Waktu} = \text{23:59:59 WIB}$$
   *Normalisasi Akhir Bulan*: Jika tanggal registrasi melampaui hari terakhir bulan berikutnya (mis. 31 Januari $\rightarrow$ Februari), tanggal otomatis dipaksa ke hari terakhir bulan tersebut (28/29 Februari).
3. **Pencegahan Tagihan Ganda**: Pasangan `(customerId, periodYear, periodMonth)` bersifat unik. Invoice manual akan mengembalikan error 409 bila duplikat; bulk generation akan men-skip tagihan yang sudah ada.
4. **Struktur Kalkulasi Tagihan**:
   $$\text{Tax} = \text{round}\left(\frac{\text{Subtotal} \times \text{taxPercent}}{100}\right)$$
   $$\text{TotalTagihan} = \max(0, \text{Subtotal} + \text{Tax} + \text{AdminFee} + \text{InstallationFee} - \text{Discount})$$
5. **Transaksional Pelunasan (`markInvoiceAsPaid`)**: Update status invoice $\rightarrow$ `"paid"` dan pembuatan record `PaymentRecord` dieksekusi dalam satu transaksi atomik.
6. **Template Pengingat WhatsApp**: Variabel yang didukung: `$USER`, `$BRAND`, `$PROFILE`, `$PERIOD`, `$TOTAL`, `$INVOICE`, `$DUE`.

---

## 9. Konvensi & Standar Kode

- **Formatting & Linting**: Biome (`bunx biome check --write .`). Jangan gunakan ESLint/Prettier.
- **Type Checking**: `bunx tsc --noEmit`.
- **UI Components**: shadcn/ui + Radix UI + Lucide React.
- **Format Mata Uang & Angka**: `formatRupiah()`, `formatBytes()`, `formatDuration()`, `formatDate()` di `@/lib/utils`.
- **ID Generator**: Konsisten menggunakan prefix domain: `cust-<ts>`, `prof-<ts>`, `nas-<ts>`, `inv-<ts>`, `pay-<ts>`, `usr-<ts>`, `role-<ts>`.

---

## 10. Arsitektur Data Fetching & State Management (TanStack Query v5)

Seluruh pemanggilan REST API di antarmuka frontend dikelola secara deklaratif menggunakan **TanStack Query v5** (`@tanstack/react-query`) untuk menjamin konsistensi cache, performa optimal, dan pengalaman pengguna yang halus tanpa flickering (kedip layar).

### A. Konfigurasi Standar QueryClient & DevTools (`src/lib/query-client.ts` & `src/components/providers/query-provider.tsx`)
- **Singleton Browser Pattern**: Menghindari reset cache saat re-render pada React Server Components/Client boundary.
- **`staleTime: 60 * 1000` (60 detik)**: Menghindari network request berulang yang tidak perlu saat navigasi rute.
- **`gcTime: 5 * 60 * 1000` (5 menit)**: Menghemat memori browser namun tetap mempertahankan instant-load data yang baru diakses.
- **`refetchOnWindowFocus: false`**: Mencegah re-fetching data yang mengganggu saat user beralih antar jendela/tab.
- **`refetchOnReconnect: true`**: Otomatis memperbarui data ketika koneksi jaringan pulih kembali.
- **`placeholderData: keepPreviousData`**: Digunakan pada tabel berpaged/filter agar layout tabel stabil tanpa layout shift saat berpindah halaman atau mengubah filter pencarian.
- **`ReactQueryDevtools`**: Terintegrasi via `@tanstack/react-query-devtools` pada `QueryProvider` (`initialIsOpen={false}`, `buttonPosition="bottom-right"`) untuk kemudahan debugging state query & cache.

### B. Hierarki & Konvensi Query Keys (`src/lib/api/query-keys.ts`)
Setiap domain memiliki struktur query key standar:
```typescript
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  customers: {
    all: ["customers"] as const,
    list: (filters) => ["customers", "list", filters] as const,
    detail: (id) => ["customers", "detail", id] as const,
    activeSession: (id) => ["customers", "activeSession", id] as const,
    sessions: (id, params) => ["customers", "sessions", id, params] as const,
    usageHistory: (id, days) => ["customers", "usageHistory", id, days] as const,
    monthlyUsage: (id, year) => ["customers", "monthlyUsage", id, year] as const,
  },
  profiles: { all: ["profiles"] as const, detail: (id) => ["profiles", "detail", id] as const },
  routers: { all: ["routers"] as const, detail: (id) => ["routers", "detail", id] as const },
  sessions: { all: ["sessions"] as const, list: (filters) => ["sessions", "list", filters] as const },
  billing: {
    all: ["billing"] as const,
    invoices: (filters) => ["billing", "invoices", filters] as const,
    payments: (filters) => ["billing", "payments", filters] as const,
    detail: (id) => ["billing", "detail", id] as const,
    summary: ["billing", "summary"] as const,
    months: ["billing", "months"] as const,
  },
  users: { all: ["users"] as const, list: (filters) => ["users", "list", filters] as const, detail: (id) => ["users", "detail", id] as const },
  roles: { all: ["roles"] as const, detail: (id) => ["roles", "detail", id] as const },
  logs: { all: ["logs"] as const, list: (filters) => ["logs", "list", filters] as const },
  settings: { company: ["settings", "company"] as const, waTemplate: ["settings", "waTemplate"] as const },
  portal: { me: ["portal", "me"] as const },
};
```

### C. Aturan Invalidation & Flicker-Free Mutasi (`src/lib/api/hooks/*`)
- **Mutasi Customer**: Meng-invalidate `queryKeys.customers.all`, `queryKeys.dashboard`, `queryKeys.profiles.all`, dan `queryKeys.routers.all`.
- **Mutasi Profile**: Meng-invalidate `queryKeys.profiles.all`, `queryKeys.customers.all`, dan `queryKeys.dashboard`.
- **Mutasi Router**: Meng-invalidate `queryKeys.routers.all`, `queryKeys.sessions.all`, dan `queryKeys.dashboard`.
- **Mutasi Billing**: Meng-invalidate `queryKeys.billing.all`, `queryKeys.dashboard`, dan `queryKeys.customers.all`.
- **Mutasi User & Role**: Meng-invalidate `queryKeys.users.all` dan `queryKeys.roles.all`.
- **No Auto-Refresh Flickering**: Halaman detail pelanggan (`/customers/[id]`) dan halaman monitoring **dilarang menggunakan `setInterval` blind fetch** yang mereset status komponen. Sebagai gantinya, gunakan tombol Refresh manual di header actions dengan indikator spinner dan biarkan TanStack Query mengelola stale caching secara cerdas di latar belakang.

---

## 11. Panduan Operasional & Perintah Development

```bash
# 1. Jalankan Infrastruktur Kontainer (Postgres & FreeRADIUS)
docker compose up -d --build

# 2. Migrasi Database & Seeding
bun run db:migrate
bun run db:seed

# 3. Jalankan Aplikasi Next.js Development Server
bun dev

# 4. Verifikasi & Perbaikan Kode
bun run lint:fix
bun run format
bunx tsc --noEmit

# 5. Uji Otentikasi RADIUS via Container
docker exec microrad-freeradius sh -c \
  'echo "User-Name=budi_santoso, User-Password=pass123" | radclient 127.0.0.1 auth testing123'
```