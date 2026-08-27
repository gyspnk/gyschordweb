/* Build app.bundle.min.js + sw.min.js.
   Urutan concatenation HARUS sama dengan perilaku runtime lama:
   [midi-engine, app-core, viewer-core, ui-core, playlist-core]
   Gunakan fs.readFileSync utf8 (bukan PowerShell Get-Content, yang
   menghasilkan mojibake untuk karakter non-ASCII seperti ♯/♭). */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const order = [
  "js/midi-engine.js",
  "js/app-core.js",
  "js/viewer-core.js",
  "js/ui-core.js",
  "js/playlist-core.js",
];

const concat = order
  .map((f) => `\n/* === ${f} === */\n` + readFileSync(join(root, f), "utf8"))
  .join("\n");

const bundle = transformSync(concat, {
  minify: true,
  charset: "utf8",
  loader: "js",
}).code;
const MOJIBAKE_RE =
  // Pola hasil salah-dekode UTF-8 sebagai cp1252: 'â'/'Ã'/'Â' diikuti
  // karakter high-Latin/typografis palsu (menangkap â€¦, â€", â†', â™¯ dst).
  /[ÂÃâ][\u0080-\u00ff\u20ac\u201a\u0192\u201e\u2020\u2021\u02c6\u2030\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0160\u0161\u203a\u0153\u017e]/;
for (const [name, content] of [["app.bundle.min.js", bundle]]) {
  if (MOJIBAKE_RE.test(content)) {
    console.error(`FATAL: indikasi mojibake UTF-8 pada ${name}!`);
    process.exit(1);
  }
}
writeFileSync(join(root, "js/app.bundle.min.js"), bundle);
console.log(`app.bundle.min.js ${(bundle.length / 1024).toFixed(1)}kb`);

for (const name of ["sw.js", "js/midi-render-worker.js"]) {
  const out = transformSync(readFileSync(join(root, name), "utf8"), {
    minify: true,
    charset: "utf8",
    loader: "js",
  }).code;
  const target = name.replace(/\.js$/, ".min.js");
  writeFileSync(join(root, target), out);
  console.log(`${target} ${(out.length / 1024).toFixed(1)}kb`);
}
