<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MicroRAD PPPoE & Hotspot Manager — Arsitektur & Spesifikasi Sistem

MicroRAD adalah sistem manajemen ISP / PPPoE & Hotspot terpadu full-stack yang mengintegrasikan **Next.js 16 App Router** (React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui + Biome), **PostgreSQL 16** via **Prisma ORM 7**, **Better-Auth** (dual-instance auth), **FreeRADIUS v3** (modul `rlm_sql` PostgreSQL), dan **MikroTik RouterOS** (protokol binari API + RADIUS CoA RFC 5176).

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
│  - REST API `/api/v1/*`                      │ API TCP    │ (PPPoE / Hotspot Server)    │
│  - Better-Auth (App & Portal Instances)      ├───────────►│  - `/ppp/profile/*`         │
│  - Background Poller (`instrumentation.ts`)  │ Port 8728  │  - `/ip/hotspot/user/profile`│
│  - Atomic `radsync` ke FreeRADIUS            │            │  - CoA Kick (UDP 3799)      │
└──────────────────────────────────────────────┘            └─────────────────────────────┘
```

### Siklus Alur Data PPPoE, Hotspot & Accounting
1. **Autentikasi PPPoE & Hotspot**: Pelanggan dial PPPoE / login Captive Portal Hotspot ke MikroTik $\rightarrow$ MikroTik kirim `Access-Request` (port 1812 UDP) ke FreeRADIUS $\rightarrow$ FreeRADIUS membaca tabel `radcheck` (`Cleartext-Password`, `Auth-Type := Reject`, `NAS-IP-Address`) dan `radreply` (`Framed-IP-Address`, `Mikrotik-Rate-Limit`, `Mikrotik-Group`).
2. **Accounting Live (`radacct`)**: MikroTik mengirim paket `Acct-Status-Type` (`Start`, `Interim-Update` per 1 menit, `Stop`) ke FreeRADIUS (port 1813 UDP) $\rightarrow$ FreeRADIUS menulis langsung ke tabel `radacct`.
3. **Live Session & Traffic Stats**: Aplikasi membaca sesi aktif langsung dari tabel `radacct` (`acctStopTime IS NULL`), melakukan inflasi real-time durasi dan byte berdasarkan selisih waktu `acctUpdateTime`.
4. **Heartbeat Poller Router**: Poller background (`src/lib/mikrotik-sync.ts`) dijalankan via `src/instrumentation.ts` setiap 30 detik (`MIKROTIK_SYNC_INTERVAL_MS`), memverifikasi koneksi ping (ICMP / TCP fallback) ke router dan memperbarui status router (`online`/`offline`) secara otomatis tanpa mewajibkan kredensial API.
5. **Disconnect / Kick Session**: Admin memutuskan sesi melalui UI $\rightarrow$ aplikasi memicu Disconnect-Request RADIUS CoA (RFC 5176) ke port 3799 UDP atau fallback memanggil API RouterOS `/ppp/active/remove` / `/ip/hotspot/active/remove`.
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

### A. Tabel Domain Aplikasi (Model 4-Layer Modular ISP)

1. **`Bandwidth` (`bandwidth_config`)**:
   - `id` (String PK, format `bw-<timestamp>`), `name` (String)
   - Parameter Dasar (CIR / MIR): `minDownload`, `minDownloadUnit` (`Kbps` | `Mbps`), `minUpload`, `minUploadUnit` (`Kbps` | `Mbps`), `maxDownload` (Int), `maxDownloadUnit` (`Kbps` | `Mbps`), `maxUpload` (Int), `maxUploadUnit` (`Kbps` | `Mbps`)
   - Parameter QoS MikroTik Burst (All-or-Nothing Rule): `burstLimitDownload`, `burstLimitDownloadUnit`, `burstLimitUpload`, `burstLimitUploadUnit`, `burstThresholdDownload`, `burstThresholdDownloadUnit`, `burstThresholdUpload`, `burstThresholdUploadUnit`, `burstTime` (detik 1-600)
   - `internetProfileCount` (Derived di API dari jumlah `InternetProfile` terkait)

2. **`PppProfile` (`ppp_profile`) — Konfigurasi Profil Layanan Node Router MikroTik (PPP & Hotspot)**:
   - `id` (String PK, format `ppp-<timestamp>`), `name` (String — nama profil di RouterOS)
   - `serviceType` (`"PPP"` | `"HOTSPOT"`)
   - `ipModule` (`"sql"` | `"mikrotik_pool"`)
   - `localAddress` (String IPv4 Gateway PPP MikroTik — divalidasi tidak boleh berada di antara `rangeIpStart` s.d `rangeIpEnd`)
   - `rangeIpStart` (String IPv4), `rangeIpEnd` (String IPv4)
   - `dnsServers` (String — default `"8.8.8.8,8.8.4.4"`)
   - Parameter Queue & Timeout: `sessionTimeout` (Int?), `idleTimeout` (Int?), `parentQueue` (String?), `insertQueueBefore` (`"first"` | `"bottom"`?)
   - Parameter Khusus Hotspot: `keepaliveTimeout` (String?), `addMacCookie` (Boolean, default `false`), `macCookieTimeout` (String?)
   - `areaGroupId` (FK $\rightarrow$ `AreaGroup.id`? — Wilayah tempat profil ini di-apply)

3. **`AreaGroup` / `ProfileGroup` (`profile_group`) — Pengelompokan Wilayah / Zona Failover**:
   - `id` (String PK, format `grp-<timestamp>`), `name` (String)
   - `serviceType` (`"PPP"` | `"HOTSPOT"` | `"PPP,HOTSPOT"` — multi-service selection)
   - `description` (String?)
   - `routers` (Relasi many-to-many ke `NasRouter` — kumpulan router NAS yang melayani area ini)
   - `pppProfiles` (Relasi 1-to-many ke `PppProfile` yang otomatis di-apply ke seluruh router di area ini)
   - `customerCount` (Derived di API dari jumlah `Customer` terkait)

4. **`InternetProfile` (`internet_profile`) — Produk Paket Layanan & Tarif Bulanan**:
   - `id` (String PK, format `prof-<timestamp>`), `name` (String), `price` (Int IDR/bulan)
   - `bandwidthId` (FK $\rightarrow$ `Bandwidth.id`)
   - `priority` (Int 1–8, default 8)
   - `customerCount` (Derived di API dari jumlah `Customer` terkait)

5. **`Customer` (`customer`)**:
   - `id` (String PK, format `cust-<timestamp>`)
   - `username` (String Unique — login PPPoE / `radcheck.username`, case-insensitive di layer API, auto-generated unik format `user_<6-digit>`, jika diganti otomatis trigger `moveCustomerRadius` ke tabel RADIUS)
   - `password` (String? — password PPPoE dial-in, auto-generated 8 karakter)
   - `fullName`, `email`, `phone`, `address` (Metadata kontak pelanggan; `email` digunakan untuk pembuatan akun `PortalUser`)
   - `status` (`"active"` | `"suspended"` | `"disabled"`)
   - `profileId` (FK $\rightarrow$ `InternetProfile.id` — Paket Layanan: Kecepatan & Tarif Bulanan)
   - `profileGroupId` (FK $\rightarrow$ `ProfileGroup.id` — Wilayah Layanan: Kumpulan Node Router Failover)
   - `staticIp` (String? — IP statis pelanggan / `Framed-IP-Address`)
   - `createdAt`, `updatedAt`, `lastSeenAt` (DateTime)
   - `portalUser` (Relasi 1-to-1 ke `PortalUser` untuk login Customer Self-Care)

- **`NasRouter` (`nas_router`)**:
  - `id` (String PK, format `nas-<timestamp>`), `name` (String), `ipAddress` (String Unique — `nasname`), `location` (String?), `type` (`"mikrotik"`)
  - `status` (`"online"` | `"offline"` | `"unknown"` — determined by live poller)
  - Kredensial API: `apiUsername`, `apiPassword`, `apiPort` (default 8728)
  - Pengaturan RADIUS: `radiusSecret`, `radiusEnabled` (Boolean), `syncEnabled` (Boolean)
  - `lastSeenAt`, `lastSyncedAt` (DateTime)

- **`Invoice` (`invoice`)**:
  - `id` (String PK, format `inv-<timestamp>`), `invoiceNumber` (String Unique, `INV/YYYY/MM/SEQ`)
  - `customerId` (FK $\rightarrow$ `Customer`), Snapshot Pelanggan: `customerUsername`, `customerFullName`, `customerPhone`, `customerAddress`
  - `profileId`, `profileName` (Snapshot profil paket internet)
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
  - Whitelist router NAS per user: dibaca oleh policy unlang FreeRADIUS `check_nas_binding` saat dial-in. Jika wilayah memiliki 3 router NAS, FreeRADIUS akan memiliki 3 baris di tabel `radnasallow` untuk user tersebut (Zero-Touch Multi-Router Failover).
- **`RadUserGroup` (`radusergroup`)**: `id` (Serial PK), `username`, `groupname`, `priority`
  - Memetakan username pelanggan ke nama Paket Internet (`InternetProfile.name`) tempat pelanggan bernaung.
- **`RadGroupReply` (`radgroupreply`)**: `id` (Serial PK), `groupname`, `attribute`, `op` (`:=`), `value`
  - Record: `Mikrotik-Rate-Limit` (QoS string format MikroTik posisional 6 parameter yang berlaku terpusat untuk seluruh pelanggan dalam paket tersebut).
- **`RadReply` (`radreply`)**: `id` (Serial PK), `username`, `attribute`, `op` (`:=`), `value`
  - Record: Atribut unik spesifik per-user seperti `Framed-IP-Address` (IP statis pelanggan jika dialokasikan).
- **`RadIpPool` (`radippool`)**: Pool IP dinamis SQL terpusat yang dikelola modul `sqlippool` FreeRADIUS. Kolom: `id, pool_name, framedipaddress, nasipaddress, calledstationid, callingstationid, expiry_time, username, pool_key`.
- **`RadAcct` (`radacct`)**: Dikelola langsung oleh FreeRADIUS saat menerima Accounting packet. Kolom: `radacctid`, `acctsessionid`, `acctuniqueid`, `username`, `nasipaddress`, `framedipaddress`, `acctstarttime`, `acctupdatetime`, `acctstoptime`, `acctsessiontime`, `acctinputoctets`, `acctoutputoctets`, `acctterminatecause`, dll.
- **`RadPostAuth` (`radpostauth`)**: Riwayat respon auth (`Access-Accept`/`Access-Reject`).
- **`Nas` (`nas`)**: Daftar router NAS (`nasname` = IP MikroTik, `secret` = shared secret).

---

## 4. Mesin Integrasi RADIUS, MikroTik & Poller (`src/lib/*`)

### A. Sinkronisasi Data Atomik (`src/lib/radsync.ts`)
Semua operasi mutasi data yang mempengaruhi otentikasi/otorisasi RADIUS dijalankan dalam transaksi Prisma bersama data master:
- **Pelanggan Aktif**: Menulis `radcheck` (`Cleartext-Password`), menghapus `Auth-Type := Reject`, dan menghubungkan username ke `radusergroup` sesuai Paket Internet yang dipilih.
- **Pelanggan Suspended / Disabled**: Menulis `radcheck` (`Auth-Type := Reject`), password lama tetap disimpan agar ketika diaktifkan kembali tidak perlu reset password.
- **Session Control (`Simultaneous-Use`)**: Menulis `radcheck` `Simultaneous-Use` := `1` (Single Session) atau `maxSimultaneous` (Multi Session).
- **NAS Whitelist Binding & Failover (`radnasallow`)**: Otomatis menulis baris seluruh router IP yang tergabung dalam `profileGroup` pelanggan ke tabel `radnasallow`. FreeRADIUS mengevaluasi policy `check_nas_binding` untuk memastikan dial-in hanya dari router yang diizinkan di wilayah tersebut. Jika salah satu router padam, dial PPPoE otomatis beralih ke router lain di wilayah yang sama tanpa intervensi admin.
- **SQL IP Pool Sync (`radippool`)**: Saat `PppProfile` dengan `ipModule = "sql"` dibuat/diupdate, `syncPppProfileIpPool` otomatis menghitung rentang IPv4 (`rangeIpStart` s.d `rangeIpEnd`) dan menulis baris IP ke tabel `radippool`. Saat dial PPPoE, `sqlippool` mengalokasikan IP dan menyematkan `Framed-IP-Address` dinamis, serta melepaskannya kembali saat `Accounting-Stop`.
- **Profil Bandwidth Terpusat (`radgroupreply`)**: Menulis atribut `Mikrotik-Rate-Limit` ke tabel `radgroupreply` berdasarkan nama Paket Internet (`InternetProfile`).
- **Bulk Internet Profile Sync**: Saat konfigurasi bandwidth atau Internet Profile diedit/di-rename, `syncInternetProfileRadiusBulk` memperbarui atribut `Mikrotik-Rate-Limit` di `radgroupreply` secara terpusat dan menyelaraskan `radusergroup` seluruh pelanggan terkait.
- **Router NAS**: Menulis/memperbarui baris pada tabel `nas` untuk dibaca oleh FreeRADIUS (`read_clients = yes`).

### B. Format MikroTik QoS Rate-Limit (`src/lib/radius-format.ts`)
Atribut `Mikrotik-Rate-Limit` disusun dengan format baku posisional 6 parameter RouterOS (parameter yang tidak diisi menggunakan placeholder `0/0`):
$$\text{RateLimit} = \text{rx/tx [burst-limit] [burst-threshold] [burst-time] [priority] [limit-at (CIR)]}$$
- **Contoh Lengkap (All filled)**: `1m/1m 1100k/1100k 512k/512k 10/10 8 1m/1m`
- **Contoh Max + CIR (Tanpa Burst)**: `1m/1m 0/0 0/0 0/0 8 500k/500k`
- **Contoh Hanya Max**: `1m/1m 0/0 0/0 0/0 8 0/0`

### C. Client API MikroTik Native & Auto-Sync Profile (`src/lib/mikrotik-client.ts` & `src/lib/mikrotik-profile.ts`)
- Menggunakan implementasi protokol binari API RouterOS mandiri melalui koneksi raw TCP Socket (port 8728), mendukung RouterOS v6 dan v7 (termasuk penanganan respon `!empty` dan MD5 challenge/plaintext login).
- **Auto-Sync Service Profile (Idempotent)**:
  - Untuk **PPP (PPPoE)**: Sinkronisasi ke `/ppp/profile` (`name`, `local-address`, `remote-address="none"`, `dns-server`, `session-timeout`, `idle-timeout`, `parent-queue`, `insert-queue-before`).
  - Untuk **Hotspot**: Sinkronisasi ke `/ip/hotspot/user/profile` (`name`, `address-pool`, `session-timeout`, `idle-timeout`, `keepalive-timeout`, `parent-queue`, `insert-queue-before`, `mac-cookie-timeout`, `shared-users`).
  - **Pencegahan Timeout & Skiping Offline**: Setiap pemanggilan sinkronisasi ke router menggunakan timeout 10 detik dan otomatis melewati (skip) router berstatus offline tanpa membuat antrean stuck.
  - **Pembersihan Bersih (Clean Removal)**: Saat profil dihapus atau wilayah di-uncheck dari router/profil, profil pada router target otomatis dihapus via API RouterOS agar router NAS tetap bersih.
- **Dynamic Profile Binding via RADIUS**: FreeRADIUS mengirimkan atribut `Mikrotik-Group` yang otomatis mencocokkan sesi PPPoE login ke Profile di router MikroTik.

### D. Live Sesi, History Accounting & Pembersihan Sesi Zombie (`src/lib/radacct-sessions.ts`, `src/lib/radacct-cleanup.ts`, `src/lib/usage-real.ts`)
- **Pembacaan Sesi Aktif Presisi**: Sesi aktif dibaca langsung dari tabel `radacct` (`acctStopTime IS NULL`). Durasi real-time dan estimasi pertumbuhan byte upload/download dihitung dari `acctUpdateTime` terakhir secara deklaratif tanpa layout shift.
- **Server Reception Timestamping FreeRADIUS (`%l`)**: Modul SQL FreeRADIUS dikonfigurasikan dengan `event_timestamp_epoch = "%l"` dan `event_timestamp = "TO_TIMESTAMP(%l)"` agar seluruh timestamping sesi di database (`acctstarttime`, `acctupdatetime`, `acctstoptime`) murni menggunakan jam server aplikasi, mencegah distorsi timestamp akibat perbedaan timezone atau jam internal router MikroTik.
- **Pembersihan Otomatis Sesi Zombie Terjadwal (`cleanupZombieSessions`)**:
  - Poller background (`src/lib/mikrotik-sync.ts`) dijalankan setiap 30 detik via `instrumentation.ts` dan otomatis mengeksekusi `cleanupZombieSessions(3)`.
  - Sesi yang tidak menerima `Interim-Update` > 3 menit otomatis ditutup dengan status `acctterminatecause = 'Lost-Carrier'` dan `acctstoptime` dinormalisasi ke waktu nyata.
  - Alokasi IP dinamis yang kadaluarsa pada tabel `radippool` otomatis dibersihkan dan dilepaskan kembali ke pool.
- **Proteksi `Simultaneous-Use` Bebas Macet**: Query `simul_count_query` dan `simul_verify_query` di FreeRADIUS otomatis mengabaikan sesi menggantung (> 3 menit tanpa update) sehingga pelanggan yang mati lampu atau restart router dapat langsung dial-in ulang dengan sukses tanpa terhalang error limit sesi aktif.
- **Riwayat Statistik Presisi**: Riwayat grafik 30 hari harian dan 12 bulan bulanan dihitung secara presisi dari data agregasi byte `radacct` tanpa data sintetik.

---

## 5. Pemetaan Rute Frontend & URL State (`nuqs`)

### A. Rute Aplikasi

| Modul | Route Dashboard | Route Portal Pelanggan | Keterangan & Proteksi |
|---|---|---|---|
| **Autentikasi** | `/login` | `/portal/login` | Login user sistem / login self-care portal |
| **Dashboard** | `/dashboard` | `/portal` | Ringkasan statistik operasional / status langganan |
| **Pelanggan** | `/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit` | — | Manajemen data teknis & PPPoE pelanggan |
| **Paket & Layanan: Profil Layanan** | `/profiles`, `/profiles/new`, `/profiles/[id]/edit` | — | Profil node MikroTik PPP & Hotspot (Gateway IP, Pool IP, Queue & Timeout) |
| **Paket & Layanan: Paket Internet** | `/internet-profiles`, `/internet-profiles/new`, `/internet-profiles/[id]/edit` | — | Produk paket internet, harga bulanan, bandwidth & priority |
| **Paket & Layanan: Bandwidth** | `/bandwidths`, `/bandwidths/new`, `/bandwidths/[id]/edit` | — | Konfigurasi kecepatan (MIR/CIR) & Burst QoS |
| **Paket & Layanan: Wilayah (Area Group)** | `/profile-groups`, `/profile-groups/new`, `/profile-groups/[id]/edit` | — | Pengelompokan wilayah & zona failover multi-router (server-side search & pagination) |
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
| `search` | `parseAsString.withDefault("")` | Keyword pencarian teks | customers, sessions, billing, users, logs, profiles |
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

GET    /api/v1/profiles                      -> List Profil Layanan Node (PPP / Hotspot, search, serviceType, page, limit)
POST   /api/v1/profiles                      -> Tambah Profil Layanan (+ IP Pool + auto-sync ke RouterOS)
GET    /api/v1/profiles/:id                  -> Detail Profil Layanan Node
PUT    /api/v1/profiles/:id                  -> Update Profil Layanan (+ auto-sync update/rename ke RouterOS)
DELETE /api/v1/profiles/:id                  -> Hapus Profil Layanan (+ cleanup IP Pool & remove dari RouterOS)

GET    /api/v1/internet-profiles             -> List Paket Internet (+ customerCount)
POST   /api/v1/internet-profiles             -> Tambah Paket Internet (Bandwidth + Harga + Priority)
GET    /api/v1/internet-profiles/:id         -> Detail Paket Internet
PUT    /api/v1/internet-profiles/:id         -> Update Paket Internet (+ bulk radsync ke pelanggan)
DELETE /api/v1/internet-profiles/:id         -> Hapus Paket Internet (ditolak jika masih dipakai pelanggan)

GET    /api/v1/bandwidths                    -> List konfigurasi bandwidth (+ internetProfileCount)
POST   /api/v1/bandwidths                    -> Tambah bandwidth baru (CIR/MIR + all-or-nothing Burst QoS)
GET    /api/v1/bandwidths/:id                -> Detail bandwidth
PUT    /api/v1/bandwidths/:id                -> Update bandwidth (+ bulk radsync ke seluruh Paket Internet terkait)
DELETE /api/v1/bandwidths/:id                -> Hapus bandwidth (ditolak jika masih digunakan Paket Internet)

GET    /api/v1/profile-groups                -> List wilayah / area group (+ list routers & profiles)
POST   /api/v1/profile-groups                -> Tambah wilayah (+ multi-router & multi-profile linking + auto-sync)
GET    /api/v1/profile-groups/:id            -> Detail wilayah (Area Group)
PUT    /api/v1/profile-groups/:id            -> Update wilayah (+ auto-sync & auto-cleanup router/profil yang di-uncheck)
DELETE /api/v1/profile-groups/:id            -> Hapus wilayah (ditolak jika masih ada pelanggan terdaftar)

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

- **Formatting & Linting**: Biome (`bun run lint:fix` / `bunx biome check --write .`). Jangan gunakan ESLint/Prettier.
- **Type Checking**: `bun run typecheck` (`bunx tsc --noEmit`).
- **Database Migration**: Gunakan `bunx prisma migrate dev` (DILARANG menggunakan `db push`).
- **UI Layout Standard**: Semua form tambah/edit menggunakan layout `w-full` dengan responsive multi-column grid (`lg:grid-cols-2`).
- **UI Components**: shadcn/ui + Radix UI + Lucide React + Sonner (toast).
- **Format Mata Uang & Angka**: `formatRupiah()`, `formatBytes()`, `formatDuration()`, `formatDate()` di `@/lib/utils`.
- **ID Generator**: Konsisten menggunakan prefix domain: `cust-<ts>`, `prof-<ts>`, `ppp-<ts>`, `grp-<ts>`, `nas-<ts>`, `inv-<ts>`, `pay-<ts>`, `usr-<ts>`, `role-<ts>`.

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
    list: (params) => ["customers", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["customers", "detail", id] as const,
    activeSession: (id) => ["customers", "active-session", id] as const,
    sessions: (id, filter) => ["customers", "sessions", id, ...(filter ? [filter] : [])] as const,
  },
  bandwidths: {
    all: ["bandwidths"] as const,
    list: (params) => ["bandwidths", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["bandwidths", "detail", id] as const,
  },
  profileGroups: {
    all: ["profile-groups"] as const,
    list: (params) => ["profile-groups", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["profile-groups", "detail", id] as const,
  },
  internetProfiles: {
    all: ["internet-profiles"] as const,
    list: (params) => ["internet-profiles", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["internet-profiles", "detail", id] as const,
  },
  profiles: {
    all: ["profiles"] as const,
    list: (params) => ["profiles", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["profiles", "detail", id] as const,
  },
  routers: {
    all: ["routers"] as const,
    list: (params) => ["routers", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["routers", "detail", id] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    list: (params) => ["sessions", "list", ...(params ? [params] : [])] as const,
  },
  billing: {
    all: ["billing"] as const,
    invoices: (params) => ["billing", "invoices", ...(params ? [params] : [])] as const,
    payments: (params) => ["billing", "payments", ...(params ? [params] : [])] as const,
    detail: (id) => ["billing", "detail", id] as const,
    summary: ["billing", "summary"] as const,
    months: ["billing", "months"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params) => ["users", "list", ...(params ? [params] : [])] as const,
    detail: (id) => ["users", "detail", id] as const,
  },
  roles: {
    all: ["roles"] as const,
    detail: (id) => ["roles", "detail", id] as const,
  },
  logs: {
    all: ["logs"] as const,
    list: (params) => ["logs", "list", ...(params ? [params] : [])] as const,
  },
  settings: {
    company: ["settings", "company"] as const,
    waTemplate: ["settings", "waTemplate"] as const,
  },
  portal: {
    me: ["portal", "me"] as const,
  },
};
```

### C. Aturan Invalidation & Flicker-Free Mutasi (`src/lib/api/hooks/*`)
- **Mutasi Customer**: Meng-invalidate `queryKeys.customers.all`, `queryKeys.dashboard`, `queryKeys.profiles.all`, dan `queryKeys.routers.all`.
- **Mutasi Profile (Node PPP & Hotspot)**: Meng-invalidate `queryKeys.profiles.all`, `queryKeys.customers.all`, dan `queryKeys.dashboard`.
- **Mutasi Internet Profile (Paket Internet)**: Meng-invalidate `queryKeys.internetProfiles.all`, `queryKeys.customers.all`, dan `queryKeys.billing.all`.
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
bunx prisma migrate dev
bun run db:seed

# 3. Jalankan Aplikasi Next.js Development Server
bun dev

# 4. Verifikasi & Perbaikan Kode (Wajib jalankan sebelum submit)
bun run lint:fix
bun run typecheck

# 5. Uji Otentikasi RADIUS via Container
docker exec microrad-freeradius sh -c \
  'echo "User-Name=budi_santoso, User-Password=pass123" | radclient 127.0.0.1 auth testing123'
```