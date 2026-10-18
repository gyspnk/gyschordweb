/* Regression test: jeda pindah lagu (next/prev) harus tetap minimal.
 *
 * Riwayat: jalur navigasi intra-viewer dulu menahan alur dengan dua tunggu
 * tetap — setTimeout 260ms (menunggu animasi fade-out lama) dan setTimeout
 * 280ms (menunggu morphing lebar kotak judul). Karena layar sudah diblank
 * seketika, keduanya murni waktu kosong (~0,5 s). Selain itu parse PDF.js
 * (~0,4-0,8 s), getTextContent halaman 1, payload chord JSON (`cache:
 * "no-store"`), dan ekstraksi not semuanya terjadi di jalur kritis.
 *
 * Yang dijaga di sini:
 *  1) tidak ada tunggu tetap di jalur navigasi (layar blank seketika),
 *  2) tetangga di-decode + payload chord + not di-prefetch lebih awal,
 *  3) cache meta halaman 1 & cache not per PDF+halaman tetap dipakai,
 *  4) morfing lebar kotak judul dijalankan SETELAH render (main thread bebas),
 *     sehingga efek resize-nya benar-benar terlihat.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => join(root, p);

const viewer = readFileSync(at("docs/js/viewer-core.js"), "utf8");

test("navigasi lagu: tidak ada tunggu tetap di jalur kritis", () => {
  assert.ok(
    !/setTimeout\(resolve,\s*260\)/.test(viewer),
    "tunggu tetap 260ms (sisa animasi fade-out lama) muncul lagi",
  );
  assert.ok(
    !/setTimeout\(resolve,\s*280\)/.test(viewer),
    "tunggu tetap 280ms (menunggu morphing judul) muncul lagi",
  );
  // Navigasi intra-viewer: blank seketika + cek generasi tanpa jeda.
  assert.match(
    viewer,
    /canvasWrapper\.classList\.add\("is-navigating"\);\s*\n\s*\/\/ Abort if a newer navigation started\./,
    "blank pada navigasi intra-viewer harus seketika, bukan setelah tunggu tetap",
  );
});

test("tetangga di-prefetch lebih awal (dokumen + chord + not)", () => {
  // Prefetch dijalankan setelah konten muncul, bukan menunggu antrean preload MIDI.
  assert.match(
    viewer,
    /fitViewerTitle\(\);\s*\n\s*\n\s*\/\/ Prefetch tetangga[\s\S]{0,400}?_scheduleNeighborAssetPrefetch\(\);/,
    "prefetch tetangga harus dipanggil segera setelah lagu tampil",
  );
  assert.match(
    viewer,
    /function _prefetchNeighborAssets\(\)/,
    "fungsi _prefetchNeighborAssets() hilang",
  );
  assert.match(
    viewer,
    /_prefetchPdf\(song\.fileHref\);\s*\n\s*\/\/[\s\S]{0,200}?_prefetchDecodedPdf\(song\.fileHref\);[\s\S]{0,200}?_prefetchNoteChordConfig\(song\);/,
    "queueNeighborSong harus juga men-decode PDF + payload chord tetangga",
  );
  // Prefetch dokumen juga menghitung not halaman 1 (untuk layer chord).
  assert.match(
    viewer,
    /function _prefetchDecodedPdf\(url\)/,
    "fungsi _prefetchDecodedPdf() hilang",
  );
  assert.match(
    viewer,
    /doc\s*\n?\s*\.getPage\(1\)[\s\S]{0,200}?extractPageNotes\(p,\s*1,\s*url\)/,
    "prefetch dokumen harus sekalian menghitung not halaman 1",
  );
});

test("cache halaman 1: meta (tempo + nada dasar) & not per PDF+halaman", () => {
  // Jalur navigasi memakai cache meta bila ada, bukan getTextContent() lagi.
  assert.match(
    viewer,
    /const _metaCached =\s*\n?\s*song && song\.fileHref \? _pdfMetaByHref\.get\(song\.fileHref\) : null;/,
    "jalur navigasi harus memakai _pdfMetaByHref bila sudah dihitung",
  );
  assert.match(
    viewer,
    /async function extractPageNotes\(page, pageNum, url\)/,
    "extractPageNotes harus menerima nomor halaman + url agar cache tidak bertabrakan",
  );
  assert.match(
    viewer,
    /_setCachedPageNotes\(keyUrl, num, result\)/,
    "hasil ekstraksi not harus disimpan ke cache per PDF+halaman",
  );
  // Payload chord JSON di-cache di memori karena fetch-nya `no-store`.
  assert.match(
    viewer,
    /let parsed = _noteChordPayloadCache\.get\(filename\);[\s\S]{0,200}?fetch\(url, \{ cache: "no-store" \}\)/,
    "loadNoteChordConfiguration harus membaca cache payload sebelum fetch",
  );
  // Pemanggil lain (mode lirik) harus menyertakan nomor halaman.
  const lyrics = readFileSync(at("docs/js/lyrics-viewer.js"), "utf8");
  assert.match(
    lyrics,
    /extractPageNotes\(page, p, song\.fileHref\)/,
    "mode lirik harus meneruskan nomor halaman agar cache not tidak tertukar",
  );
});

test("morfing lebar kotak judul dijalankan setelah render (tidak diblok raster)", () => {
  // Animasi `width` dijalankan browser di MAIN THREAD, bukan compositor. Kalau
  // dimulai sebelum render, raster kanvas PDF (~0,2-0,3 s) memblokir main thread
  // sehingga animasinya tak terlihat (lebar langsung melompat) dan terpotong
  // reset. Karena itu lebar lama ditahan dan animasinya baru dijalankan pada
  // langkah fade-in (setelah render selesai).
  assert.match(
    viewer,
    /const thisOpenGeneration = \+\+_openPdfViewerGeneration;[\s\S]{0,400}?_pendingTitleMorph = null;/,
    "openPdfViewer harus mereset _pendingTitleMorph",
  );
  assert.match(
    viewer,
    /songTitleWrapper\.style\.width = `\$\{oldWidth\}px`;[\s\S]{0,300}?_pendingTitleMorph = \{ targetWidth \};/,
    "blok morfing harus menahan lebar lama + menyimpan targetWidth, bukan langsung beranimasi",
  );
  const renderAt = viewer.indexOf("await renderPage(currentPageNum);");
  const animAt = viewer.indexOf("'width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'");
  assert.ok(renderAt > 0 && animAt > renderAt, "animasi lebar judul harus dimulai SETELAH render (main thread bebas)");
  assert.match(
    viewer,
    /songTitleWrapper\.style\.transition =[\s\S]{0,120}?'width 0\.28s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)';\s*\n\s*void songTitleWrapper\.offsetWidth;\s*\n\s*songTitleWrapper\.style\.width = `\$\{pendingTitleMorph\.targetWidth\}px`;/,
    "animasi lebar harus: set transition → commit lebar lama → set lebar target",
  );
  // Style inline wajib dilepas setelah animasi selesai agar layout CSS alami kembali.
  assert.match(
    viewer,
    /setTimeout\(\(\) => \{[\s\S]{0,400}?songTitleWrapper\.style\.transition = '';[\s\S]{0,60}?\}, 320\);/,
    "style inline kotak judul harus dibersihkan setelah animasi selesai",
  );
  // Prefetch tetangga (beban main thread) tidak boleh berjalan di tengah animasi.
  assert.match(
    viewer,
    /_prefetchNeighborAssets\(\);\s*\n\s*\}, \d{3,4}\);/,
    "prefetch tetangga harus ditunda minimal 100ms agar tidak menyendat animasi",
  );
  assert.ok(
    !/setTimeout\(\(\) => \{\s*\n\s*_prefetchNeighborAssets\(\);\s*\n\s*\}, (\d|[1-9]\d|1\d\d)\);/.test(viewer),
    "prefetch tetangga tidak boleh dijadwalkan < 200ms (menyendat morfing judul)",
  );
});
