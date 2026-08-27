/* Repair mojibake: file yang pernah dibaca ANSI lalu ditulis ulang UTF-8
   memiliki karakter U+0080-U+00FF palsu (hasil salah-dekode cp1252 atas
   byte UTF-8 asli). Pembalikan: dekode ulang tiap karakter ke byte
   cp1252-nya, lalu interpretasi hasilnya sebagai UTF-8.
   Pakai: node tools/repair-mojibake.mjs <file...> */
import { readFileSync, writeFileSync } from "node:fs";

const CP1252_HIGH = {
  "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
  "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
  "\u2030": 0x89, "\u0160": 0x8A, "\u2039": 0x8B, "\u0152": 0x8C,
  "\u017D": 0x8E, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
  "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
  "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9A, "\u203A": 0x9B,
  "\u0153": 0x9C, "\u017E": 0x9E, "\u0178": 0x9F,
};

function cp1252Byte(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0x80) return code;
  if (CP1252_HIGH[ch] !== undefined) return CP1252_HIGH[ch];
  if (code >= 0xa0 && code <= 0xff) return code;
  return null;
}

for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  let text = buf.toString("utf8").replace(/^\uFEFF/, "");
  if (!/[\u0080-\u00ff]/.test(text)) {
    console.log("SKIP (sudah bersih)", f);
    continue;
  }
  const bytes = [];
  let unmappable = 0;
  for (const ch of text) {
    const b = cp1252Byte(ch);
    if (b === null) {
      unmappable += 1;
      bytes.push(0x3f); // '?' agar tetap bisa divalidasi; akan terdeteksi di bawah
    } else {
      bytes.push(b);
    }
  }
  const recovered = Buffer.from(bytes);
  let out;
  try {
    out = new TextDecoder("utf8", { fatal: true }).decode(recovered);
  } catch (e) {
    console.error("GAGAL (bukan UTF-8 valid setelah pembalikan):", f, e.message);
    process.exitCode = 1;
    continue;
  }
  if (unmappable > 0) {
    console.error(
      `GAGAL (${unmappable} karakter tak terpetakan — file campuran?) periksa manual:`,
      f,
    );
    process.exitCode = 1;
    continue;
  }
  writeFileSync(f, out);
  const fixed = (out.match(/[\u0080-\u00ff]/g) || []).length;
  console.log(`DIPERBAIKI ${f} (sisa byte non-ASCII tunggal: ${fixed})`);
}
