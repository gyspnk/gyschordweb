const CACHE_NAME = "gys-cache-v84";
const APP_VERSION = "3.8.30";

self.addEventListener("install", (_event) => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME) {
							return caches.delete(cacheName);
						}
					}),
				);
			})
			.then(() => self.clients.claim())
			// Beri tahu semua halaman yang terbuka bahwa SW baru aktif agar
			// halaman dengan versi lama bisa menjalankan pembaruan otomatis.
			.then(() =>
				self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
					clients.forEach((client) => {
						try {
							client.postMessage({
								type: "SW_ACTIVATED",
								version: APP_VERSION,
							});
						} catch (_) {}
					});
				}),
			),
	);
});

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "GET_VERSION") {
		// Balas lewat port MessageChannel bila ada, dan tetap ke
		// event.source demi kompatibilitas dengan pola lama.
		if (event.ports && event.ports[0]) {
			try {
				event.ports[0].postMessage({
					type: "VERSION",
					version: APP_VERSION,
				});
			} catch (_) {}
		}
		if (event.source) {
			try {
				event.source.postMessage({ type: "VERSION", version: APP_VERSION });
			} catch (_) {}
		}
	}
	if (event.data && event.data.type === "CLEAR_CACHE") {
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(cacheNames.map((name) => caches.delete(name)));
			})
			.then(() => {
				// Balas lewat MessageChannel port bila ada (auto-update),
				// dan tetap ke event.source demi kompatibilitas.
				if (event.ports && event.ports[0]) {
					try {
						event.ports[0].postMessage({ type: "CACHE_CLEARED" });
					} catch (_) {}
				}
				if (event.source) {
					try {
						event.source.postMessage({ type: "CACHE_CLEARED" });
					} catch (_) {}
				}
			});
	}
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	// Parse URL safely
	var url;
	try {
		url = new URL(event.request.url);
	} catch (_) {
		return;
	}

	// NEVER cache dynamic assets — always network
	if (
		url.pathname.includes("/midi/") ||
		url.pathname.includes("/pdf/") ||
		url.pathname.includes("/chord/") ||
		url.pathname.includes("assets-list.json") ||
		url.pathname.includes("assets-lyrics.json") ||
		url.pathname.includes("assets-chord-list.json") ||
		// SoundFont besar (bisa ratusan MB) TIDAK di-cache di Cache API —
		// ia dikelola sendiri via IndexedDB (gys-sf-cache). Cache ganda
		// membuat quota storage cepat penuh dan browser bisa meng-evict
		// seluruh origin storage (termasuk localStorage playlist).
		url.pathname.endsWith(".sf2") ||
		url.pathname.endsWith(".sf3")
	) {
		event.respondWith(fetch(event.request));
		return;
	}

	// Local app files (JS, CSS, HTML): network-first, fallback to cache
	var isLocalAppFile =
		url.origin === self.location.origin &&
		(url.pathname.endsWith(".js") ||
			url.pathname.endsWith(".css") ||
			url.pathname.endsWith(".html") ||
			url.pathname === "/" ||
			url.pathname.endsWith("/"));

	if (isLocalAppFile) {
		// Aset ber-parameter versi (?v=N): stale-while-revalidate — balas
		// instan dari cache, sementara jaringan menyegarkan cache untuk
		// boot berikutnya. Aman karena konvensi repo menaikkan ?v= setiap
		// kali file diubah; index.html tetap network-first sehingga selalu
		// melihat URL ?v= terbaru.
		if (/[?&]v=/.test(url.search)) {
			event.respondWith(
				caches.open(CACHE_NAME).then((cache) =>
					cache.match(event.request).then((cachedResponse) => {
						var network = fetch(event.request)
							.then((networkResponse) => {
								if (networkResponse && networkResponse.status === 200) {
									cache.put(event.request, networkResponse.clone());
								}
								return networkResponse;
							})
							.catch(() => null);
						if (cachedResponse) return cachedResponse;
						return network.then((r) => r || Response.error());
					}),
				),
			);
			return;
		}
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) =>
				fetch(event.request)
					.then((networkResponse) => {
						if (networkResponse && networkResponse.status === 200) {
							cache.put(event.request, networkResponse.clone());
						}
						return networkResponse;
					})
					.catch(() =>
						caches
							.match(event.request)
							.then((cachedResponse) => cachedResponse || Response.error()),
					),
			),
		);
		return;
	}

	// All other assets (CDN scripts, fonts, images): cache-first
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}
			return fetch(event.request)
				.then((networkResponse) => {
					if (
						networkResponse &&
						(networkResponse.status === 200 ||
							networkResponse.type === "opaque")
					) {
						var responseToCache = networkResponse.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(event.request, responseToCache);
						});
					}
					return networkResponse;
				})
				.catch(() => Response.error());
		}),
	);
});
