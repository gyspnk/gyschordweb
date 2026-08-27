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
if (/â[™œž\u0080-\u00bf]/.test(bundle)) {
  console.error("FATAL: indikasi mojibake UTF-8 pada bundle!");
  process.exit(1);
}
writeFileSync(join(root, "js/app.bundle.min.js"), bundle);
console.log(`app.bundle.min.js ${(bundle.length / 1024).toFixed(1)}kb`);

for (const name of ["sw.js"]) {
  const out = transformSync(readFileSync(join(root, name), "utf8"), {
    minify: true,
    charset: "utf8",
    loader: "js",
  }).code;
  const target = name.replace(/\.js$/, ".min.js");
  writeFileSync(join(root, target), out);
  console.log(`${target} ${(out.length / 1024).toFixed(1)}kb`);
}
