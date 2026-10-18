#!/usr/bin/env node
/* Sinkronisasi versi & cache-buster.
 *
 * AKAR MASALAH "update otomatis tidak jalan": versi/`?v=` di-bump MANUAL di
 * banyak tempat (sw.js, ui-core.js, index.html, dan nilai hardcoded di bundle
 * React). Kalau salah satu lupa di-bump, aplikasi bisa tidak pernah update
 * atau justru reload berulang.
 *
 * Pakai:
 *   node tools/sync-version.mjs --check   # verifikasi konsistensi (CI)
 *   node tools/sync-version.mjs --bump    # naikkan semua + rebuild bundle
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => join(root, p);
const read = (p) => readFileSync(at(p), "utf8");
const write = (p, s) => writeFileSync(at(p), s);

const SW = "docs/sw.js";
const UI = "docs/js/ui-core.js";
const IDX = "docs/index.html";
const REACT = "docs/web/index-mRq1ab6k.js";

function readVersions() {
  const sw = read(SW);
  const react = read(REACT);
  const pick = (re, s) => {
    const m = re.exec(s);
    return m ? m[1] : null;
  };
  return {
    appVersion: pick(/APP_VERSION = "([^"]+)"/, sw),
    cacheNum: Number(pick(/CACHE_NAME = "gys-cache-v(\d+)"/, sw)),
    clientBuild: pick(/GYS_CLIENT_BUILD = "([^"]+)"/, read(UI)),
    idxBundle: Number(pick(/app\.bundle\.min\.js\?v=(\d+)/, read(IDX))),
    reactBundle: Number(pick(/app\.bundle\.min\.js\?v=(\d+)/, react)),
    reactSw: Number(pick(/sw\.min\.js\?v=(\d+)/, react)),
  };
}

function bumpPatch(version) {
  const parts = String(version).split(".").map((n) => parseInt(n, 10));
  if (parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`APP_VERSION tidak valid: ${version}`);
  }
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function check() {
  const v = readVersions();
  const problems = [];
  if (v.appVersion !== v.clientBuild) {
    problems.push(
      `APP_VERSION (${v.appVersion}) != GYS_CLIENT_BUILD (${v.clientBuild})`,
    );
  }
  if (v.idxBundle !== v.reactBundle) {
    problems.push(
      `index.html app.bundle ?v=${v.idxBundle} != bundle React (_s) ?v=${v.reactBundle}`,
    );
  }
  if (!v.appVersion || !Number.isFinite(v.cacheNum)) {
    problems.push("APP_VERSION / CACHE_NAME tidak terbaca di docs/sw.js");
  }
  if (problems.length) {
    console.error("Versi TIDAK sinkron:");
    problems.forEach((p) => console.error("  - " + p));
    console.error("\nPerbaiki dengan: npm run version:bump  (lalu commit)");
    process.exit(1);
  }
  console.log(
    `OK versi sinkron → APP=${v.appVersion}, cache v${v.cacheNum}, ` +
      `bundle v${v.idxBundle}, sw v${v.reactSw}`,
  );
}

function bump() {
  const v = readVersions();
  if (!v.appVersion) throw new Error("APP_VERSION tidak ditemukan di docs/sw.js");
  const nextVersion = bumpPatch(v.appVersion);
  const nextBundle = v.idxBundle + 1;
  const nextSw = v.reactSw + 1;
  const nextCache = v.cacheNum + 1;

  let sw = read(SW);
  sw = sw.replace(/APP_VERSION = "[^"]+"/, `APP_VERSION = "${nextVersion}"`);
  sw = sw.replace(
    /CACHE_NAME = "gys-cache-v\d+"/,
    `CACHE_NAME = "gys-cache-v${nextCache}"`,
  );
  write(SW, sw);

  let ui = read(UI);
  ui = ui.replace(
    /GYS_CLIENT_BUILD = "[^"]+"/,
    `GYS_CLIENT_BUILD = "${nextVersion}"`,
  );
  write(UI, ui);

  let idx = read(IDX);
  idx = idx.replace(
    /app\.bundle\.min\.js\?v=\d+/,
    `app.bundle.min.js?v=${nextBundle}`,
  );
  write(IDX, idx);

  let react = read(REACT);
  react = react.replace(
    /app\.bundle\.min\.js\?v=\d+/,
    `app.bundle.min.js?v=${nextBundle}`,
  );
  react = react.replace(/sw\.min\.js\?v=\d+/, `sw.min.js?v=${nextSw}`);
  write(REACT, react);

  console.log(
    `Versi → ${nextVersion} | cache v${nextCache} | bundle v${nextBundle} | sw v${nextSw}`,
  );
  console.log("Rebuild bundle…");
  execFileSync(process.execPath, [at("tools/build-bundle.mjs")], {
    stdio: "inherit",
  });
}

const arg = process.argv[2];
if (arg === "--check") check();
else if (arg === "--bump") bump();
else {
  console.error("Pakai: --check | --bump");
  process.exit(2);
}
