<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MicroRAD PPPoE Manager — Arsitektur Frontend

Frontend Next.js App Router (v16) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Biome, dengan **mock data di browser (localStorage)** — saat ini **belum ada backend**. Dokumen ini adalah kontrak perilaku yang menjadi acuan untuk membangun backend asli (API + database) agar frontend dapat berjalan tanpa perubahan.

## 1. Maping Modul → Halaman → Sumber Data

| Modul | Route | Data Utama | Sumber Data |
|---|---|---|---|
| Dashboard | `/dashboard` | `DashboardStats` + chart | `getDashboardStats()` |
| Pelanggan | `/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit` | `Customer` | `api/customers.ts` → `MockDatabase` (key `microrad_customers`) |
| Profil Bandwidth | `/profiles`, `/profiles/new`, `/profiles/[id]/edit` | `BandwidthProfile` | `api/profiles.ts` → `MockDatabase` (key `microrad_profiles`) |
| Router NAS | `/routers`, `/routers/new`, `/routers/[id]/edit` | `NasRouter` | `api/routers.ts` → `MockDatabase` (key `microrad_routers`) |
| Sesi PPPoE | `/sessions` | `Session` | `api/sessions.ts` → `MockDatabase` (key `microrad_sessions`) |
| Billing & Tagihan | `/billing`, `/billing/[id]` | `Invoice`, `PaymentRecord` | `api/billing.ts` — **storage terpisah** (key `microrad_invoices_mock`, `microrad_payments_mock`) |
| Pengguna App | `/users`, `/users/new`, `/users/[id]/edit` | `AppUser` | `api/users.ts` → `MockDatabase` (key `microrad_users`) |
| Role & Permission | `/roles` | `Role` | `api/roles.ts` → `MockDatabase` (key `microrad_roles`) + `BUILT_IN_ROLES` |
| Log Global | `/logs` | `GlobalLogEntry` | `api/logs.ts` → `MockDatabase.getGlobalLogs()` (`mock/global-logs.ts`) |
| Pengaturan | `/settings` | `CompanyProfile` | `api/settings.ts` → `MockDatabase` (key `microrad_company_profile`) |
| Portal Pelanggan | `/portal`, `/portal/billing`, `/portal/payments`, `/portal/usage`, `/portal/logs` | `CustomerPortalData` | `api/customer-portal.ts` (agregat dari beberapa sumber) |
| Login | `/login` | `AppUser` | `lib/auth.ts` (key `microrad_auth_user`) |

## 2. Model Data (src/lib/types.ts)

Semua entity didasarkan pada skema FreeRADIUS/PRD. Field penting untuk backend:

- **Customer** — `id, username (radcheck.username — UNIK), password?, fullName, email, phone, address, status (active|suspended|disabled), profileId → BandwidthProfile, staticIp?, nasId?, createdAt, updatedAt, lastSeenAt?, currentSessionId?`
- **BandwidthProfile** — `id, name, rateLimitDown (Mbps), rateLimitUp (Mbps), price? (IDR), customerCount (DERIVED, dihitung ulang dari customers)`
- **NasRouter** — `id, name, ipAddress (nasname), type: "mikrotik", status (online|offline|unknown), activeSessionCount (DERIVED)`
- **Session** — `id, customerId, customerUsername, nasId, nasIpAddress, framedIp?, startedAt, stoppedAt? (undefined = masih online), durationSeconds, inputBytes (AcctInputOctets), outputBytes (AcctOutputOctets), terminateCause?`
- **Invoice** — lihat §4.
- **PaymentRecord** — `id, invoiceId, invoiceNumber, customerId, customerName, amount, paymentMethod (qris|transfer_bca|transfer_mandiri|transfer_bri|cash|other), paymentReference?, paidAt, receivedBy, notes?`
- **AppUser** — `id, name, email (UNIK), role (admin|operator|customer — legacy), roleId? (RBAC → Role), status (active|disabled), createdAt, lastLoginAt?, customerId?`
- **Role** — `id, name, description?, permissions: Permission[], system: boolean, createdAt, updatedAt`
- **Permission** — format `"<resource>.<action>"`; resources: `customer, billing, session, profile, router, user`; actions: `read, create, update, delete` + `log.read`, `setting.read`, `setting.update` (27 total)
- **CompanyProfile** — `brandName, fullName, address?, phone?, email?, website?, npwp?, licenseNo?, updatedAt?`
- **BillingSummary** — `totalRevenueThisMonth, totalPendingAmount, totalOverdueAmount, paidCount, unpaidCount, overdueCount, totalInvoicesCount` (hitung dari status invoice periode berjalan + total semua periode)

