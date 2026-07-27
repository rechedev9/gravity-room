/**
 * `api-cache` was used by older workers for both public responses and
 * authenticated `/api/exercises` responses. Cache Storage survives worker
 * upgrades, so remove the entire legacy cache while the replacement worker
 * installs. If the cache exists, activate this security migration immediately
 * instead of leaving the vulnerable worker in control behind the normal update
 * prompt. Clean installations retain the prompt-based update lifecycle.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const hadLegacyCache = await caches.has('api-cache');
      await caches.delete('api-cache');
      if (hadLegacyCache) {
        await self.skipWaiting();
      }
    })()
  );
});
