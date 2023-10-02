/* eslint-env serviceworker */
const version = "v1";
const staticCacheName = version + "_staticfiles";
const urlsToCache = [
  /* populated by update-service-worker.js, run by the `postbuild` command */
];

const cacheList = [staticCacheName];

self.addEventListener("install", (installEvent) => {
  // console.log("SW: Install");

  // Perform install steps
  skipWaiting();

  installEvent.waitUntil(
    caches.open(staticCacheName).then((cache) => {
      // console.log("SW: Deleting old cache items");
      return cache.keys().then((requests) => {
        return Promise.all(requests.map((request) => cache.delete(request))).then(() => {
          // console.log("SW: static cache, add all URLs");
          return cache.addAll(urlsToCache);
        });
      });
    }),
  );
});

self.addEventListener("activate", (activateEvent) => {
  // console.log("SW: Activate");

  activateEvent.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheList.includes(cacheName)) {
              return caches.delete(cacheName);
            } // end if
          }), // end map
        ); // end return Promise.all
      }) // end keys then
      .then(() => {
        /* eslint-disable-next-line no-undef */
        return clients.claim();
      }), // end then
  ); // end waitUntil
}); // end addEventListener

addEventListener("fetch", (fetchEvent) => {
  const request = fetchEvent.request;
  // When the user requests an HTML file
  // console.log("SW: Fetch - request.url", request.url);

  fetchEvent.respondWith(
    // Fetch that page from the network
    fetch(request)
      .then((responseFromFetch) => {
        // Put a copy in the cache
        // console.log("SW: request.url", request);

        // const acceptHeader = request.headers.get("Accept");
        // const isNotSocketIO = !request.url.includes("socket.io");
        // const isNotHTML = acceptHeader ? !acceptHeader.includes("text/html") : true;

        // if (isNotSocketIO && isNotHTML) {
        //   const copy = responseFromFetch.clone();
        //   fetchEvent.waitUntil(
        //     caches.open(staticCacheName).then((staticCache) => {
        //       console.log("SW: Fetch - put in cache");

        //       return staticCache.put(request, copy);
        //     }),
        //   );
        // } else {
        //   console.log("SW: Fetch - DO NOT put in cache");
        // }
        return responseFromFetch;
      })
      .catch(() => {
        // if html, get / from cache and return
        if (request.headers.get("Accept").includes("text/html")) {
          return caches.match("/").then((responseFromCache) => {
            if (responseFromCache) {
              // console.log("SW: matched `/`. responseFromCache:", responseFromCache);
              // console.log("SW: Fetch - fetch error, serve from cache");
              return responseFromCache;
            }
            // console.log("SW: Fetch - fetch error, not match in cache. Do nothing");
          });
        }
        return caches.match(request).then((responseFromCache) => {
          if (responseFromCache) {
            // console.log("SW: Fetch - fetch error, serve from cache");
            return responseFromCache;
          }
          // console.log("SW: Fetch - fetch error, not match in cache. Do nothing");
        });
      }),
  ); // end respondWith
  return; // Go no further
}); // end addEventListener
