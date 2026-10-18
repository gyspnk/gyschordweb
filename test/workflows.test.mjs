/* Regression test: konfigurasi GitHub Actions tetap valid & efisien.
 *
 * Riwayat masalah yang dijaga di sini:
 *  1) `verify.yml` memakai `docs/**` tanpa pengecualian → unggahan aset besar
 *     (pdf/midi/soundfont/logo) dan commit manifest otomatis tetap menjalankan
 *     `npm ci` + build padahal tidak ada yang perlu diverifikasi.
 *  2) `generate-assets-list.yml` memakai `docs/assets/**` → aset yang TIDAK
 *     dibaca script manifest (fonts/midi/soundfont/logo) memicu commit
 *     `sourceCommit` baru + satu deploy Pages tambahan yang sia-sia (satu
 *     unggahan aset = 2 deploy Pages, satu dibatalkan).
 *  3) Actions masih v4 (runtime Node 20, deprecated) dan `node-version: 20`
 *     (sudah EOL).
 *  4) Job summary workflow manifest selalu kosong karena `git diff --cached`
 *     dibaca SETELAH commit.
 *  5) Test regresi (`test/*.test.mjs`) tidak pernah dijalankan di CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const verify = read(".github/workflows/verify.yml");
const manifest = read(".github/workflows/generate-assets-list.yml");
const pkg = JSON.parse(read("package.json"));

const pathsBlock = (wf) => wf.slice(wf.indexOf("on:"), wf.indexOf("permissions:") === -1 ? undefined : wf.indexOf("permissions:"));

test("verify.yml: hanya dipicu perubahan yang relevan", () => {
  const paths = pathsBlock(verify);
  // Folder data murni tidak boleh memicu verifikasi…
  for (const dir of ["chord", "logo", "midi", "pdf", "soundfont"]) {
    assert.ok(
      paths.includes(`- "!docs/assets/${dir}/**"`),
      `verify.yml harus mengecualikan docs/assets/${dir}/**`,
    );
  }
  // …kecuali font (dibaca test icon subset).
  assert.ok(!paths.includes('- "!docs/assets/fonts/**"'), "fonts harus tetap dipantau (test icon subset)");
  // Manifest hasil commit otomatis tidak boleh memicu verifikasi ulang.
  for (const f of ["assets-list.json", "assets-chord-list.json", "assets-chord-manifest.json"]) {
    assert.ok(paths.includes(`- "!docs/${f}"`), `verify.yml harus mengabaikan docs/${f}`);
  }
  // Pola positif lama yang terlalu luas tidak boleh kembali.
  assert.ok(!/^\s*-\s*"docs\/assets\/\*\*"\s*$/m.test(paths), "docs/assets/** tidak boleh jadi pola positif");
});

test("verify.yml: aman & tidak menumpuk run", () => {
  assert.match(verify, /permissions:\s*\n\s*contents: read/, "verify.yml harus membatasi token ke contents: read");
  assert.match(verify, /concurrency:[\s\S]{0,200}?cancel-in-progress: true/, "verify.yml perlu concurrency cancel-in-progress");
  assert.match(verify, /timeout-minutes:\s*\d+/, "verify.yml perlu timeout-minutes");
});

test("verify.yml: menjalankan version check, build, dan seluruh test", () => {
  assert.match(verify, /run: npm run version:check/, "version:check harus dijalankan");
  assert.match(verify, /npm run build[\s\S]{0,400}?git diff --quiet/, "harus memastikan bundle sudah di-build ulang");
  assert.match(verify, /run: npm test/, "test regresi (test/*.test.mjs) harus dijalankan di CI");
});

test("generate-assets-list.yml: hanya dipicu berkas yang benar-benar dibaca script", () => {
  const paths = pathsBlock(manifest);
  assert.ok(!/^\s*-\s*'docs\/assets\/\*\*'\s*$/m.test(paths), "docs/assets/** terlalu luas; script manifest tidak membacanya");
  for (const need of [
    "- 'docs/assets/pdf/**'",
    "- 'docs/assets/chord/**'",
    "- 'docs/chord-sources.json'",
    "- 'docs/generate_assets_list.py'",
  ]) {
    assert.ok(paths.includes(need), `manifest workflow harus memicu ${need}`);
  }
  assert.match(manifest, /permissions:\s*\n\s*contents: write/, "workflow manifest butuh contents: write");
  assert.match(manifest, /timeout-minutes:\s*\d+/, "workflow manifest perlu timeout-minutes");
});

test("generate-assets-list.yml: job summary diambil sebelum commit", () => {
  const diffAt = manifest.indexOf("manifest-diff.txt");
  const commitAt = manifest.indexOf('git commit -m "Update asset manifests');
  assert.ok(diffAt > 0 && commitAt > diffAt, "diff ringkasan harus direkam SEBELUM commit (setelah commit, --cached kosong)");
  assert.match(manifest, /if:\s*always\(\)/, "ringkasan harus tetap ditulis walau ada langkah yang gagal");
});

test("generate-assets-list.yml: churn `sourceCommit` saja tidak di-commit", () => {
  // Setiap run menulis sourceCommit ke commit pemicu; bila isi manifest sama,
  // commit + deploy Pages tambahan harus dilewati (bandingkan tanpa baris itu).
  const skipAt = manifest.search(/grep -v '"sourceCommit"'/);
  const commitAt = manifest.indexOf('git commit -m "Update asset manifests');
  assert.ok(skipAt > 0, "perlu perbandingan manifest tanpa baris sourceCommit");
  assert.ok(skipAt < commitAt, "perbandingan itu harus terjadi SEBELUM commit");
  assert.match(manifest, /content_changed=0/, "perlu penanda perubahan isi manifest");
  assert.match(manifest, /manifest-note\.txt/, "alasan skip harus dicatat untuk job summary");
});

test("semua action memakai runtime non-deprecated (>= v5) dan Node LTS", () => {
  for (const wf of [verify, manifest]) {
    const uses = wf.match(/uses:\s*actions\/[\w-]+@v(\d+)/g) || [];
    assert.ok(uses.length > 0, "workflow harus memakai action actions/*");
    for (const line of uses) {
      const major = Number(/@v(\d+)$/.exec(line)[1]);
      assert.ok(major >= 5, `${line} masih memakai runtime Node 20 (deprecated); naikkan ke >= v5`);
    }
  }
  const nodeVer = /node-version:\s*"(\d+)"/.exec(verify);
  assert.ok(nodeVer && Number(nodeVer[1]) >= 22, `node-version di CI masih ${nodeVer?.[1]} (Node 20 sudah EOL)`);
});

test("package.json: tidak ada dependensi runtime (situs statis, alat uji = devDependencies)", () => {
  assert.ok(
    !pkg.dependencies || Object.keys(pkg.dependencies).length === 0,
    "docs/ adalah situs statis: playwright/esbuild hanya alat uji/build → taruh di devDependencies",
  );
  for (const dep of ["playwright", "@playwright/test", "esbuild"]) {
    assert.ok(pkg.devDependencies?.[dep], `${dep} harus ada di devDependencies`);
  }
});
