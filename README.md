# GysChordWeb

GysChordWeb adalah aplikasi web katalog dan penampil PDF pujian/kidung rohani dengan fitur pencarian cerdas, tema Material You, dan navigasi responsif. Cocok untuk gereja, komunitas, atau pribadi yang membutuhkan akses cepat ke daftar pujian digital.

## Fitur Utama
- **Daftar Pujian Otomatis**: Daftar pujian diambil dari file JSON dan ditampilkan secara dinamis.
- **Pencarian Fuzzy**: Pencarian mendukung kata terbalik, pengganti karakter `_` menjadi `?`, dan hasil pencarian langsung menyorot pujian yang cocok.
- **Tema Material You**: Warna aksen dan tema (terang/gelap) dapat diubah sesuai preferensi pengguna.
- **PDF Viewer**: Penampil PDF terintegrasi dengan navigasi halaman, zoom, dan mode dua halaman.
- **Custom Scrollbar**: Scrollbar bertema, lebar, dan smooth, selalu tampil rapi di antara header dan navbar.
- **Responsif**: Tata letak otomatis menyesuaikan orientasi dan ukuran layar (mobile & desktop).

## Struktur Folder
```
webapp/
  ├── index.html
  ├── style.css
  ├── script.js
  ├── assets/           # Folder PDF pujian
  └── assets-list.json  # Daftar file pujian
```

## Cara Menjalankan
1. Clone repository ini
2. Letakkan file PDF pujian di folder `webapp/assets/`
3. Pastikan file `assets-list.json` berisi daftar file PDF
4. Buka `index.html` di browser modern (Chrome, Edge, Firefox, dsb.)

## Kustomisasi
- **Warna Aksen & Tema:** Atur di menu pengaturan pada aplikasi.
- **Daftar Pujian:** Tambah/hapus file PDF di folder `assets/` dan update `assets-list.json`.

## Kontribusi
Pull request dan issue sangat diterima! Silakan fork repo ini dan ajukan perubahan jika ingin menambah fitur atau memperbaiki bug.

## Lisensi
MIT License

---
Dibuat oleh KernelXtream dan kontributor.
# gyschordweb