/* Regression test: perpindahan antar-halaman harus "blank → fade in".
 *
 * Dulu kontainer halaman baru masuk lewat keyframes "fade up"
 * (`simpleFade` = translateY(12px), `elegantFadeInUp` = translateY(20px))
 * sehingga terlihat seperti geseran, bukan sekadar muncul. Halaman lama sudah
 * langsung hilang karena #main-content ditulis ulang, jadi sisi masuk harus
 * murni opacity: mulai dari blank (opacity 0) lalu fade in, tanpa transform.
 *
 * Yang dijaga di sini:
 *  1) keempat kontainer halaman tetap punya satu aturan `animation` bersama,
 *  2) keyframes-nya HANYA mengubah `opacity` (tidak ada translate/transform),
 *  3) `both` (fill-mode) tetap ada → frame pertama dijamin blank, tidak kedip.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => join(root, p);

const PAGE_CONTAINERS = [
  ".pujian-list",
  ".playlist-view-container",
  ".settings-panel",
  ".report-page",
];

test("perpindahan halaman: masuk murni fade-in, tanpa geseran", () => {
  const css = readFileSync(at("docs/css/runtime-fixes.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  // 1) aturan `animation` yang mencakup keempat kontainer halaman
  let match = null;
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (let m; (m = ruleRe.exec(css)); ) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (
      PAGE_CONTAINERS.every((s) => selectors.includes(s)) &&
      /animation\s*:/.test(m[2])
    ) {
      match = m;
    }
  }
  assert.ok(
    match,
    "runtime-fixes.css harus punya satu aturan `animation` untuk keempat kontainer " +
      `halaman (${PAGE_CONTAINERS.join(", ")})`,
  );

  const animation = /animation\s*:\s*([^;]+);/.exec(match[2])[1].trim();
  const name = animation.split(/\s+/)[0];

  assert.ok(
    !["simpleFade", "elegantFadeInUp", "fadeSlideOut"].includes(name),
    `kontainer halaman tidak boleh memakai keyframes lama "${name}" (masih ada translateY → ` +
      "terlihat seperti transisi, bukan fade in)",
  );

  // 2) keyframes hanya boleh mengubah opacity
  const kf = new RegExp(
    `@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`,
  ).exec(css);
  assert.ok(kf, `@keyframes ${name} tidak ditemukan di runtime-fixes.css`);
  assert.doesNotMatch(
    kf[1],
    /translate|transform|scale|rotate/,
    `@keyframes ${name} hanya boleh mengubah opacity (state awal blank, tanpa geser/scale)`,
  );
  assert.match(
    kf[1],
    /opacity\s*:\s*0/,
    `@keyframes ${name} harus mulai dari opacity 0 (state awal blank)`,
  );
  assert.match(kf[1], /opacity\s*:\s*1/, `@keyframes ${name} harus berakhir di opacity 1`);

  // 3) fill-mode `both` → frame pertama blank
  assert.match(
    animation,
    /\bboth\b/,
    "fill-mode `both` wajib ada: tanpa itu frame pertama kontainer bisa ter-paint " +
      "penuh sebelum animasi mulai (kedip) di perangkat lambat",
  );
});

test("daftar pujian: item muncul murni fade-in, tanpa meluncur", () => {
  const css = readFileSync(at("docs/css/runtime-fixes.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  // Item daftar mewarisi durasi/delay/`both` dari shorthand tailwind.css
  // (`listItemEnter`, masih translateY(16px)); yang dioverride hanya namanya.
  let name = null;
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (let m; (m = ruleRe.exec(css)); ) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (!selectors.includes(".pujian-list li")) continue;
    const hit = /animation-name\s*:\s*([^;]+);/.exec(m[2]);
    if (hit) name = hit[1].trim();
  }
  assert.ok(
    name,
    "runtime-fixes.css harus meng-override `animation-name` pada `.pujian-list li` " +
      "(kalau tidak, item masih meluncur dengan translateY(16px))",
  );
  assert.notEqual(
    name,
    "listItemEnter",
    "`.pujian-list li` tidak boleh memakai `listItemEnter` (masih ada translateY → " +
      "terlihat meluncur, bukan blank lalu fade in)",
  );

  const kf = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css);
  assert.ok(kf, `@keyframes ${name} tidak ditemukan di runtime-fixes.css`);
  assert.doesNotMatch(
    kf[1],
    /translate|transform|scale|rotate/,
    `@keyframes ${name} hanya boleh mengubah opacity (state awal blank, tanpa geser)`,
  );
  assert.match(kf[1], /opacity\s*:\s*0/, `@keyframes ${name} harus mulai dari opacity 0`);
  assert.match(kf[1], /opacity\s*:\s*1/, `@keyframes ${name} harus berakhir di opacity 1`);
});

test("ganti lagu di viewer: konten lama blank seketika, bukan fade-out dulu", () => {
  const css = readFileSync(at("docs/css/runtime-fixes.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  // Alur lama: `is-navigating` → canvas memudar keluar 0.26s + teks judul 0.16s
  // (aturan `!important` di 04-viewer.css), baru konten baru fade in.
  const groups = [
    ["canvas", [".canvas-wrapper.is-navigating"]],
    [
      "teks judul",
      [
        ".song-title-wrapper.is-navigating h2",
        ".song-title-wrapper.is-navigating #pdf-viewer-title",
        ".song-title-wrapper.is-navigating #pdf-viewer-number",
      ],
    ],
  ];

  for (const [label, wanted] of groups) {
    let body = null;
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    for (let m; (m = ruleRe.exec(css)); ) {
      const selectors = m[1].split(",").map((s) => s.trim());
      if (wanted.every((s) => selectors.includes(s))) body = m[2];
    }
    assert.ok(
      body,
      `runtime-fixes.css harus punya aturan untuk ${label} saat \`is-navigating\` ` +
        `(${wanted.join(", ")})`,
    );
    assert.match(
      body,
      /transition\s*:\s*none/,
      `${label}: transisi harus dimatikan saat \`is-navigating\` supaya konten lama ` +
        "langsung blank (kalau tidak: memudar keluar dulu, baru yang baru muncul)",
    );
    assert.match(
      body,
      /transform\s*:\s*none/,
      `${label}: transform juga harus dinolkan supaya saat muncul tidak ada gerakan ` +
        "(canvas scale .95 → 1, judul geser 4px)",
    );
  }
});
