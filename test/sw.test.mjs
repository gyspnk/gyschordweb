import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swCode = readFileSync(join(root, "docs/sw.js"), "utf8");

const PDF = "https://mozilla.github.io/pdf.js/build/pdf.mjs";

function makeEnv({ cacheHit = false, networkOk = true } = {}) {
  const listeners = {};
  const store = new Map();
  if (cacheHit) {
    store.set(PDF, { marker: "CACHED", status: 200, type: "basic" });
  }

  const cacheObj = {
    match: async (req) => store.get(req.url || req),
    put: async (req, res) => {
      store.set(req.url || req, res);
    },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (req) => store.delete(req.url || req),
  };

  const sandbox = {
    self: {
      addEventListener: (type, handler) => {
        listeners[type] = handler;
      },
      skipWaiting() {},
      location: { origin: "https://site.example" },
      clients: { claim: async () => {}, matchAll: async () => [] },
    },
    caches: {
      keys: async () => ["gys-cache-v87"],
      open: async () => cacheObj,
      match: async (req) => store.get(req.url || req),
      delete: async () => true,
    },
    fetch: async (req) => {
      if (!networkOk) throw new Error("network down");
      return {
        marker: "NETWORK",
        status: 200,
        type: "basic",
        url: req.url || req,
        clone() {
          return this;
        },
      };
    },
    Response: { error: () => ({ marker: "ERROR", status: 0 }) },
    URL,
    Promise,
    console,
    Array,
    Object,
    RegExp,
    Map,
    Set,
  };

  vm.createContext(sandbox);
  vm.runInContext(swCode, sandbox);

  return async function handleFetch(urlStr) {
    let captured;
    listeners.fetch({
      request: { method: "GET", url: urlStr },
      respondWith(promise) {
        captured = promise;
      },
    });
    return captured ? await captured : undefined;
  };
}

test("pdf.js: network-first saat online (abaikan cache lama/rusak)", async () => {
  const res = await makeEnv({ cacheHit: true, networkOk: true })(PDF);
  assert.equal(res && res.marker, "NETWORK");
});

test("pdf.js: fallback ke cache saat offline", async () => {
  const res = await makeEnv({ cacheHit: true, networkOk: false })(PDF);
  assert.equal(res && res.marker, "CACHED");
});

test("pdf.worker.mjs juga network-first", async () => {
  const res = await makeEnv({ cacheHit: true, networkOk: true })(
    "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs",
  );
  assert.equal(res && res.marker, "NETWORK");
});

test("manifest chord selalu dari jaringan (tidak di-cache selamanya)", async () => {
  const res = await makeEnv({ networkOk: true })(
    "https://site.example/assets-chord-manifest.json",
  );
  assert.equal(res && res.marker, "NETWORK");
});

test("aset lokal berversi memakai stale-while-revalidate (cache dulu)", async () => {
  const res = await makeEnv({ cacheHit: false, networkOk: true })(
    "https://site.example/js/app.bundle.min.js?v=39",
  );
  assert.equal(res && res.marker, "NETWORK");
});