ID dibuat di sisi "server mock": `cust-<ts>`, `prof-<ts>`, `nas-<ts>`, `usr-<ts>`, `role-<ts>`, `inv-<ts>`, `pay-<ts>`. Tanggal memakai **ISO 8601** (`new Date().toISOString()`); `createdAt`/`updatedAt` wajib di-set oleh backend, bukan oleh klien.

## 3. Pola API (src/lib/api/*) — bentuk kontrak backend

- Setiap fungsi **async** dengan `delay(ms)` buatan (120–300ms) untuk simulasi latensi → backend asli adalah REST endpoint yang dipanggil dari fungsi yang sama.
- List: `getX()` → array; detail: `getXById(id)` → `X | null`.
- Create: kirim `Omit<X, "id" | "createdAt" | "updatedAt" | derived>`, backend yang set id/timestamp → error `throw new Error("...")` (ditampilkan via `getErrorMessage`).
- Update: `updateX(id, Partial<X>)` → patch parsial, `updatedAt` di-set backend.
- Delete: `deleteX(id)` → `{ success: boolean }`, error di-throw bila gagal.
- Pelanggan: cek **uniqueness username on create & update**; profil: **prevent delete bila masih dipakai pelanggan** (`deleteProfile` error API); router: prevent delete bila ada sesi aktif; user: prevent delete **pengguna terakhir** (`users.length <= 1`); deleteCustomer memutus sesi aktif pelanggan terlebih dahulu.
- Sesi aktif di-read berupa "live": durasi dan trafik dihitung ulang terhadap `Date.now()` (tanpa persist).

## 4. Module Billing (paling kompleks) — aturan bisnis yang wajib dipindah ke backend

