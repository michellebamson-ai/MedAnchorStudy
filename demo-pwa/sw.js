/*
 * Service worker for the MedAnchor Study demo.
 *
 * Plain, no build step, no imports. It precaches the whole app so it opens
 * with no connection, then serves from the cache first and falls back to the
 * network. Network-only for anything not in the list, so nothing 404s oddly.
 */

// Bump this when a file changes, or the old copy is served from cache.
const CACHE = "medanchor-demo-v1";

const PRECACHE = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache:false and reload bypass the HTTP cache so a stale copy of a file
      // never gets baked into the offline copy.
      .then((cache) =>
        cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GETs are cached. POSTing a form and replaying it from cache would
  // silently resubmit data.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Only store real, complete responses. Opaque and error responses
          // would poison the cache.
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: for a navigation, fall back to the shell.
          if (request.mode === "navigate") return caches.match("/index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
