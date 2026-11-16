const VERSION = "makyo-shell-v5";
const CORE_CACHE = "makyo-core-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=5",
  "./app.js?v=5",
  "./rom-utils.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![VERSION, CORE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.startsWith("blob:")) return;

  const url = new URL(event.request.url);
  const isCoreAsset = url.hostname === "cdn.emulatorjs.org";

  if (isCoreAsset) {
    event.respondWith(
      caches.open(CORE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") {
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cache = await caches.open(VERSION);
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        } catch (error) {
          if (event.request.mode === "navigate") return caches.match("./index.html");
          throw error;
        }
      })
    );
  }
});
