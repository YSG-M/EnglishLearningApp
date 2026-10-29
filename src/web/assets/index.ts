import type { ContentBundle } from '../../shared/content/bundle';
import type { AssetFile, AssetsClient, DownloadState, WebManifest } from './types';
import { validateManifest, verifyResponse } from './manifest';
export type { AssetsClient, DownloadState, WebManifest, AssetFile } from './types';

export const releaseCache = (id: string) => `kaikou-release-${id}`;
export const modelCache = 'kaikou-models-v1';
export const metaCache = 'kaikou-meta-v1';
const initialState = (): DownloadState => ({
  phase: 'idle',
  completedBytes: 0,
  totalBytes: 0,
  completedFiles: 0,
  totalFiles: 0,
});

export async function createAssetsClient(baseUrl: string): Promise<AssetsClient> {
  return createClient(new URL(baseUrl, location.href), { fetch: globalThis.fetch.bind(globalThis), caches });
}

export async function createClient(
  base: URL,
  env: { fetch: typeof fetch; caches: CacheStorage },
): Promise<AssetsClient> {
  if (!base.pathname.endsWith('/')) throw new Error('Asset base must end with /');
  const url = (path: string) => new URL(path, base).href;
  const meta = await env.caches.open(metaCache);
  const activeKey = url('__active');
  let manifest: WebManifest;
  const stored = await meta.match(activeKey);
  if (stored) manifest = validateManifest(await stored.json());
  else {
    const response = await env.fetch(url('web-manifest.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot load resource manifest');
    manifest = validateManifest(await response.json());
  }
  let candidate: WebManifest | undefined;
  let paused = false;
  const controllers = new Set<AbortController>();
  let state = initialState();
  const modelStates = new Map<string, DownloadState>();
  const listeners = new Set<(s: DownloadState) => void>();
  const modelListeners = new Map<string, Set<(s: DownloadState) => void>>();
  let courseQueue = Promise.resolve();
  const publish = (next: DownloadState, modelId?: string) => {
    if (modelId) {
      modelStates.set(modelId, next);
      modelListeners.get(modelId)?.forEach((fn) => fn({ ...next }));
    } else {
      state = next;
      listeners.forEach((fn) => fn({ ...next }));
    }
  };
  // The shared pool limits course and model downloads together.
  let running = 0;
  const waiting: (() => void)[] = [];
  async function slot<T>(work: () => Promise<T>): Promise<T> {
    if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
    else running++;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  }
  async function download(files: AssetFile[], release: WebManifest, modelId?: string): Promise<void> {
    paused = false;
    const cache = await env.caches.open(modelId ? modelCache : releaseCache(release.releaseId));
    let progress: DownloadState = {
      ...initialState(),
      phase: 'downloading',
      totalBytes: files.reduce((s, f) => s + f.bytes, 0),
      totalFiles: files.length,
    };
    publish(progress, modelId);
    try {
      // Avoid counting corrupted or evicted files as offline-ready after a restart.
      let cursor = 0;
      let failure: unknown;
      const worker = async () => {
        while (cursor < files.length && !paused && !failure) {
          const file = files[cursor++]!;
          try {
            await slot(async () => {
              if (paused) return;
              const key = url(file.url);
              const existing = await cache.match(key);
              let valid: Response | undefined;
              if (existing) {
                try {
                  valid = await verifyResponse(existing, file);
                } catch {
                  await cache.delete(key);
                }
              }
              if (!valid) {
                const estimate =
                  typeof navigator !== 'undefined' ? await navigator.storage?.estimate() : undefined;
                if (estimate?.quota && estimate.usage && estimate.quota - estimate.usage < file.bytes)
                  throw new DOMException('Not enough storage for offline resources', 'QuotaExceededError');
                const controller = new AbortController();
                controllers.add(controller);
                try {
                  valid = await verifyResponse(
                    await env.fetch(key, { signal: controller.signal, cache: 'no-store' }),
                    file,
                  );
                  if (paused) return;
                  await cache.put(key, valid);
                } finally {
                  controllers.delete(controller);
                }
              }
              if (paused) return;
              progress = {
                ...progress,
                completedFiles: progress.completedFiles + 1,
                completedBytes: progress.completedBytes + file.bytes,
              };
              publish(progress, modelId);
            });
          } catch (error) {
            failure = error;
          }
        }
      };
      await Promise.all([worker(), worker()]);
      if (failure) throw failure;
      progress = { ...progress, phase: paused ? 'paused' : 'ready' };
      publish(progress, modelId);
      if (paused) throw new Error('Download paused');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        paused = true;
        controllers.forEach((controller) => controller.abort());
      }
      publish(
        {
          ...progress,
          phase: paused ? 'paused' : 'error',
          message: error instanceof Error ? error.message : String(error),
        },
        modelId,
      );
      throw error;
    }
  }
  async function required(release: WebManifest, weeks: number[]) {
    return download(
      release.files.filter(
        (f) => f.required || (f.kind === 'audio' && f.weeks?.some((w) => weeks.includes(w))),
      ),
      release,
    );
  }
  const weeksKey = url('__weeks');
  async function promisedWeeks(): Promise<number[]> {
    return ((await (await meta.match(weeksKey))?.json()) as number[] | undefined) ?? [];
  }
  const client: AssetsClient = {
    async getBundle() {
      const file = manifest.files.find((f) => f.url === manifest.bundle)!;
      const cache = await env.caches.open(releaseCache(manifest.releaseId));
      let response = await cache.match(url(file.url));
      if (response) {
        try {
          await verifyResponse(response.clone(), file);
        } catch {
          await cache.delete(url(file.url));
          response = undefined;
        }
      }
      if (!response) {
        await download([file], manifest);
        response = await cache.match(url(file.url));
      }
      const verified = await verifyResponse(response!, file);
      const bundle = (await verified.json()) as ContentBundle;
      if (bundle.contentHash !== manifest.contentHash) throw new Error('Content version mismatch');
      return bundle;
    },
    resolveClip(key) {
      const file = manifest.files.find((f) => f.clipKey === key);
      if (!file) throw new Error(`Unknown clip: ${key}`);
      return url(file.url);
    },
    getClipWeeks(key) {
      return [...(manifest.files.find((f) => f.clipKey === key)?.weeks ?? [])];
    },
    ensureWeeks(weeks) {
      if (
        weeks.some((w) => !Number.isInteger(w) || w < 1 || !manifest.files.some((f) => f.weeks?.includes(w)))
      )
        return Promise.reject(new Error('Unknown week'));
      const task = courseQueue
        .catch(() => undefined)
        .then(async () => {
          await required(manifest, weeks);
          const promised = [...new Set([...(await promisedWeeks()), ...weeks])].sort((a, b) => a - b);
          await meta.put(weeksKey, Response.json(promised));
          await meta.put(activeKey, Response.json(manifest));
        });
      courseQueue = task;
      return task;
    },
    async downloadModelFiles(id) {
      const files = manifest.files.filter((f) => f.modelId === id);
      if (!files.length) throw new Error('Model is not included in this release');
      await download(files, manifest, id);
    },
    async removeModelFiles(id) {
      const cache = await env.caches.open(modelCache);
      for (const f of manifest.files.filter((f) => f.modelId === id)) await cache.delete(url(f.url));
      publish(initialState(), id);
    },
    async modelFiles(id) {
      const files = manifest.files.filter((f) => f.modelId === id);
      if (!files.length) throw new Error('Model is not included');
      const cache = await env.caches.open(modelCache);
      return Promise.all(
        files.map(async (f) => {
          const res = await cache.match(url(f.url));
          if (!res) throw new Error('Model has not been downloaded');
          const verified = await verifyResponse(res, f);
          return { path: f.url, bytes: new Uint8Array(await verified.arrayBuffer()) };
        }),
      );
    },
    pause() {
      paused = true;
      controllers.forEach((c) => c.abort());
      publish({ ...state, phase: 'paused' });
    },
    subscribe(fn) {
      listeners.add(fn);
      fn({ ...state });
      return () => {
        listeners.delete(fn);
      };
    },
    getState: () => ({ ...state }),
    async getAvailableWeeks() {
      const cache = await env.caches.open(releaseCache(manifest.releaseId));
      const available: number[] = [];
      for (const week of await promisedWeeks()) {
        const files = manifest.files.filter(
          (f) => f.required || (f.kind === 'audio' && f.weeks?.includes(week)),
        );
        let complete = true;
        for (const f of files) {
          const res = await cache.match(url(f.url));
          try {
            if (!res) throw new Error('Missing');
            await verifyResponse(res, f);
          } catch {
            complete = false;
            break;
          }
        }
        if (complete) available.push(week);
      }
      return available;
    },
    getModelState: (id) => ({ ...(modelStates.get(id) ?? initialState()) }),
    subscribeModel(id, fn) {
      const set = modelListeners.get(id) ?? new Set();
      set.add(fn);
      modelListeners.set(id, set);
      fn({ ...(modelStates.get(id) ?? initialState()) });
      return () => {
        set.delete(fn);
      };
    },
    async checkForUpdate() {
      await courseQueue.catch(() => undefined);
      const response = await env.fetch(url('web-manifest.json'), { cache: 'no-store' });
      if (!response.ok) throw new Error('Update manifest unavailable');
      const next = validateManifest(await response.json());
      if (next.releaseId === manifest.releaseId) return false;
      try {
        await required(next, await promisedWeeks());
        candidate = next;
        await meta.put(url('__candidate'), Response.json(next));
        return true;
      } catch (error) {
        await env.caches.delete(releaseCache(next.releaseId));
        throw error;
      }
    },
    async activateUpdate() {
      await courseQueue.catch(() => undefined);
      if (!candidate) throw new Error('No verified update is ready');
      await required(candidate, await promisedWeeks());
      await meta.put(activeKey, Response.json(candidate));
      manifest = candidate;
      candidate = undefined;
      if (typeof navigator !== 'undefined') {
        const registration = await navigator.serviceWorker?.getRegistration(base.href);
        registration?.waiting?.postMessage({ type: 'ACTIVATE_CONFIRMED' });
      }
      if (typeof location !== 'undefined') location.reload();
    },
  };
  return client;
}
