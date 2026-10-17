/* KeyQuest service worker. Built into dist/sw.js by the plugin in vite.config.ts, which fills in the
 * cache version and the list of files to precache. Everything is precached on install, so the installed
 * app works fully offline after the first visit. */
const CACHE = 'keyquest-__VERSION__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

// A new version waits until every open tab is closed (no skipWaiting), so a running game never has its
// files swapped underneath it. Old caches are removed once it takes over.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('keyquest-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // Network first, so a new deploy shows up on the next visit; the cached page keeps it working offline.
    event.respondWith(fetch(req).catch(() => caches.match('index.html', { ignoreSearch: true }).then((hit) => hit || caches.match('./'))))
    return
  }
  // Built files have content hashes in their names, so a cached copy is always the right one.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
})
