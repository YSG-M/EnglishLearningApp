import { request } from 'node:https';
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import type { WebManifest } from '../../src/web/assets/types';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const base = new URL(arg('--origin', 'https://127.0.0.1:4173/'));
const ca = readFileSync(arg('--ca', '.certs/ca.pem'));
async function get(path: string, range?: string) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>(
    (resolve, reject) => {
      request(new URL(path, base), { ca, headers: range ? { Range: range } : {} }, (response) => {
        const parts: Buffer[] = [];
        response.on('data', (part: Buffer) => parts.push(part));
        response.on('end', () =>
          resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(parts) }),
        );
        response.on('error', reject);
      })
        .on('error', reject)
        .end();
    },
  );
}
async function main() {
  const index = await get('');
  assert.equal(index.status, 200);
  assert.match(String(index.headers['content-type']), /text\/html/);
  const manifestResponse = await get('web-manifest.json');
  assert.equal(manifestResponse.status, 200);
  const manifest = JSON.parse(manifestResponse.body.toString('utf8')) as WebManifest;
  const audio = manifest.files.find((f) => f.kind === 'audio')!;
  const full = await get(audio.url);
  assert.equal(full.status, 200);
  assert.equal(full.body.length, audio.bytes);
  const range = await get(audio.url, 'bytes=3-11');
  assert.equal(range.status, 206);
  assert.deepEqual(range.body, full.body.subarray(3, 12));
  assert.equal(range.headers['content-range'], `bytes 3-11/${audio.bytes}`);
  const invalid = await get(audio.url, `bytes=${audio.bytes}-`);
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers['content-range'], `bytes */${audio.bytes}`);
  const wasm = await get(manifest.files.find((f) => f.url.endsWith('.wasm'))!.url);
  assert.equal(wasm.headers['content-type'], 'application/wasm');
  const sw = await get('sw.js');
  assert.equal(sw.headers['service-worker-allowed'], base.pathname);
  console.log(
    `HTTPS certificate verified; index/manifest/full audio/206/416/WASM/SW scope passed at ${base.href}`,
  );
}
void main();
