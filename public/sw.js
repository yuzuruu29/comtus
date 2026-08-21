/* Comtus service worker — app-shell caching for the installed desktop app.
   Strategy: network-first for navigation (fresh UI), cache-first for hashed
   build assets and fonts. API calls (LLM providers, PayPal) are never
   touched. */

const VERSION = "comtus-shell-v1";
const SHELL = ["/", "/studio", "/manifest.json", "/favicon.svg", "/app-icon.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}) // partial precache is fine — runtime fills the rest
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const API_HOSTS = [
  "api.anthropic.com",
  "openrouter.ai",
  "api.groq.com",
  "api.deepseek.com",
  "opencode.ai",
  "api.cerebras.ai",
  "generativelanguage.googleapis.com",
  "paypal.com",
  "r.jina.ai",
];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) {
    // Fonts may be cached; APIs never are.
    if (!/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) return;
    if (API_HOSTS.some((h) => url.hostname.endsWith(h))) return;
  } else if (API_HOSTS.some((h) => url.hostname.endsWith(h))) {
    return;
  }

  if (req.mode === "navigate") {
    // Network-first navigation; fall back to cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match("/"))),
    );
    return;
  }

  // Cache-first for assets.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
