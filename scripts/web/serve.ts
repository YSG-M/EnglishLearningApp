import { createServer } from 'node:https';
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { rangeResponse } from '../../src/web/pwa/range';

const arg = (name: string, fallback = '') => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1]!;
};
const root = resolve(arg('--dir', 'dist-web'));
const base = arg('--base', process.env.WEB_BASE ?? '/');
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('--base must begin/end with /');
const cert = arg('--cert'),
  key = arg('--key');
if (!cert || !key) throw new Error('Provide --cert and --key for HTTPS');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.m4a': 'audio/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.onnx': 'application/octet-stream',
};
createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
  void (async () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'https://localhost').pathname);
    if (!pathname.startsWith(base)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const rel = pathname.slice(base.length) || 'index.html';
    const file = resolve(root, rel);
    if (
      !file.startsWith(`${root}${sep}`) ||
      rel.split('/').some((part) => part.startsWith('.')) ||
      !statSync(file, { throwIfNoEntry: false })?.isFile()
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    const bytes = readFileSync(file);
    const headers = new Headers({
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': /(?:index\.html|sw\.js|web-manifest\.json|manifest\.webmanifest)$/.test(rel)
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    });
    if (rel === 'sw.js') headers.set('Service-Worker-Allowed', base);
    const response = await rangeResponse(new Response(bytes, { headers }), req.headers.range ?? null);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  })().catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
}).listen(Number(arg('--port', '4173')), arg('--host', '127.0.0.1'), () =>
  console.log(`HTTPS listening on ${arg('--host', '127.0.0.1')}:${arg('--port', '4173')}${base}`),
);
