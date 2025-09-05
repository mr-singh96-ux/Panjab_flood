const CACHE_NAME = "flood-coordination-v1"
const STATIC_CACHE = "flood-coordination-static-v1"

// Files to cache for offline use
const STATIC_FILES = ["/", "/victim", "/volunteer", "/admin", "/manifest.json"]

// Install event - cache static files
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker")
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static files")
        return cache.addAll(STATIC_FILES)
      })
      .then(() => {
        console.log("[SW] Static files cached successfully")
        return self.skipWaiting()
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("[SW] Service worker activated")
        return self.clients.claim()
      }),
  )
})

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return
  }

  // Skip Supabase API calls - handle them separately
  if (event.request.url.includes("supabase.co")) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        console.log("[SW] Serving from cache:", event.request.url)
        return response
      }

      // Otherwise fetch from network and cache
      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // If network fails, try to serve a cached fallback
          if (event.request.destination === "document") {
            return caches.match("/")
          }
        })
    }),
  )
})

// Background sync for offline data
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync triggered:", event.tag)

  if (event.tag === "flood-coordination-sync") {
    event.waitUntil(
      // Notify the main thread to sync data
      self.clients
        .matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "BACKGROUND_SYNC",
              action: "sync-offline-data",
            })
          })
        }),
    )
  }
})

// Handle messages from main thread
self.addEventListener("message", (event) => {
  console.log("[SW] Received message:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
