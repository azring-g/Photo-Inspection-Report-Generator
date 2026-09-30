# 🌳 BIG TREE OUTDOOR (BTO) — Photo Inspection Report Generator

> **Alat Produktiviti Kejuruteraan Projek Dalaman**  
> Dibina oleh: **Ts. Azrin Helmi Bin Mohd Ghazali**, Big Tree Outdoor Sdn. Bhd.  
> Versi Dokumen: **PRD v1.1** (Diluluskan)

---

## 📌 Pengenalan Ringkas

Aplikasi web ini direka khusus untuk **Jurutera Projek di Big Tree Outdoor Sdn. Bhd.** bagi memudahkan dan mengautomasikan penyediaan slaid laporan pemeriksaan tapak papan iklan (*billboard inspection report*).

Sebelum ini, jurutera perlu mengisi maklumat tapak secara manual, memasukkan gambar satu demi satu ke dalam slaid, dan menamakan fail secara manual — proses ini mengambil masa yang lama dan mudah berlaku kesilapan. Dengan aplikasi ini, keseluruhan proses selesai dalam **masa kurang daripada 2 minit**.

---

## 🚀 Kelebihan Utama Sistem

- ⚡ **Pantas & Tepat**: Ekstrak maklumat tapak secara terus daripada fail induk inventori (`Inventori_2026.gsheets`).
- 🖼️ **Muat Naik Mudah (1 hingga 8 Gambar)**: Cuma *drag & drop* gambar pemeriksaan tapak. Jika kurang daripada 8 keping, bingkai yang tidak digunakan akan kekal kelabu kemas tanpa merosakkan susun atur slaid.
- 💬 **Ulasan Berpasangan (*Pairwise Review*)**: Semak 2 keping gambar bersebelahan dalam satu paparan dan masukkan ulasan teknikal dengan pantas (disertakan butang pilihan ulasan segera).
- 📁 **Penamaan Fail Bersiri Automatik**: Sistem secara automatik mengimbas Google Drive dan menamakan laporan baharu mengikut format bersiri:  
  `[Nombor Tapak]-[Nombor Siri 3 Digit]` (Contoh: **`AGT-092-001.gslides`**).
- ☁️ **Integrasi Google Drive Sebenar**: Boleh terus log masuk menggunakan akaun Google untuk menyemak, menjana, dan membuka fail terus di Google Drive.

---

## 🔄 Aliran Penggunaan (SOP 4 Langkah)

```
[1. Masukkan Nombor Tapak] ➔ [2. Muat Naik 1-8 Gambar] ➔ [3. Masukkan Ulasan] ➔ [4. Jana Slaid ke Google Drive]
```

### Langkah 1: Carian Maklumat Tapak (Site Metadata)
1. Taip **Nombor Tapak** (contoh: `AGT-092`, `KUL-551`, atau `SGR-889`).
2. Tekan **Lookup** — sistem akan automatik mengisi maklumat:
   - **Lokasi** (*Location*)
   - **Saiz Billboard** (*Size*)
   - **Format Struktur** (*Structure / Format*)
3. Anda boleh menyunting ruangan **Penerangan Visual / Kempen** mengikut iklan semasa di tapak.

### Langkah 2: Muat Naik Gambar Pemeriksaan (Upload Photos)
1. Tarik (*drag & drop*) atau pilih **1 hingga 8 keping gambar** pemeriksaan tapak (format JPG/PNG).
2. Terdapat butang pantas **"Load 5 Sample Inspection Photos"** untuk tujuan ujian pantas.
3. Klik **"Insert & Proceed to Comments"**.

### Langkah 3: Semakan & Ulasan Berpasangan (Pairwise Comments)
1. Sistem akan membahagikan gambar kepada 4 pasangan:
   - Pasangan 1: Gambar 1 & 2
   - Pasangan 2: Gambar 3 & 4
   - Pasangan 3: Gambar 5 & 6
   - Pasangan 4: Gambar 7 & 8
