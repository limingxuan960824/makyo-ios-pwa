const VERSION = "makyo-shell-v6";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=6",
  "./app.js?v=6",
  "./rom-utils.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./vendor/emulatorjs/4.2.3/data/loader.js",
  "./vendor/emulatorjs/4.2.3/data/emulator.css",
  "./vendor/emulatorjs/4.2.3/data/version.json",
  "./vendor/emulatorjs/4.2.3/data/src/compression.js",
  "./vendor/emulatorjs/4.2.3/data/src/emulator.js",
  "./vendor/emulatorjs/4.2.3/data/src/GameManager.js",
  "./vendor/emulatorjs/4.2.3/data/src/gamepad.js",
  "./vendor/emulatorjs/4.2.3/data/src/nipplejs.js",
  "./vendor/emulatorjs/4.2.3/data/src/shaders.js",
  "./vendor/emulatorjs/4.2.3/data/src/socket.io.min.js",
  "./vendor/emulatorjs/4.2.3/data/src/storage.js",
  "./vendor/emulatorjs/4.2.3/data/localization/zh-CN.json",
  "./vendor/emulatorjs/4.2.3/data/compression/extract7z.js",
  "./vendor/emulatorjs/4.2.3/data/cores/reports/genesis_plus_gx.json",
  "./vendor/emulatorjs/4.2.3/data/cores/genesis_plus_gx-wasm.data",
  "./vendor/emulatorjs/4.2.3/data/cores/genesis_plus_gx-legacy-wasm.data"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("makyo-") && key !== VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match("./index.html")) || Promise.reject(error);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const update = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  });

  if (cached) {
    update.catch(() => {});
    return cached;
  }

  return update;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.startsWith("blob:")) return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