Nomor invoice: `INV/<year>/<MM>/<seq:`03d>` — seq = jumlah invoice pada periode itu + 1.

**Aturan jatuh tempo** (kunci, sudah dua kali dikoreksi user):

```
due date = tanggal-hari terakhir periode target + 1 bulan
hari = tanggal registrasi (createdAt) pelanggan, fallback 10
jam = 23:59:59
```

`getDueDateFromPeriod(year, month, createdAt?)` di `api/billing.ts`:
- `month` 1-based; `new Date(year, month, ...)` otomatis = bulan berikutnya (periode+1); Desember → tahun+1.
- Normalisasi overflow: `if (due.getMonth() !== month % 12) { due.setDate(0); due.setHours(23,59,59,0) }` (mis. registrasi tgl 31 → 31 Feb melimpah, force ke hari terakhir Feb).

**Validasi duplikat** (create invoice manual & generate massal):
- Per pasangan `(customerId, periodYear, periodMonth)` — 1 invoice per pelanggan per periode.
- Manual: cek di client dulu, lalu jadi error dari `createInvoice` bila lolos.
- Generate massal: skip diam-diam (tidak error), dilaporkan sebagai `skippedCount` di toast.

**Komposisi invoice** (hitung di server, frontend hanya menampilkan hasil):
- `subtotal` (harga paket, autofill dari `BandwidthProfile.price`)
- `tax = round(subtotal × taxPercent / 100)`; `taxPercent` input 0–100 (validasi di client dan backend)
- `adminFee` (default 2500)
- `installationFee` (default 0)
- `discount` (potongan, default 0)
- `totalAmount = max(0, subtotal + tax + adminFee + installationFee − discount)`

**Karena invoice & payments disimpan di storage TERPISAH dari db utama**, `resetToDefaults()` (Reset Demo) wajib juga menghapus `microrad_invoices_mock`, `microrad_payments_mock`, dan `microrad_roles`.

**markInvoiceAsPaid(id, {paymentMethod, paymentReference?, paidAt?, notes?})**:
- Invoice lama yang berstatus `paid` memakai field `paymentMethod` — kolom itu sendiri berevolusi jadi field pada PaymentRecord (lihat §2).
- Update status invoice → `paid`, set `paidAt`, `paymentMethod`, `paymentReference` (fallback `PAY-<6digit>` jika kosong), `notes` → **tambahkan PaymentRecord** (histori pembayaran!) — 2 write bersamaan, wajib transaksional di backend.

**Bulk generate** (`bulkGenerateInvoices(month, year)`) → `{createdCount, failedCount, skippedCount, invoices}`:
- Hanya pelanggan `status === "active"`.
- Skip bila sudah ada invoice periode tsb (di-hitung sebagai `skippedCount`).
- Gagal bila pelanggan aktif tanpa profil valid (`failedCount`).
- Tidak pakai PPN (tax=0), `installationFee=0`, hanya `subtotal + adminFee`.
- Toast di client melaporkan: "X berhasil dibuat, Y gagal, Z di-skip (sudah ada)".

**sendInvoiceReminder(id)** → `{success, message, phone, text}`: pesan WhatsApp via template editan (key `microrad_wa_template`, **tidak dihapus saat reset**). Variabel: `$USER` (fullName fallback username), `$BRAND` (dari CompanyProfile), `$PROFILE`, `$PERIOD` ("Bulan Agustus 2026"), `$TOTAL` (format Rupiah id-ID), `$INVOICE`, `$DUE`. Default template ada di `components/billing/reminder-dialog.tsx`.

**BillingSummary** dihitung dari seluruh invoice: revenue bulan berjalan = invoice `paid` di (periodMonth, periodYear) sekarang; "tertunggak" = `unpaid` (dihitung hanya untuk periode berjalan), "overdue" = `overdue`.

## 5. Tanggal Relatif Mock (penting saat migrasi data)

File `mock/*.mock.ts` menyimpan tanggal sebagai string literal `relMonthsAgoIso(<bulan>, <tanggal>, <menit>)` / `relNowIso(<hari>, <menit>)` (lihat `mock/relative-dates.ts`) **hanya di file source**. Setelah diserialisasi / dibaca dari localStorage, string-string itu **tidak lagi tervalidasi**:
- `db.ts` punya `resolveMockDates()` yang mengubahnya menjadi ISO saat data dimuat.
- `api/billing.ts` punya `resolveMockDateString()` (regex sama, dipakai untuk `createdAt` pelanggan saat menghitung due date).

Bila data dipindah ke database asli, tanggal harus sudah berupa **timestamp absolut** — fungsi resolve ini tidak perlu dibawa ke backend.

## 6. Filter & Pagination via nuqs (query string = kontrak URL)

Semua filter & pagination live di URL query string (bisa di-bookmark/share, konsisten saat refresh) — ini pola yang **harus diteruskan ke URL param API backend**:

```
/getInvoices?page=1&limit=10&search=&status=paid&month=8&paysearch=&tab=invoices
```

Konvensi (`useQueryState(key, parser)`):

| Key | Parser | Nilai | Dipakai di |
|---|---|---|---|
| `page` | `parseAsInteger.withDefault(1)` | halaman aktif | semua tabel |
| `limit` | `parseAsInteger.withDefault(10).withOptions({ history: "replace" })` | baris/halaman (10/25/50, clamp 1–50) | semua tabel |
| `search` | `parseAsString.withDefault("")` | keyword | customers, sessions, users, billing, logs |
| `status` | `parseAsString.withDefault("all")` | filter status | customers, users, billing (invoice status), logs (source) |
| `profile` | `parseAsString.withDefault("all")` | filter profil | customers |
| `router` | `parseAsStringEnum([...ipAddress]).withDefault("all")` | filter NAS by IP | sessions |
| `role` | `parseAsString.withDefault("all")` | filter role | users |
| `month` | `parseAsString.withDefault("all")` | filter bulan periode (opsi dinamis dari data!) | billing |
| `paysearch` | `parseAsString.withDefault("")` | pencarian khusus tab pembayaran | billing |
| `tab` | `parseAsString.withDefault("invoices" / "overview" / "daily")` | tab aktif | billing, customer detail, portal usage |
| `year` | `parseAsInteger.withDefault(currentYear)` | filter grafik per tahun | customer detail, portal usage |
| `from` / `to` | `parseAsString.withDefault("")` | rentang tanggal log (to = sampai 23:59:59) | logs |

Perilaku yang harus dijaga:
- Uriah utama `filteredX` dihitung **di client** dari semua data (mock memuat semua); backend asli bisa menggantinya dengan query SQL — asalkan hasil akhirnya sama (filter AND + pagination).
- Rute yang memakai `useQueryState` **wajib dibungkus `<Suspense>`** (mis. billing `export default` membungkus `BillingContent` dengan `<Suspense>`), karena nuqs membutuhkan konteks React.
- Filter bulan billing **dinamis dari data**, bukan hardcoded: opsi di-generate dari `new Set(invoices.map(inv => inv.periodMonth))`. Perlu dipindahkan ke backend: `GET /invoices/distinct-months` atau disertakan dalam respons list.
- Saat aksi menambah data (create/bulk), halaman **reset ke `page=1`** dan fungsi read data dipanggil ulang (sumber kebenaran tunggal: storage/backend), bukan rely pada argumen callback.
- `safeLimit = Math.min(Math.max(limit, 1), 50)`; `safePage = Math.min(Math.max(page, 1), totalPages)`; `totalPages = Math.ceil(filtered.length / safeLimit) || 1`.

## 7. RBAC — aturan otorisasi

- **Role bawaan** (`BUILT_IN_ROLES` di `lib/rbac.ts`, id `role-admin`, `role-manager`, `role-customer`) tidak tersimpan di localStorage — tidak bisa dihapus. Role kustom simpan di key `microrad_roles` (filter `!system`).
- `getUserRoleById(roleId)` = role kustom dari localStorage jika ada, else fallback `BUILT_IN_ROLES`.
- `hasPermission(user, perm)`: **advisor terkenal**: role `role-admin` → selalu `true`; role lain harus punya permission eksplisit di daftarnya.
- **Pembatasan rute** (`canAccessRoute(user, pathname)` di `dashboard/layout.tsx`):
  - `role-customer` → hanya `/portal/*`.
  - `role-admin` → semua jalur KECUALI `/portal`.
  - `/roles` dan `/settings` → admin-only.
  - `/logs` → butuh `log.read`.
  - Rute detail/mutasi: `/customers/new` → `customer.create`, `/customers/:id` (read) → `customer.read`, dst. (lihat `routeToResource` & `routeMutation` di `lib/rbac.ts`).
- Server asli: **selalu** verifikasi permission di tiap endpoint (frontend hanya menyembunyikan tombol; bukan pengaman).

## 8. Autentikasi & Portal Pelanggan

- Auth murni client: `lib/auth.ts` key `microrad_auth_user` (AppUser). `useAuth()` expose `currentUser, isLoading, isAuthenticated, isAdmin, login, logout`. Default login: user pertama `initialUsers[0]` (admin@microrad.net, role admin). **Tidak ada password** — mock.
- Arah ke depan: backend dengan session/JWT; data AppUser harus match struktur di §2.
- Login di page `/login` → simpan user via `setStoredUser()` → layout dashboard redirect kalau belum login.
- Portal pelanggan: `PortalLayout` (layout `/portal`) memanggil `getCustomerPortalData(user)` → cari customer via `user.customerId` (prioritas) atau fallback email sama dengan `customer.email`. Bungkus data di `PortalContext`; halaman anak pakai `usePortal()` → `{data, loading, refreshing, reload}`.
- `getCustomerPortalData` return `{customer, profile, summary, usageHistory, invoices, payments, sessions, loginLogs, sessionLogs}`. Ini kontrak endpoint `GET /portal/me` (atau sejenisnya) — semua data milik customer login.
- `CustomerPortalSummary`: `totalUsage30dBytes, totalDownload30dBytes, totalUpload30dBytes, onlineSessionCount, onlineNow, totalPaidAmount, totalOutstandingAmount, activeInvoiceCount`.

## 9. Utilitas & Konvensi

- Formatting wajib konsisten: `formatRupiah` (Intl id-ID IDR), `formatDate` (id-ID), `formatBytes` (1024-base), `formatDuration` (human), `formatRelativeTime`, `getErrorMessage` — `src/lib/utils.ts`.
- `StatusBadge` status invoice: `paid | unpaid | overdue | cancelled`; status customer: `active | suspended | disabled`.
- UI: komponen shadcn/ui di `src/components/ui/*`; `ConfirmDialog` untuk aksi destruktif, `EmptyState` untuk tabel kosong, `Skeleton` untuk loading.
- Pencarian/pagination client-side: `filteredX` → `paginatedX` (slice) → render di tabel; footer pagination menu "Menampilkan X–Y dari Z" + Select limit (10/25/50) + tombol Sebelumnya/Selanjutnya.
- Format: `bunx tsc --noEmit` + `bunx biome check --write .` (Biome, bukan ESLint/Prettier).

## 10. Checklist Pembuatan Backend (ringkasan kontrak)

1. REST API mirror dari fungsi di `src/lib/api/*`; tipe response = tipe di `src/lib/types.ts`; error = `{ error: string }` / HTTP status, ditampilkan via `getErrorMessage`.
2. Endpoint list mendukung query params: `search`, `status`, `month`, `profile`, `router`, `role`, `from`, `to`, `page`, `limit` → filter AND + pagination (clamp 1–50).
3. Set `id` (format konsisten), `createdAt`, `updatedAt` di server; hitung field derived (`customerCount`, `activeSessionCount`, `totalAmount`) di server.
4. Uniqueness: `customer.username` (case-insensitive), `user.email`; relasi FK: `customer.profileId`, `session.customerId`, dsb wajib divalidasi.
5. Invoice: uniqueness `(customerId, periodYear, periodMonth)`; due date = periode+1 bulan (hari = tgl registrasi, fallback 10, normalisasi akhir bulan); invoice number `INV/YYYY/MM/SEQ`.
6. Pembayaran & invoice harus **transaksional** (mark paid = update invoice + insert payment record).
7. RBAC dieksekusi server-side (27 permission; admin = semua).
8. `GET /portal/me` (atau sejenisnya) mengembalikan agregat data pelanggan login.
9. Reset demo / seed: bersihkan invoice, payments, roles kustom juga.
10. Dual-write storage mock (utama + billing) hanya untuk pengembangan — backend asli cukup satu sumber data.