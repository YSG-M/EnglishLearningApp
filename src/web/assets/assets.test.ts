import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createClient, releaseCache, metaCache } from './index';
import { validateManifest } from './manifest';
import type { AssetFile, WebManifest } from './types';
import { clipWeeks, fileEntry } from '../../../scripts/web/asset-build';
import { tmpdir } from 'node:os';
import type { ContentBundle } from '../../shared/content/bundle';

class FakeCache {
  entries = new Map<string, Response>();
  async match(key: string) {
    return this.entries.get(key)?.clone();
  }
  async put(key: string, value: Response) {
    this.entries.set(key, value.clone());
  }
  async delete(key: string) {
    return this.entries.delete(key);
  }
}
class FakeCaches {
  entries = new Map<string, FakeCache>();
  async open(key: string) {
    if (!this.entries.has(key)) this.entries.set(key, new FakeCache());
    return this.entries.get(key)!;
  }
  async delete(key: string) {
    return this.entries.delete(key);
  }
  async keys() {
    return [...this.entries.keys()];
  }
}
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const makeFile = (
  url: string,
  body: string,
  kind: AssetFile['kind'],
  extra: Partial<AssetFile> = {},
): AssetFile => ({ url, bytes: Buffer.byteLength(body), sha256: digest(body), kind, ...extra });
function fixture() {
  const base = new URL('https://example.test/EnglishLearningApp/');
  const bundle = JSON.stringify({ contentHash: 'content' });
  const files = [
    makeFile('content/bundle.json', bundle, 'content', { required: true }),
    makeFile('audio/one.m4a', 'abc', 'audio', { clipKey: 'one', weeks: [1] }),
    makeFile('models/a.bin', 'model', 'model', { modelId: 'm' }),
  ];
  let manifest: WebManifest = {
    schemaVersion: 1,
    releaseId: 'one',
    appVersion: '1',
    contentHash: 'content',
    bundle: files[0]!.url,
    files,
    modelsIncluded: true,
  };
  const responses = new Map(files.map((f, i) => [new URL(f.url, base).href, [bundle, 'abc', 'model'][i]!]));
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const key = String(input);
    calls.push(key);
    if (key.endsWith('web-manifest.json')) return Response.json(manifest);
    return responses.has(key) ? new Response(responses.get(key)) : new Response(null, { status: 404 });
  };
  const caches = new FakeCaches();
  const create = (override: typeof fetch = fetcher) =>
    createClient(base, { fetch: override, caches: caches as unknown as CacheStorage });
  return {
    create,
    fetcher,
    caches,
    calls,
    base,
    files,
    responses,
    next: (m: WebManifest) => {
      manifest = m;
    },
    manifest,
  };
}
describe('assets integrity and recovery', () => {
  it('fails when a manifest source file is missing', () => {
    expect(() => fileEntry(tmpdir(), 'kaikou-missing-asset-test/not-present.m4a', 'audio')).toThrow();
  });
  it('runs two requests concurrently and pauses safely on quota failure', async () => {
    const f = fixture();
    let active = 0,
      maximum = 0;
    const fetcher: typeof fetch = async (input, options) => {
      if (String(input).endsWith('web-manifest.json')) return f.fetcher(input, options);
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      try {
        return await f.fetcher(input, options);
      } finally {
        active--;
      }
    };
    const client = await f.create(fetcher);
    const cache = await f.caches.open(releaseCache('one'));
    const put = cache.put.bind(cache);
    cache.put = async (key, value) => {
      if (key.includes('audio/')) throw new DOMException('Storage is full', 'QuotaExceededError');
      await put(key, value);
    };
    await expect(client.ensureWeeks([1])).rejects.toThrow('Storage is full');
    expect(maximum).toBe(2);
    expect(client.getState().phase).toBe('paused');
    expect(client.getState().completedFiles).toBeLessThan(2);
    expect(await client.getAvailableWeeks!()).toEqual([]);
  });
  it('stages a complete update until explicit activation and keeps old client assets', async () => {
    const f = fixture(),
      client = await f.create();
    await client.ensureWeeks([1]);
    f.next({ ...f.manifest, releaseId: 'two' });
    expect(await client.checkForUpdate()).toBe(true);
    const meta = await f.caches.open(metaCache);
    expect((await (await meta.match(new URL('__active', f.base).href))!.json()).releaseId).toBe('one');
    await client.activateUpdate();
    expect((await (await meta.match(new URL('__active', f.base).href))!.json()).releaseId).toBe('two');
    expect(await f.caches.keys()).toContain(releaseCache('one'));
  });
  it('rejects traversal, duplicate URLs, and duplicate clip keys', () => {
    const f = fixture();
    expect(() => validateManifest({ ...f.manifest, bundle: '../bad' })).toThrow();
    expect(() => validateManifest({ ...f.manifest, files: [...f.files, f.files[0]] })).toThrow();
    expect(() =>
      validateManifest({ ...f.manifest, files: [...f.files, { ...f.files[1], url: 'another' }] }),
    ).toThrow();
  });
  it('does not count corrupt downloads and resumes verified files on a new client', async () => {
    const f = fixture(),
      client = await f.create();
    f.responses.set(new URL('audio/one.m4a', f.base).href, 'bad');
    await expect(client.ensureWeeks([1])).rejects.toThrow('integrity');
    expect(client.getState().completedFiles).toBe(1);
    expect(await client.getAvailableWeeks!()).toEqual([]);
    f.responses.set(new URL('audio/one.m4a', f.base).href, 'abc');
    const resumed = await f.create();
    await resumed.ensureWeeks([1]);
    expect(resumed.getState().phase).toBe('ready');
    expect(await resumed.getAvailableWeeks!()).toEqual([1]);
    expect(f.calls.filter((c) => c.endsWith('bundle.json'))).toHaveLength(1);
    expect(resumed.resolveClip('one')).toBe('https://example.test/EnglishLearningApp/audio/one.m4a');
  });
  it('pauses after a verified file and resumes without downloading it again', async () => {
    const f = fixture(),
      client = await f.create();
    const unsub = client.subscribe((s) => {
      if (s.phase === 'downloading' && s.completedFiles === 1) client.pause();
    });
    await expect(client.ensureWeeks([1])).rejects.toThrow('paused');
    expect(client.getState().phase).toBe('paused');
    unsub();
    const cache = await f.caches.open(releaseCache('one'));
    const verifiedCalls = [...cache.entries.keys()].map(
      (key) => [key, f.calls.filter((call) => call === key).length] as const,
    );
    expect(verifiedCalls.length).toBeGreaterThan(0);
    await client.ensureWeeks([1]);
    expect(client.getState().completedFiles).toBe(2);
    for (const [key, count] of verifiedCalls)
      expect(f.calls.filter((call) => call === key)).toHaveLength(count);
  });
  it('keeps model progress separate and verifies model bytes before use', async () => {
    const f = fixture(),
      client = await f.create();
    await client.ensureWeeks([1]);
    const before = client.getState();
    await client.downloadModelFiles('m');
    expect(client.getState()).toEqual(before);
    expect(client.getModelState!('m').completedBytes).toBe(5);
    expect((await client.modelFiles('m'))[0]!.bytes).toEqual(new TextEncoder().encode('model'));
    await client.removeModelFiles('m');
    await expect(client.modelFiles('m')).rejects.toThrow();
  });
  it('keeps the active release and old cache when an update is interrupted', async () => {
    const f = fixture(),
      client = await f.create();
    await client.ensureWeeks([1]);
    const next = {
      ...f.manifest,
      releaseId: 'two',
      files: [...f.files, makeFile('missing.js', 'shell', 'shell', { required: true })],
    };
    f.next(next);
    await expect(client.checkForUpdate()).rejects.toThrow();
    expect(await f.caches.keys()).toContain(releaseCache('one'));
    expect(await f.caches.keys()).not.toContain(releaseCache('two'));
    const stored = await (await f.caches.open(metaCache)).match(new URL('__active', f.base).href);
    expect((await stored!.json()).releaseId).toBe('one');
  });
  it('fails the dependency build for a missing clip instead of inventing audio', () => {
    const bundle = {
      clips: {},
      units: { u: { week: 1, words: [], chunks: [{ audio: 'missing' }] } },
      lexicon: {},
      weeks: {},
      parts: [],
    } as unknown as ContentBundle;
    expect(() => clipWeeks(bundle)).toThrow('Missing clip');
  });
});