2. Taip ulasan teknikal bagi setiap gambar atau tekan **"Insert quick tag"** untuk ulasan lazim seperti:
   - *Pemeriksaan integriti struktur tiang dan kekuda.*
   - *Jarak penglihatan pemandu (line of sight).*
   - *Pencahayaan lampu limpah LED waktu malam.*
   - *Ketegangan cetakan vinyl tanpa kedutan.*
3. Slot yang tidak mempunyai gambar akan automatik kekal kosong.

### Langkah 4: Penjanaan Slaid & Paparan Simulasi Google Slides
1. Klik butang **"Create Report & Save (F05)"**.
2. Sistem akan menyalin templat, menjana nombor siri baharu, dan menyimpan fail ke Google Drive.
3. Anda boleh:
   - Melihat simulasi paparan slaid format **16:9 HD** bagi **Halaman 1 (Gambar 1–4)** dan **Halaman 2 (Gambar 5–8)**.
   - Menekan butang **"Open in Google Drive"** untuk terus membuka fail di Google Drive.
   - Menyalin nama fail rujukan dengan satu klik.

---

## 📋 Sumber & Pautan Sasaran

| Perkara | Nama Fail / Folder | Pautan / ID |
| :--- | :--- | :--- |
| **Sumber Data Inventori** | `Inventori_2026.gsheets` | [Buka Google Sheets](https://docs.google.com/spreadsheets/d/1ZRHVQ0IBSJ8C3L86IFXDH8DYGVFYFYAHCNM9B_TPYEK) |
| **Templat Google Slides** | `IPR_Sample.gslides` | [Buka Templat Slaid](https://docs.google.com/presentation/d/1-lXKXd53YRH2N4i8uG-4zGI4Oe-pfkEm6MiCYDfCMdY/edit) |
| **Folder Sasaran Drive** | `BTO / Reports / 2026` | `13gDVVR5fnjpfN7CSULNzU2dXPH3HjaNE` |

---

## 🛠️ Cara Menjalankan Projek (Pembangunan / Developer)

Aplikasi ini menggunakan **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4**, dan **Firebase Auth / Google Drive API**.

### 1. Pasang Keperluan (Dependencies)
```bash
npm install
```

### 2. Jalankan Pelayan Pembangunan (Dev Server)
```bash
npm run dev
```
Aplikasi boleh diakses melalui penyemak imbas (*browser*) pada port `3000` (contoh: `http://localhost:3000`).

### 3. Semakan Kod & Pembinaan (Build & Lint)
```bash
# Semak ketiadaan ralat TypeScript
npm run lint

# Bina fail produksi
npm run build
```

---

## ✅ Pengesahan Kualiti & Ujian Sistem (QA Checklist)

Sistem ini mematuhi semua kriteria ujian dalam **PRD Seksyen 10**:

- **TC01 & TC02**: Paparan kredit nama penulis dan carian nombor tapak sah beroperasi 100%.
- **TC03**: Mesej amaran jelas dipaparkan jika nombor tapak tidak dijumpai dalam rekod.
- **TC04 & TC05**: Menerima sehingga 8 keping gambar dengan amaran jika melebihi had, dan slot kosong kekal kelabu.
- **TC06**: Semakan ulasan bergerak 2 gambar setiap langkah mengikut turutan slaid.
- **TC07 & TC08**: Penamaan bersiri `[SiteNo]-[seq].gslides` dijana dengan tepat dan slot kosong dipaparkan bersih di Google Drive.

---

## 👤 Hak Cipta & Maklumat Penulis

- **Pengarang & Arkitek Sistem**: Ts. Azrin Helmi Bin Mohd Ghazali
- **Organisasi**: Big Tree Outdoor Sdn. Bhd. (Bahagian Kejuruteraan & Operasi)
- **Status Versi**: PRD Version 1.1 (Production Ready)
