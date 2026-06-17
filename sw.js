/**
 * ============================================================
 *  BLADE & CO. — sw.js (Service Worker para PWA)
 * ============================================================
 *  Permite que la app funcione sin conexión después de
 *  la primera visita, usando estrategia Cache First para
 *  recursos estáticos y Network First para datos de Supabase.
 * ============================================================
 */

const CACHE_NAME = 'blade-co-v1';

/** Archivos que se cachean al instalar el SW */
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './app.js',
  './admin.js',
  './config.js',
  './manifest.json'
];

// ── Instalación: cachear assets estáticos ─────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activación: limpiar caches viejos ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache First para estáticos, Network First para API ─
self.addEventListener('fetch', event => {
  const { request } = event;

  // No interceptar peticiones de Supabase (siempre ir a la red)
  if (request.url.includes('supabase.co')) {
    return; // dejar pasar sin cachear
  }

  // Cache First para el resto (archivos locales)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cachear respuestas válidas de recursos locales
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached); // si falla la red, devolver cache (si existe)
    })
  );
});
