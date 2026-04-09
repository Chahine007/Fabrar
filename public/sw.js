const CACHE_NAME = 'erp-shell-v4';
const CORE_ASSETS = [
  '/index.html',
  '/js/app.js',
  '/js/router.js',
  '/css/style.css'
];

const STATIC_EXTENSIONS = /\.(css|png|jpg|jpeg|gif|svg|webp|ico)$/i;
const STATIC_DESTINATIONS = new Set(['style', 'image', 'font']);
const HTML_OR_JS = /\.(html|js)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      CORE_ASSETS.map(async (asset) => {
        try {
          await cache.add(asset);
        } catch {
          // Ignore missing optional assets (e.g. /css/style.css)
        }
      })
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await clients.claim();
  })());
});

function isStaticRequest(request) {
  if (request.method !== 'GET') return false;
  if (STATIC_DESTINATIONS.has(request.destination)) return true;
  return STATIC_EXTENSIONS.test(new URL(request.url).pathname);
}

function isNetworkFirst(request) {
  if (request.method !== 'GET') return false;
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document' || request.destination === 'script') return true;
  return HTML_OR_JS.test(new URL(request.url).pathname);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const noStoreRequest = new Request(request, { cache: 'no-store' });
  try {
    const response = await fetch(noStoreRequest);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNetworkFirst(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticRequest(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
