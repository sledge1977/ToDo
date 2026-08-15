const cacheName = "todo-v17";
const appShell = [
  "/",
  "/app.css?v=17",
  "/app.js?v=17",
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // API mutations (POST/PATCH/DELETE) must never be served from the cache.
  // Calling Cache.match for these methods causes a NetworkError in Firefox.
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })),
  );
});
