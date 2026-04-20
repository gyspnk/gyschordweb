# GysChordWeb - Penampil PDF Kidung Rohani & Editor Chord Interaktif

GysChordWeb adalah aplikasi web progresif yang didesain khusus sebagai alat interaktif penampil PDF partitur Kidung Rohani dan pengelolaan transpose chord. Aplikasi ini membantu menjembatani keterbatasan musisi (khususnya pemula) dalam hal penggantian nada dasar saat mengiringi ibadah/pelayanan.

---

## 📖 Latar Belakang & Tujuan
Project ini dimulai dari tahun 2025. Di dalam nama Tuhan Yesus, semoga project ini dapat bermanfaat bagi para pemusik di Gereja Yesus Sejati Indonesia agar bisa menjadi referensi ataupun sebagai *tool* untuk membantu menunjang pelayanan dalam bidang musik. Terpikirnya pembuatan aplikasi ini karena kesulitan yang sering dialami oleh pemusik pemula dalam mencari chord, terutama saat ada perpindahan nada dasar (Transpose). 

*Puji Tuhan, walaupun sempat terhenti beberapa bulan karena kesibukan pribadi, project ini bisa dilanjutkan kembali hingga rampung pada April 2026. Segala puji hanya bagi kemuliaan Nama Tuhan saja.*

---

## ✨ Fitur-Fitur Utama

### 1. 📄 Penampil PDF Lanjutan (PDF.js Integration)
Penampil partitur super dinamis yang terisolasi anti-konflik dengan *gesture* default browser.
- **Dukungan Orientasi Pintar:** Otomatis menyesuaikan *Landscape* atau *Portrait*. Tersedia kontrol tampilan mode 1-Halaman atau 2-Halaman (Buku) dengan arah *scroll* Vertikal maupun Horizontal.
- **Zooming Dinamis & Geser (Panning):** `Pinch-to-zoom` via *touchscreen* dan navigasi geser/panning PDF yang sedang dizoom kini ditenagai penuh untuk menahan **Klik-kiri Mouse + Geser** selain dukungan sentuhan. Skala teks komputasi dihitung responsif.
- **Shortcut Navigasi Keyboard:**
  - Tombol **Kiri / Kanan** (Panah): Membuka Pujian/Lagu Sebelumnya atau Selanjutnya.
  - Tombol **Atas / Bawah** (Panah): Berpindah Halaman Sebelum/Berikut pada file PDF multi-halaman.
  - Kombinasi **Ctrl + (+) / Ctrl + (-)**: Memicu *Zoom-in / Zoom-out* langsung dari keyboard.
- **Responsif Threshold:** Layout *Control Header* secara pintar menyesuaikan *break-point desktop* (hinggal layar `< 1366px`), melipat menu yang terlalu panjang agar tidak tumpang tindih (*overlap*) dengan judul lagu di tablet maupun laptop ber-*scale* tinggi.

### 2. 🎼 Editor Overlay Chord & Transpose Pintar
*(Sistem pemisahan layer chord dan partitur statis fisik: menjaga originalitas file PDF asli dari gereja agar tidak perlu di-render ulang/kompres mandiri)*
- **Tombol Transpose Realtime (*Pitch Shifting*):** Tombol pintasan UI menaikkan (+1, +2..) atau menurunkan (-1, -2..) deretan kunci chord nada secara algoritmik.
- **Accidental Switcher ($♭/♯$):** Merubah notasi kress (`♯`) menjadi mol (`♭`) ataupun sebaliknya berpadu logic transposer agar cocok/konsisten dengan kaidah penulisan tangga nada yang diinginkan sang pemusik.
- **Kustomisasi Tampilan Chord Ekstensif:** Rubah ukuran absolut proporsi base font, palet pewarnaan latar, bentuk opasitas highlight, hingga mode isolasi dark-theme untuk teks panduan.
- **Mode Editor Tersembunyi (Rahasia/Pembangun):**
  - Sentuh bagian tengah **(Ketuk Judul PDF di Topbar)** sebanyak **10 Kali Cepat** guna membangkitkan panel sentral *Editor Toolbar Chord*. (*Sentuhkan 5x kembali jika ingin ditutup*).
  - Anda punya kebebasan mengeksekusi klik kordinat pada baris yang dimau, menanam grid chord, lalu menyimpannya dalam bundel JSON eksternal (.txt) di memori lokal—murni mempermudah tim input/kontributor tanpa menyentuh *core programming*.

