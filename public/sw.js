const CACHE_NAME = 'recifra-shell-v3';
const BASE_PATH = new URL('.', self.registration.scope).pathname;
const INDEX_URL = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(INDEX_URL, { cache: 'no-store' });
      if (response.ok) await cache.put(INDEX_URL, response.clone());
    } catch (error) {
      // A instalação não deve falhar apenas porque o cache offline não pôde ser atualizado.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('recifra-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;

  // NETWORK-FIRST: cada abertura/atualização busca o HTML publicado mais recente.
  // Isso evita servir um index.html antigo apontando para bundles removidos pelo Vite.
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(INDEX_URL, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(INDEX_URL);
      if (cached) return cached;
      return new Response('RECifra indisponível. Verifique sua conexão e tente novamente.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
