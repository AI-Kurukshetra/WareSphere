const CACHE_NAME = "ak-wms-static-v2";
const STATIC_ROUTES = ["/icon.svg", "/manifest.webmanifest"];

function shouldCache(request) {
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return false;
  }

  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/") ||
    STATIC_ROUTES.includes(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ROUTES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!shouldCache(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response.ok || request.url.includes("/api/")) {
          return response;
        }

        const responseClone = response.clone();

        void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));

        return response;
      });
    })
  );
});