### 3. 🔍 Algoritma Pencarian & Pemetaan Katalog Otomatis
- Data lagu daftar pujian dikirimkan langsung tidak *hardcoded* HTML, tetapi di-*serving* otomatis memakai parsing referensi `assets-list.json`.
- Mendukung metode pencarian sangat luwes:
  - Pencarian nomor beruntun.
  - Toleransi ketikan (*fuzzy typo-mapping*).
  - Pencarian judul terbalik.
  - Otomatis filter *underscore* (`_`) format naming PDF asli menjadi spasi yang ramah di UI.

### 4. 🎨 Kesatuan UI/UX Material You 
- Tersedia integrasi mode transisi siang & malam (*Dark Theme/Light Theme*).
- Pemilihan koleksi corak warna dominan (*Accent Color Preset*) hingga pilihan input spesifik Hex Code RGB *Custom Accent*.
- State pengaturan & progres terkhir Anda bermain (seperti konfigurasi tampilan) diselamatkan permanen pada *browser caching window's Local Storage*.

---

## 📁 Struktur Direktori Berbasis Modular
Codebase ini disusun modular agar styling, runtime, dan aset lebih mudah dipelihara. Mulai iterasi ini, `docs/style.css` tidak dipakai lagi; stylesheet runtime utama adalah `docs/css/tailwind.css` hasil build.

```text
docs/
  ├── index.html                    # Output entry React production
  ├── sw.js                         # Service Worker (PWA caching)
  ├── assets-list.json              # Database Manifest Mapping PDF (daftar lagu)
  ├── chord-assets-list.json        # Database Manifest Mapping Chord TXT
  ├── generate_assets_list.py       # Python Engine Automasi Data-Scraping Indeks JSON
  │
  ├── css/                          # Layer CSS sumber + output build
  │   ├── 01-fonts.css              # Tipografi UI & Google Symbols
  │   ├── 02-theme.css              # Palet Warna Aksentuasi UI & Dark Mode
  │   ├── 03-layout.css             # Grid Flexbox Master Utama
  │   ├── 04-viewer.css             # Skilus PDF Viewer Frame & Gestures
  │   ├── 05-components.css         # Kumpulan Component Buttons, Slider MD3
  │   ├── 06-help.css               # Panel Bantuan / Help Overlay
  │   ├── 07-responsive.css         # Media Queries & Breakpoint Responsif
  │   ├── 08-animations.css         # Animasi & Transisi UI
  │   ├── 09-scaling.css            # Skala Teks Komputasi Responsif
  │   ├── 10-toast.css              # Notifikasi Toast
  │   ├── tailwind-source.css       # Layer Tailwind (`@tailwind` + `@layer` overrides)
  │   └── tailwind.css              # Output build CSS production (minified)
  │
  ├── js/                           # Modul JavaScript aktif + output runtime
  │   ├── midi-engine.js            # Engine MIDI utama
  │   ├── app-core.js               # Merge state/config/navigation core
  │   ├── viewer-core.js            # Merge PDF viewer + chord editor core
  │   ├── ui-core.js                # Merge init + helper + handler + gesture UI
  │   ├── playlist-core.js          # Merge logika playlist + UI playlist
  │   ├── media-session.js          # Integrasi media-session
  │   ├── midi-render-worker.js     # Source worker MIDI
  │   ├── midi-render-worker.min.js # Worker MIDI runtime minified
  │   └── app.bundle.min.js         # Output build JS app runtime (minified)
  │
  ├── web/                          # Output chunk React (hashed, optimized)
  │   ├── index-*.js
  │   └── react-*.js
  │
  ├── assets/                       # Folder penyimpanan seluruh aset
  │   ├── pdf/                      # File Partitur PDF
  │   ├── chord/                    # File Chord TXT (format JSON, per lagu)
  │   ├── midi/                     # File MIDI per lagu
  │   ├── chord-grid/               # Gambar Grid Chord (referensi fingering)
  │   └── fonts/                    # Font lokal (fallback)

scripts/
  └── build/
      ├── css.mjs                   # Builder CSS (Tailwind layer + legacy CSS -> tailwind.css)
      └── js.mjs                    # Builder JS (merge sources + minify app/worker/sw)

src/
  ├── App.jsx                       # React host yang merender shell aplikasi
  ├── main.jsx                      # React entrypoint
  ├── legacy/
  │   └── bootstrapLegacyRuntime.js # Loader runtime legacy + SW bootstrap
  └── templates/
      └── app-shell.html            # Shell DOM penuh untuk kompatibilitas fitur

index.html                          # Source entry React untuk Vite
vite.config.mjs                     # Konfigurasi bundling React (outDir ke docs/)

archive/
  ├── scripts_archive/              # Arsip script patch/fix lama
  └── docs-js/
      └── legacy/                   # Arsip file split JS lama (untuk referensi)
          ├── 01-config.js
          ├── ...
          └── 14-note-chord-editor.js

_test_temp/
  └── tailwind-layer.css            # Intermediate Tailwind layer (generated during build)

tailwind.config.cjs                 # Tailwind configuration

```


