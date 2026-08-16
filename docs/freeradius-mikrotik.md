# MicroRAD — Integrasi FreeRADIUS + MikroTik (PPPoE & Accounting)

Arsitektur komunikasi antara aplikasi MicroRAD (Next.js + Prisma/Postgres),
FreeRADIUS v3, dan MikroTik RouterOS — beserta cara menjalankan & menguji.

## Topologi

```
┌──────────────────────────────────────────────────────────────────┐
│  Docker Compose (microrad-net 172.30.0.0/24)                     │
│                                                                  │
│  postgres:16 (172.30.0.2 / localhost:5432)                      │
│    └─ database microrad — tabel aplikasi + tabel RADIUS          │
│       (radcheck/radreply/radgroup*/radusergroup/radacct/         │
│        radpostauth/nas)                                          │
│                                                                  │
│  freeradius (172.30.0.3 / localhost:1812-1813 udp)              │
│    └─ Dockerfile custom: alpine + freeradius-postgresql          │
│       sql module read_clients=yes (client dari tabel nas)        │
│                                                                  │
│  chr (mikrotik/chr, opsional untuk uji) — RouterOS 7             │
└──────────────────────────────────────────────────────────────────┘

  Aplikasi (host, Next.js) ──► MikroTik nyata (API TCP 8728, node-routeros
       │                        atau protokol binari sendiri)
       │
       └──► FreeRADIUS :1812/udp (auth) + :1813/udp (accounting)
```

## Alur data

1. **Autentikasi PPPoE** — MikroTik (RADIUS client) → FreeRADIUS (server).
   FreeRADIUS membaca `radcheck` (Cleartext-Password) & `radreply`
   (Framed-IP-Address, Mikrotik-Rate-Limit) dari DB yang sama dengan aplikasi.
   Hasil login dicatat ke `radpostauth`.

2. **Accounting** — MikroTik kirim Acct-Start / Interim-Update / Acct-Stop →
   FreeRADIUS tulis `radacct` (durasi, input/output octets, terminate cause).

3. **Sesi live & traffic** — Poller aplikasi (`src/lib/mikrotik-sync.ts`,
   dijalankan dari `src/instrumentation.ts`) tiap `MIKROTIK_SYNC_INTERVAL_MS`
   (default 10s) membaca `/ppp/active/print` dari MikroTik via API, lalu
   **diff** terhadap tabel `session`:
   - CREATE — sesi ada di router tapi belum di DB (id `sess-<nasId>-<session-id>`)
   - UPDATE — snapshot bytes/durasi
   - CLOSE — sesi hilang dari router → `stoppedAt` (cause dari `radacct` atau
     `Lost-Carrier`)
   Router yang tidak terjangkau → `status: offline`.

4. **Kick / Disconnect** — tombol putus di aplikasi memanggil API RouterOS
   `/ppp/active/remove` (by username), lalu tutup record DB.

5. **radsync** — setiap CRUD pelanggan/profil/router menulis tabel RADIUS
   secara atomik (lihat `src/lib/radsync.ts`): pelanggan → radcheck/radreply,
   perubahan rate-limit profil → Mikrotik-Rate-Limit massal, router →
   row `nas` (read_clients FreeRADIUS).

## Menjalankan

```bash
# 1. Infrastruktur
docker compose up -d --build

# 2. DB + seed (dari host)
bunx prisma migrate deploy
bun prisma/seed.ts

# 3. Aplikasi
bun dev
```

## Konfigurasi router di aplikasi

1. **Router NAS → Edit/Baru**:
   - IP Address = IP MikroTik (mis. `10.90.20.238`)
   - API Username/Password = kredensial admin API RouterOS (bukan password
     router default kosong — set dulu)
   - API Port = 8728 (REST 8729 jika pakai TLS)
   - RADIUS Secret = shared secret yang SAMA dengan FreeRADIUS (`nas.secret`)
   - simpan → otomatis daftarkan row `nas` + trigger reload FreeRADIUS

2. **Hubungkan ke FreeRADIUS** (tombol di halaman Router NAS):
   menjalankan di MikroTik:
   ```
   /radius add service=ppp address=<FREERADIUS_IP> secret=<secret>
   /ppp aaa set use-radius=yes accounting=yes interim-update=1m
   ```
3. **Test Ping** — koneksi API nyata + identity.
4. **Sinkronkan Sekarang** — sync manual satu router; toast menampilkan
   jumlah dibuat/diperbarui/ditutup.

## FreeRADIUS config overlay (docker/freeradius/)

- `Dockerfile` — alpine:3.21 + `freeradius freeradius-postgresql freeradius-utils`
- `mods-enabled/sql` — file penuh (bukan symlink): `read_clients = yes`,
  `read_groups = no`, `$INCLUDE ${modconfdir}/.../queries.conf`,
  definisi tabel sebelum include
- `clients.conf` — localhost + subnet docker (secret testing123)
- `entrypoint.sh` — tunggu postgres, sed kredensial DB, `radiusd -C`, `radiusd -f`

> Catatan penting: kolom tabel `radacct`/`radpostauth` harus **lowercase**
> persis hasil unquote `schema.sql` resmi FreeRADIUS (PostgreSQL men-fold
> identifier tanpa tanda kutip ke lowercase). Jangan ganti ke mixed-case.

## Uji cepat

```bash
# Auth (harus Access-Accept)
docker exec microrad-freeradius sh -c \
  'echo "User-Name=budi_santoso, User-Password=pass123" | radclient 127.0.0.1 auth testing123'

# Accounting start→stop → cek radacct
docker exec microrad-freeradius sh -c \
  'echo "Acct-Status-Type=Start, User-Name=budi_santoso, Acct-Session-Id=T1, Acct-Unique-Session-Id=U1, NAS-IP-Address=192.168.88.1" | radclient 127.0.0.1 acct testing123'
docker exec microrad-postgres psql -U microrad -d microrad \
  -c 'select username, acctsessionid, acctstarttime from radacct order by radacctid desc limit 3;'

# Reload FreeRADIUS setelah ubah secret/nas
curl -X POST http://localhost:3000/api/v1/radius/reload  # (auth admin)
```

## Router rumah (dev nyata)

- Router: `10.90.20.238`, API user `***` / `****`, RouterOS 7.22.2.
- `/ppp/active/print` mengembalikan `!empty` bila tidak ada sesi aktif.
- Untuk uji sesi live penuh, jalankan dial PPPoE nyata (atau di lab/virtual)
  lalu amati halaman Sesi (auto-refresh 6 detik).

## Risiko & catatan

- `node-routeros` v1.6.9 tidak dapat mem-parse reply `!empty`/`!re` dari
  RouterOS 7 → kami implementasi protokol binari sendiri di
  `src/lib/mikrotik-client.ts` (tanpa dependency).
- REST API RouterOS (`/rest/*`) alternatif jika API TCP bermasalah; perlu
  `www-ssl` aktif.
- Docker Desktop/Windows: CHR butuh `privileged`; koneksi ke router rumah
  via host network biasa (bukan docker network).
