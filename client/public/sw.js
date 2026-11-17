const CACHE = "bomul-mobile-v3";
const THREE_JS = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const PRECACHE = [
  "/bomul.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/ar/course.html",
  "/ar/data/common.js",
  "/ar/data/courses.js",
  "/ar/data/gyeongbok.js",
  "/ar/js/treasure3d.js",
];

function isCourseApi(url) {
  return /\/api\/ar\/courses(\/|$)/.test(url.pathname);
}

function shouldHandle(url) {
  if (url.href === THREE_JS) return true;
  if (isCourseApi(url)) return true;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

async function fromNetwork(request, timeoutMs) {
  const cache = await caches.open(CACHE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: ctrl.signal });
    if (response && response.ok) {
      try { await cache.put(request, response.clone()); } catch { /* 일부 응답은 캐시에 넣지 못합니다. */ }
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("offline", { status: 503, statusText: "offline" });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!shouldHandle(url)) return;
  const timeoutMs = isCourseApi(url) ? 2500 : 8000;
  event.respondWith(fromNetwork(event.request, timeoutMs));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "prefetch-course" || !Array.isArray(data.urls)) return;
  const port = event.source;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let ok = 0;
    let fail = 0;
    for (const raw of data.urls) {
      if (typeof raw !== "string" || !raw) { fail += 1; continue; }
      try {
        const response = await fetch(raw, { cache: "reload" });
        if (response && response.ok) {
          await cache.put(raw, response);
          ok += 1;
        } else fail += 1;
      } catch {
        fail += 1;
      }
      if (port) port.postMessage({ type: "prefetch-progress", ok, fail, total: data.urls.length });
    }
    if (port) port.postMessage({ type: "prefetch-done", ok, fail, total: data.urls.length });
  })());
});