---

## 🚀 Pengoperasian & Instalasi Lokal (Developer Workflow)
Aplikasi *GysChordWeb* berjalan berbasis *client-side rendering* tanpa backend kompleks, tetapi wajib diakses via `http/https` agar aset PDF.js dan file static bekerja tanpa blokir CORS.

Catatan migrasi React bertahap tersedia di `docs/react-migration-evaluation.md`.

**Langkah 1: Selaraskan indeks aset (PDF/Chord)**
```bash
python docs/generate_assets_list.py
```

**Langkah 2: Install dependency dan build aset frontend**
```bash
npm install
npm run build
```

Untuk mode development React:
```bash
npm run dev
```

Perintah `npm run build` menghasilkan:
- `docs/css/tailwind.css` (CSS production minified)
- `docs/js/app.bundle.min.js` (JS runtime minified)
- `docs/js/midi-render-worker.min.js` (worker runtime minified)
- `docs/sw.min.js` (service worker runtime minified)
- `docs/index.html` (entry React production)
- `docs/web/*.js` (chunk React teroptimasi)

**Langkah 3: Jalankan server lokal**
- Gunakan extension **Live Server** pada folder `docs/`, atau
- Python HTTP server:
  ```bash
  python -m http.server 8000 --directory docs
  ```

Lalu buka [http://localhost:8000](http://localhost:8000).


---

## 👥 Kontributor Pembukaan & Dedikasi Project

Cakupan project rintisan ini merupakan salah satu sarana komitmen karya dan talenta yang diletakkan bagi kemuliaan pelayanan-Nya.

* **Yang Mengizinkan Semua Ini Terlaksana:** Tuhan Yesus Kristus
* **Developer Utama:** Gilbert Then (Gereja Yesus Sejati Pontianak)
* **Contributor Input Chord:** Clement JJ (Gereja Yesus Sejati Pontianak)

Terima kasih sedalamnya bagi rekan-rekan musisi dan jemaat yang turut mendukung secara moral sehingga rancang-bangun *tools* ini terselesaikan dengan teramat lancar!

> **Lisensi Repository**: Terlisensi sepenuhnya di bawah payung aturan *MIT License* | ©2025-2026 GysChordWeb
