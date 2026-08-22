# FreeRADIUS: NAS Binding & Session Control — Implementation Summary

Dokumen ini untuk implementasi 3 fitur di microrad:

1. **Bind user ke satu NAS** (single router lock)
2. **Bind user ke multiple NAS** (whitelist beberapa router)
3. **Session control** — single session (default) atau multi-session (per user, misal 2 device di NAS berbeda)

Target arsitektur: FreeRADIUS jalan di Docker, semua config dinamis dikontrol dari aplikasi Next.js/Bun via Prisma → sync ke MySQL/PostgreSQL yang dipakai FreeRADIUS `sql` module.

---

## 1. Schema Database (Prisma)

Tambahkan ke schema yang sudah ada (asumsi kamu sudah punya tabel `radcheck`, `radreply`, `radacct` standar FreeRADIUS + tabel `Customer`/`PppoeAccount` di sisi aplikasi).

```prisma
// Tabel binding NAS per user — support multiple NAS (whitelist)
model RadNasAllow {
  id            Int      @id @default(autoincrement())
  username      String
  nasipaddress  String
  createdAt     DateTime @default(now())

  @@unique([username, nasipaddress])
  @@index([username])
  @@map("radnasallow")
}

// Tambahan field di model customer/pppoe account kamu
model Customer {
  id               String   @id @default(cuid())
  username         String   @unique
  // ...field existing...

  sessionMode      SessionMode @default(SINGLE) // SINGLE | MULTI
  maxSimultaneous  Int         @default(1)       // dipakai kalau MULTI, misal 2

  allowedNas       RadNasAllow[] @relation("PppoeToNas") // opsional kalau mau relasi langsung
}

enum SessionMode {
  SINGLE
  MULTI
}
```

> Catatan: `RadNasAllow` sengaja dibuat independen dari relasi FK ketat ke `PppoeAccount`, karena FreeRADIUS query langsung ke tabel ini pakai `username` sebagai string — bukan lewat Prisma relation. Jaga konsistensi `username` di kedua tabel lewat aplikasi, bukan FK constraint (karena `radcheck`/`radacct` juga standalone by design).

---

## 2. Konfigurasi FreeRADIUS (file di dalam container/volume)

Struktur folder config biasanya di-mount sebagai volume Docker, contoh:

```yaml
# docker-compose.yml (potongan relevan)
services:
  freeradius:
    image: freeradius/freeradius-server:3.2.6
    volumes:
      - ./freeradius-config/mods-available:/etc/freeradius/3.0/mods-available
      - ./freeradius-config/policy.d:/etc/freeradius/3.0/policy.d
      - ./freeradius-config/sites-available:/etc/freeradius/3.0/sites-available
    ports:
      - "1812:1812/udp"
      - "1813:1813/udp"
      - "3799:3799/udp"  # CoA/Disconnect port, kalau dipakai
```

### 2.1 `mods-available/sql` — aktifkan simultaneous-use checking

Pastikan bagian ini **uncommented** dan sesuai dialek DB kamu:

```
sql {
    ...
    simul_count_query = "\
        SELECT COUNT(*) \
        FROM radacct \
        WHERE username = '%{SQL-User-Name}' \
        AND acctstoptime IS NULL"

    simul_verify_query = "\
        SELECT radacctid, acctsessionid, username, nasipaddress, \
               nasportid, framedipaddress, callingstationid, \
               framedprotocol \
        FROM radacct \
        WHERE username = '%{SQL-User-Name}' \
        AND acctstoptime IS NULL"
    ...
}
```

### 2.2 `policy.d/nasbind` — policy baru, bikin file ini

```
policy check_nas_binding {
    if ("%{sql:SELECT COUNT(*) FROM radnasallow WHERE username='%{SQL-User-Name}'}" > 0) {
        if ("%{sql:SELECT COUNT(*) FROM radnasallow WHERE username='%{SQL-User-Name}' AND nasipaddress='%{Nas-IP-Address}'}" == 0) {
            update reply {
                &Reply-Message := "Login tidak diizinkan dari router ini"
            }
            reject
        }
    }
    # kalau user tidak punya baris di radnasallow → tidak ada restriction, lanjut normal
}
```

> Kalau butuh dukungan single-NAS-bind juga bisa pakai policy yang sama — cukup insert 1 baris ke `radnasallow` untuk user yang di-lock ke 1 router saja. Jadi **tidak perlu policy terpisah** untuk kasus "single NAS" vs "multiple NAS" — keduanya satu mekanisme (tabel `radnasallow` dengan 1 atau lebih baris).

### 2.3 `sites-available/default` — panggil policy & set Simultaneous-Use

Di section `authorize {}`:

```
authorize {
    preprocess
    files
    sql
    check_nas_binding      # <-- tambahkan ini, setelah sql
    eap {
        ok = return
    }
}
```

`Simultaneous-Use` sendiri **tidak perlu ditulis di unlang** — cukup jadi row di `radcheck` per user (lihat bagian 3), FreeRADIUS otomatis baca dari `sql` module.

### 2.4 Reload setelah setiap perubahan config file (jarang, biasanya sekali di awal)

```bash
docker exec <container_freeradius> radiusd -XC   # test config dulu sebelum reload
docker kill -s HUP <container_freeradius>
```

---

## 3. Cara Set Nilai per User (dari Aplikasi)

Perubahan sehari-hari (bind NAS, ganti mode sesi) **tidak butuh reload config file** — cukup insert/update row di `radcheck`/`radnasallow`, karena FreeRADIUS query on-demand tiap request masuk (bukan di-cache seperti `clients.conf`/tabel `nas`).

