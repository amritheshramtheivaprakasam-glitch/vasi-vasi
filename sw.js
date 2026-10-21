/* ============================================================
   Vasi Vasi — service worker
   Makes the app fully usable offline after the first visit:
   precaches the app shell, then serves same-origin GET
   requests cache-first while refreshing the cache in the
   background. No analytics, no remote calls of any kind.
   ============================================================ */
'use strict';

const VERSION = 'vasi-vasi-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './src/config.js',
  './src/util.js',
  './src/content/starterLibrary.js',
  './src/services/storage.js',
  './src/services/settingsStore.js',
  './src/services/libraryStore.js',
  './src/core/announcer.js',
  './src/core/documentParser.js',
  './src/core/speechEngine.js',
  './src/core/readerEngine.js',
  './src/ui/shortcuts.js',
  './src/ui/dialogs.js',
  './src/ui/libraryView.js',
  './src/ui/readerView.js',
  './src/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // offline: fall back to cache
      return cached || network;
    })
  );
});
