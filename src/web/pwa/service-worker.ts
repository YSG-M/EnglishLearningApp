/// <reference lib="webworker" />
import { rangeResponse } from './range';
import { shouldUseCache } from './routing';
import type { WebManifest } from '../assets/types';
import { validateManifest, verifyResponse } from '../assets/manifest';

const scope = self as unknown as ServiceWorkerGlobalScope;
const base = new URL(scope.registration.scope);
const metaName = 'kaikou-meta-v1';
const releaseName = (id: string) => `kaikou-release-${id}`;
scope.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_CONFIRMED') event.waitUntil(scope.skipWaiting());
  if (event.data?.type === 'CLAIM_INITIAL_VERIFIED') {
    event.waitUntil(
      (async () => {
        try {
          const metadata = await caches.open(metaName);
          const stored = await metadata.match(new URL('__active', base).href);
          if (!stored) throw new Error('No activated offline release');
          const manifest = validateManifest(await stored.json());
          const cache = await caches.open(releaseName(manifest.releaseId));
          for (const file of manifest.files.filter((f) => f.required || f.weeks?.includes(1))) {
            const response = await cache.match(new URL(file.url, base).href);
            if (!response) throw new Error('Initial offline files are incomplete');
            await verifyResponse(response, file);
          }
          // Only the first, fully verified install asks to control its open page.
          await scope.clients.claim();
          event.ports[0]?.postMessage({ ok: true });
        } catch {
          event.ports[0]?.postMessage({ ok: false });
        }
      })(),
    );
  }
});
// Old caches are deliberately retained: a live old document may still import a lazy chunk.
// Cache cleanup never opens IndexedDB or the personal OPFS filesystem.
scope.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!shouldUseCache(request, base)) return;
  event.respondWith(
    (async () => {
      const metadata = await caches.open(metaName);
      const stored = await metadata.match(new URL('__active', base).href);
      const manifest: WebManifest | undefined = stored ? validateManifest(await stored.json()) : undefined;
      if (request.mode === 'navigate' && manifest) {
        const cache = await caches.open(releaseName(manifest.releaseId));
        const indexUrl = new URL('index.html', base).href;
        const index = manifest.files.find((f) => f.url === 'index.html');
        try {
          const response = await fetch(indexUrl, { cache: 'no-store' });
          if (index) {
            const valid = await verifyResponse(response, index);
            await cache.put(indexUrl, valid.clone());
            return valid;
          }
        } catch {
          /* An incomplete/new deployment must keep the activated release working. */
        }
        const fallback = await cache.match(indexUrl);
        if (fallback) return fallback;
        return new Response('Offline application shell is unavailable. Reconnect and retry.', {
          status: 503,
        });
      }
      // Exact immutable URLs also serve surviving clients from older releases.
      const names = (await caches.keys()).filter(
        (name) => name.startsWith('kaikou-release-') || name === 'kaikou-models-v1',
      );
      for (const name of names) {
        const cached = await (await caches.open(name)).match(request.url);
        if (cached) return rangeResponse(cached, request.headers.get('Range'));
      }
      // A fetched 206 fragment is never inserted into a complete-file cache.
      return fetch(request);
    })(),
  );
});
