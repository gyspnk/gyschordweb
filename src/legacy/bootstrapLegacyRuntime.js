const PDF_JS_URL = 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
const APP_BUNDLE_URL = './js/app.bundle.min.js?v=1';
const SERVICE_WORKER_URL = './sw.min.js?v=1';

let bootPromise = null;

function loadScriptOnce({ id, src, type = 'text/javascript' }) {
  const existing = document.getElementById(id);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.type = type;

    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`Failed to load script: ${src}`)),
      { once: true }
    );

    document.head.appendChild(script);
  });
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
