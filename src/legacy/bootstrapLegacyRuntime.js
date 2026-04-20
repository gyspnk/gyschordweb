const PDF_JS_URL = 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
const APP_BUNDLE_URL = './js/app.bundle.min.js?v=4';
const SERVICE_WORKER_URL = './sw.min.js?v=4';

let bootPromise = null;
const scriptLoadPromises = new Map();

function loadScriptOnce({ id, src, type = 'text/javascript' }) {
  const existingPromise = scriptLoadPromises.get(id);
  if (existingPromise) {
    return existingPromise;
  }

  const existing = document.getElementById(id);
  if (existing && existing.dataset.loaded === '1') {
    return Promise.resolve();
  }

  const loadPromise = new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    script.id = id;
    script.src = src;
    script.type = type;

    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = '1';
        scriptLoadPromises.delete(id);
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => {
        scriptLoadPromises.delete(id);
        reject(new Error(`Failed to load script: ${src}`));
      },
      { once: true }
    );

    if (!existing) {
      document.head.appendChild(script);
    }
  });

  scriptLoadPromises.set(id, loadPromise);
  return loadPromise;
}

function preloadOnce({ id, href, rel, as, crossOrigin = false }) {
  if (document.getElementById(id)) {
    return;
  }

  const link = document.createElement('link');
  link.id = id;
  link.rel = rel;
  link.href = href;
  if (as) {
    link.as = as;
  }
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const doRegister = () => {
    navigator.serviceWorker.register(SERVICE_WORKER_URL).catch((error) => {
      console.error('Service Worker registration failed', error);
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(doRegister, { timeout: 1500 });
  } else {
    window.setTimeout(doRegister, 300);
  }
}

export async function bootstrapLegacyRuntime() {
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    // Start network fetches early, but keep runtime execution order deterministic.
    preloadOnce({
      id: 'pdfjs-runtime-modulepreload',
      href: PDF_JS_URL,
      rel: 'modulepreload',
      crossOrigin: true,
    });
    preloadOnce({
      id: 'legacy-app-runtime-preload',
      href: APP_BUNDLE_URL,
      rel: 'preload',
      as: 'script',
    });

    await loadScriptOnce({
      id: 'pdfjs-runtime-module',
      src: PDF_JS_URL,
      type: 'module',
    });

    await loadScriptOnce({
      id: 'legacy-app-runtime',
      src: APP_BUNDLE_URL,
    });

    registerServiceWorker();
  })().catch((error) => {
    bootPromise = null;
    throw error;
  });

  return bootPromise;
}
