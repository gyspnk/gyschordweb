import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Mencegah akar masalah "update otomatis tidak jalan": konstanta versi &
// cache-buster yang di-bump manual harus tetap sinkron.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const pick = (re, s) => {
  const m = re.exec(s);
  return m ? m[1] : null;
};

const sw = read("docs/sw.js");
const ui = read("docs/js/ui-core.js");
const idx = read("docs/index.html");
const react = read("docs/web/index-mRq1ab6k.js");
const swMin = read("docs/sw.min.js");

const appVersion = pick(/APP_VERSION = "([^"]+)"/, sw);
const cacheVersion = pick(/CACHE_NAME = "gys-cache-v(\d+)"/, sw);
const clientBuild = pick(/GYS_CLIENT_BUILD = "([^"]+)"/, ui);
const idxBundle = pick(/app\.bundle\.min\.js\?v=(\d+)/, idx);
const reactBundle = pick(/app\.bundle\.min\.js\?v=(\d+)/, react);

test("APP_VERSION (sw.js) === GYS_CLIENT_BUILD (ui-core.js)", () => {
  assert.ok(appVersion, "APP_VERSION tidak ditemukan");
  assert.equal(clientBuild, appVersion);
});

test("index.html bundle ?v === nilai bundle React (_s)", () => {
  assert.ok(idxBundle, "?v= app.bundle.min.js tidak ditemukan di index.html");
  assert.equal(reactBundle, idxBundle);
});

test("sw.min.js sudah di-build ulang dari sw.js", () => {
  assert.ok(
    swMin.includes(`APP_VERSION="${appVersion}"`),
    "APP_VERSION di sw.min.js tidak sama dengan sw.js — jalankan npm run build",
  );
  assert.ok(
    swMin.includes(`gys-cache-v${cacheVersion}`),
    "CACHE_NAME di sw.min.js tidak sama dengan sw.js — jalankan npm run build",
  );
});
