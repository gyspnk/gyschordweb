/* Regression test: pastikan SEMUA nama ikon Material Symbols yang dipakai di
 * sumber sudah tercakup di subset (tools/icon-subset.json) — sehingga menambah
 * ikon baru tanpa memperbarui subset akan GAGAL di CI (bukan diam-diam rusak
 * di produksi). Juga memverifikasi berkas font subset ada & valid.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => join(root, p);

function collectSourceFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.git|assets\/(pdf|midi|soundfont|fonts|logo)/.test(p)) continue;
      out.push(...collectSourceFiles(p));
    } else if (/\.(js|mjs|css|html)$/.test(e.name) && !/\.min\.js$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// Ekstraksi nama ikon dari pola-pola yang benar-benar dipakai aplikasi.
function extractIconNames(src) {
  const names = new Set();
  const push = (n) => {
    if (n && /^[a-z][a-z0-9_]*$/.test(n)) names.add(n);
  };
  // <span class="material-symbols-outlined">NAME</span>
  for (const m of src.matchAll(/material-symbols[a-zA-Z-]*[^>]{0,40}>([a-z][a-z0-9_]*)/g)) push(m[1]);
  // ...>${expr}  (mis. ternary "check_circle"/"cancel")
  for (const m of src.matchAll(/material-symbols[a-zA-Z-]*[^>]{0,40}>\$\{[^}]{0,80}\}/g)) {
    for (const q of m[0].matchAll(/["']([a-z][a-z0-9_]*)["']/g)) push(q[1]);
  }
  // CSS content:"NAME" (ikon via pseudo-element)
  for (const m of src.matchAll(/content:\s*["']([a-z][a-z0-9_]*)["']/g)) push(m[1]);
  // icon: "NAME"
  for (const m of src.matchAll(/icon["']?\s*[:=]\s*["']([a-z][a-z0-9_]*)["']/g)) push(m[1]);
  // renderSettingLabel("NAME", ...)
  for (const m of src.matchAll(/renderSettingLabel\(\s*["']([a-z][a-z0-9_]*)["']/g)) push(m[1]);
  // showToast("...", "NAME")
  for (const m of src.matchAll(/showToast\([^,;]{0,120},\s*["']([a-z][a-z0-9_]*)["']/g)) push(m[1]);
  // getMidiInstrumentIcon(): return "NAME"
  const fn = /function getMidiInstrumentIcon[\s\S]*?\n}/.exec(src);
  if (fn) for (const m of fn[0].matchAll(/return\s+["']([a-z][a-z0-9_]*)["']/g)) push(m[1]);
  return names;
}

test("semua ikon yang dipakai tercakup di subset", () => {
  const manifest = JSON.parse(readFileSync(at("tools/icon-subset.json"), "utf8"));
  const subset = new Set(manifest.icons);
  const used = new Set();
  for (const f of collectSourceFiles(at("docs"))) {
    for (const n of extractIconNames(readFileSync(f, "utf8"))) used.add(n);
  }
  const missing = [...used].filter((n) => !subset.has(n)).sort();
  assert.deepEqual(
    missing,
    [],
    "Ikon berikut dipakai di sumber tapi belum ada di tools/icon-subset.json " +
      "(tambahkan lalu jalankan `node tools/build-icon-subset.mjs`): " + missing.join(", "),
  );
});

test("berkas font subset ada dan valid (woff2)", () => {
  const p = at("docs/assets/fonts/material-symbols-subset.woff2");
  assert.ok(existsSync(p), "font subset tidak ditemukan: " + p);
  const buf = readFileSync(p);
  assert.equal(buf.subarray(0, 4).toString("latin1"), "wOF2", "berkas bukan woff2");
  assert.ok(buf.length < 200 * 1024, "subset font terlalu besar: " + buf.length + " byte");
});

test("icons.css mereferensikan font subset lokal (bukan Google Fonts penuh)", () => {
  const css = readFileSync(at("docs/css/icons.css"), "utf8");
  assert.match(css, /material-symbols-subset\.woff2/, "icons.css harus memakai font subset lokal");
  const idx = readFileSync(at("docs/index.html"), "utf8");
  assert.doesNotMatch(
    idx,
    /Material\+Symbols\+Outlined:opsz,wght,FILL,GRAD/,
    "index.html masih memuat font ikon penuh dari Google Fonts",
  );
});
