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
Codebase ini terus mengalami optimasi pembersihan performa dan refaktorisasi modularity (Misalnya pemecahan stylesheet belasan ribu baris ke partikel pecahan). Hirarkhi rilis strukturnya sekarang memetakan sbb:

```text
docs/
  ├── index.html                    # Frame Skeleton HTML & DOM mark-up utama
  ├── style.css                     # Aggregator CSS Masterplate (berbasis @import)
  ├── sw.js                         # Service Worker (PWA caching)
  ├── assets-list.json              # Database Manifest Mapping PDF (daftar lagu)
  ├── chord-assets-list.json        # Database Manifest Mapping Chord TXT
  ├── generate_assets_list.py       # Python Engine Automasi Data-Scraping Indeks JSON
  │
  ├── css/                          # Modul-Modul File Cascading terpisah
  │   ├── 01-fonts.css              # Tipografi UI & Google Symbols
  │   ├── 02-theme.css              # Palet Warna Aksentuasi UI & Dark Mode
  │   ├── 03-layout.css             # Grid Flexbox Master Utama
  │   ├── 04-viewer.css             # Skilus PDF Viewer Frame & Gestures
  │   ├── 05-components.css         # Kumpulan Component Buttons, Slider MD3
  │   ├── 06-help.css               # Panel Bantuan / Help Overlay
  │   ├── 07-responsive.css         # Media Queries & Breakpoint Responsif
  │   ├── 08-animations.css         # Animasi & Transisi UI
  │   ├── 09-scaling.css            # Skala Teks Komputasi Responsif
  │   └── 10-toast.css              # Notifikasi Toast
  │
  ├── js/                           # Modul-Modul JavaScript terpisah (dimuat berurutan)
  │   ├── 01-config.js              # Konstanta, MidiTimeAuthority, konfigurasi global
  │   ├── 02-dom.js                 # Referensi elemen DOM & variabel state awal
  │   ├── 03-state.js               # Manajemen state aplikasi
  │   ├── 04-init.js                # Inisialisasi aplikasi & Service Worker
  │   ├── 05-events.js              # Event listeners (play/pause, seekbar RAF)
  │   ├── 06-navigation.js          # Navigasi lagu, keyboard shortcut
  │   ├── 07-pdf-viewer.js          # PDF.js viewer, MIDI loader, transpose
  │   ├── 08-chord-logic.js         # Rendering chord overlay & transpose UI
  │   ├── 09-ui-helpers.js          # Toast, tema, warna aksen, helper UI
  │   ├── 10-zoom-gestures.js       # Pinch-to-zoom & panning gesture
  │   ├── 11-handlers.js            # Handler event chord UI (ukuran, warna, dsb.)
  │   ├── 12-playlist.js            # Logika playlist & shuffle
  │   ├── 13-playlist-ui.js         # UI panel playlist
  │   └── 14-note-chord-editor.js   # Chord Editor Panel (mode tersembunyi)
  │
  └── assets/                       # Folder Penyimpanan Sentral seluruh aset
      ├── pdf/                      # File Partitur PDF
      ├── chord/                    # File Chord TXT (format JSON, per lagu)
      ├── midi/                     # File MIDI per lagu
      ├── chord-grid/               # Gambar Grid Chord (referensi fingering)
      └── fonts/                    # Font lokal (fallback)
```


---

## 🚀 Pengoperasian & Instalasi Lokal (Developer Workflow)
Aplikasi the-bone *GysChordWeb* beroperasi sepenuhnya di basis *Client-Side Rendering* (tanpa *backend* node server rumit). Hanya saja aplikasi WAJIB ditampakkan via protokol jembatan akses `http/https`, guna menghindari pemblokiran *Cross-Origin Resource Sharing (CORS)* native Browser pada pengambilan sistem berkas internal `pdf.js`.

**Langkah Pertama: Menyelaraskan Indeks Basis Data**  
Setiap ada partitur PDF baru maupun Chord Editor `TXT` yang telah dibuang ke folder `/docs/assets/`, eksekusi sejenak Script pemilah ini di *Terminal*:  
```bash
python docs/generate_assets_list.py
```
*(Algoritma python ini akan meresolusi list baru dengan menghiraukan berkas ekstensi non-PDF dari menu utama dan mencetaknya ulang ke JSON sinkron)*

**Langkah Kedua: Booting Simulator Server**
Rilis server via instrumen yang ramah di PC Anda:
- Gunakan Extension **Live Server** (jika bertumpu pada platform VS Code) & tembak pemicu via file `docs/index.html`.
- Alternatif Server CLI Python Bawaan:
  ```bash
  python -m http.server 8000 --directory docs
  ```
  Lalu klik URL jembatan localhost dari Output konsol Terminal tersebut. (Misal: [http://localhost:8000](http://localhost:8000))

---

## 👥 Kontributor Pembukaan & Dedikasi Project

Cakupan project rintisan ini merupakan salah satu sarana komitmen karya dan talenta yang diletakkan bagi kemuliaan pelayanan-Nya.

* **Yang Mengizinkan Semua Ini Terlaksana:** Tuhan Yesus Kristus
* **Developer Utama:** Gilbert Then (Gereja Yesus Sejati Pontianak)
* **Contributor Input Chord:** Clement JJ (Gereja Yesus Sejati Pontianak)

Terima kasih sedalamnya bagi rekan-rekan musisi dan jemaat yang turut mendukung secara moral sehingga rancang-bangun *tools* ini terselesaikan dengan teramat lancar!

> **Lisensi Repository**: Terlisensi sepenuhnya di bawah payung aturan *MIT License* | ©2025-2026 GysChordWeb