### 3.1 Set Session Mode

```sql
-- Single session (default, paling umum)
INSERT INTO radcheck (username, attribute, op, value)
VALUES ('customer001', 'Simultaneous-Use', ':=', '1')
ON DUPLICATE KEY UPDATE value = '1';

-- Multi session (misal 2 device boleh connect bersamaan)
INSERT INTO radcheck (username, attribute, op, value)
VALUES ('customer001', 'Simultaneous-Use', ':=', '2')
ON DUPLICATE KEY UPDATE value = '2';
```

### 3.2 Set NAS Binding

```sql
-- Hapus binding lama dulu (biar gampang sinkron dari UI multi-select)
DELETE FROM radnasallow WHERE username = 'customer001';

-- Insert ulang sesuai pilihan user di UI (bisa 1 atau banyak)
INSERT INTO radnasallow (username, nasipaddress) VALUES
  ('customer001', '10.10.1.1'),
  ('customer001', '10.10.1.5');

-- Kalau user tidak boleh dibatasi NAS sama sekali (bebas login dari mana saja):
-- cukup jangan insert apa-apa / DELETE semua baris untuk username tsb
```

### 3.3 Fungsi Sync (pola sama seperti `syncProfileToRadius` yang sudah ada)

```typescript
// lib/radius/sync.ts
import { prisma } from '@/lib/prisma';

export async function syncNasBindingToRadius(username: string, nasIps: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.radNasAllow.deleteMany({ where: { username } });
    if (nasIps.length > 0) {
      await tx.radNasAllow.createMany({
        data: nasIps.map((ip) => ({ username, nasipaddress: ip })),
      });
    }
  });
}

export async function syncSessionModeToRadius(
  username: string,
  mode: 'SINGLE' | 'MULTI',
  maxSimultaneous = 1
) {
  const value = mode === 'SINGLE' ? '1' : String(maxSimultaneous);

  await prisma.$executeRaw`
    INSERT INTO radcheck (username, attribute, op, value)
    VALUES (${username}, 'Simultaneous-Use', ':=', ${value})
    ON DUPLICATE KEY UPDATE value = ${value}
  `;
  // Catatan: radcheck standar tidak punya unique constraint di (username, attribute)
  // secara default — tambahkan constraint ini dulu kalau mau pakai ON DUPLICATE KEY:
  // ALTER TABLE radcheck ADD UNIQUE KEY uq_user_attr (username, attribute);
}
```

> **Tidak perlu reload/restart FreeRADIUS container** untuk kedua fungsi di atas — perubahan langsung berlaku di request berikutnya, karena FreeRADIUS query `radcheck`/`radnasallow` real-time per autentikasi.

---

## 4. Multi-Session dengan Constraint "NAS Berbeda"

Kalau requirement-nya bukan cuma "2 sesi boleh", tapi spesifik **"2 sesi boleh asal di NAS yang berbeda"** (mencegah 1 akun dipakai 2x di NAS yang sama, tapi boleh kalau beda NAS/lokasi) — `Simultaneous-Use` bawaan tidak bisa membedakan ini. Perlu policy tambahan:

```
policy check_multi_session_diff_nas {
    if (&control:Simultaneous-Use && &control:Simultaneous-Use > 1) {
        if ("%{sql:SELECT COUNT(*) FROM radacct WHERE username='%{SQL-User-Name}' AND acctstoptime IS NULL AND nasipaddress='%{Nas-IP-Address}'}" > 0) {
            update reply {
                &Reply-Message := "Sudah ada sesi aktif di router ini"
            }
            reject
        }
    }
}
```

Panggil setelah `check_nas_binding` di `authorize {}`. Ini opsional — hanya perlu kalau requirement bisnisnya memang sespesifik itu.

---

## 5. Rekomendasi Tambahan (Opsional, Prioritas Kedua)

- **CoA/Disconnect-Request**: untuk force-kick sesi lama saat admin ubah `sessionMode` ke `SINGLE` sementara user masih ada 2 sesi aktif — tanpa ini, perubahan cuma berlaku untuk login berikutnya, sesi existing tetap jalan sampai habis sendiri.
- **`checkrad`/SNMP**: FreeRADIUS defaultnya assume sesi masih hidup kalau gagal verifikasi ke NAS — pertimbangkan cron job pembersih baris `radacct` yang stale (`acctstoptime IS NULL` tapi sudah lewat X jam) sebagai pengaman tambahan, independen dari checkrad.
- **UI di aplikasi**: form per customer — multi-select NAS (dropdown dari tabel `nas`/router yang terdaftar) + radio button `Single session` / `Multi session (max: N)`.

---

## 6. Testing Checklist

- [ ] User dengan 1 NAS binding → gagal login dari NAS lain, sukses dari NAS yang di-allow
- [ ] User dengan 2+ NAS binding → sukses login dari kedua NAS tsb
- [ ] User tanpa binding sama sekali → bebas login dari NAS manapun yang terdaftar di `clients.conf`/tabel `nas`
- [ ] `Simultaneous-Use = 1` → login kedua ditolak selama sesi pertama masih `acctstoptime IS NULL`
- [ ] `Simultaneous-Use = 2` → login kedua diterima, ketiga ditolak
- [ ] Sesi stale (NAS reboot tanpa kirim Accounting-Stop) tidak menyebabkan user legit ke-block permanen
- [ ] Perubahan `radcheck`/`radnasallow` berlaku tanpa restart container FreeRADIUS