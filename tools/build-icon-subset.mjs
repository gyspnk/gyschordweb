#!/usr/bin/env node
/* Bangun ulang subset font ikon Material Symbols dari tools/icon-subset.json.
 *
 * Aplikasi memakai font ikon Material Symbols sebagai SUBSET (hanya ikon yang
 * dipakai) agar tidak mengunduh font penuh ~3.9 MB. Bila UI menambah ikon baru:
 *   1) tambahkan namanya ke `icons` di tools/icon-subset.json
 *   2) jalankan: node tools/build-icon-subset.mjs
 *   3) naikkan versi berkas di docs/css/icons.css (…woff2?v=N)
 *
 * Butuh jaringan (mengambil subset dari Google Fonts). Hasil ditulis ke
 * docs/assets/fonts/material-symbols-subset.woff2
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "tools/icon-subset.json"), "utf8"));
const icons = [...new Set(manifest.icons)].sort();
const axes = manifest.axes || "opsz,wght,FILL,GRAD@20..48,100..700,0..1,0";

const cssUrl =
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:${axes}` +
  `&display=block&icon_names=${icons.join(",")}`;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const cssResp = await fetch(cssUrl, { headers: { "User-Agent": UA } });
if (!cssResp.ok) throw new Error("Gagal mengambil CSS Google Fonts: " + cssResp.status);
const css = await cssResp.text();
const fontUrl = /url\((https:\/\/[^)]+\.woff2|https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(css);
if (!fontUrl) throw new Error("URL font tidak ditemukan di CSS Google Fonts");

const fontResp = await fetch(fontUrl[1]);
if (!fontResp.ok) throw new Error("Gagal mengambil font: " + fontResp.status);
const buf = Buffer.from(await fontResp.arrayBuffer());

const out = join(root, "docs/assets/fonts/material-symbols-subset.woff2");
writeFileSync(out, buf);
console.log(
  `OK → ${out} (${(buf.length / 1024).toFixed(1)} KB, ${icons.length} ikon, ` +
    `sig=${buf.subarray(0, 4).toString("latin1")})`,
);
console.log("Jangan lupa naikkan ?v= di docs/css/icons.css bila konten berubah.");
