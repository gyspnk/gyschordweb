/* Regression test: menjaga optimasi performa daftar pujian (533 item).
 *
 * Dua invarian yang pernah rusak / mudah rusak kembali:
 *  1) `contain-intrinsic-size` HARUS diturunkan dari variabel CSS, bukan angka
 *     tetap. Angka tetap (mis. 66px) salah karena properti itu mengukur
 *     CONTENT-BOX — padding+border ditambahkan browser di atasnya — sehingga
 *     item jadi 92px (bukan 68px) dan tinggi daftar melar 40.240 -> 52.715px
 *     (scrollbar loncat saat menggulir).
 *  2) Pengukuran judul (autoFitTextSingleLine) HARUS lazy per-elemen-terlihat.
 *     Mengukur 533 judul sekaligus memaksa ratusan reflow sinkron saat boot
 *     (~0,8 s long task).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => join(root, p);

test("daftar pujian: item di luar viewport dilewati (content-visibility)", () => {
  const css = readFileSync(at("docs/css/runtime-fixes.css"), "utf8");
  const rule = /\.pujian-list li\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, "aturan `.pujian-list li { … }` tidak ditemukan di runtime-fixes.css");
  const body = rule[1];
  assert.match(body, /content-visibility:\s*auto/, "harus ada `content-visibility: auto`");

  const intrinsic = /contain-intrinsic-size:\s*([^;]+);/.exec(body);
  assert.ok(intrinsic, "harus ada `contain-intrinsic-size` (tanpa itu item melar/kempes)");
  const value = intrinsic[1].trim();
  assert.match(
    value,
    /var\(--/,
    "contain-intrinsic-size harus memakai variabel CSS (mis. max(var(--layout-number-size), 2.5rem)); " +
      "angka tetap membuat tinggi tiap item salah → tinggi daftar melar",
  );
  assert.match(value, /^auto\b/, "harus diawali kata kunci `auto` agar ukuran asli diingat setelah render");
});

test("judul daftar diukur lazy (IntersectionObserver), bukan semua saat boot", () => {
  const ui = readFileSync(at("docs/js/ui-core.js"), "utf8");

  const fn = /function fitListTitles\(\)\s*\{([\s\S]*?)\n\}/.exec(ui);
  assert.ok(fn, "fungsi fitListTitles() tidak ditemukan di ui-core.js");
  assert.match(
    fn[1],
    /_getListTitleObserver\(\)/,
    "fitListTitles harus memakai observer, bukan mengukur langsung",
  );
  assert.doesNotMatch(
    fn[1],
    /autoFitTextSingleLine\s*\(/,
    "fitListTitles tidak boleh memanggil autoFitTextSingleLine untuk semua judul " +
      "(menyebabkan ratusan reflow sinkron saat boot)",
  );

  assert.match(ui, /new IntersectionObserver\(/, "IntersectionObserver untuk judul tidak ditemukan");
  assert.match(ui, /_fitVisibleListTitle/, "pengukur judul terlihat tidak ditemukan");
});
