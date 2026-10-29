import type { WebManifest } from './types';

export function safeAssetPath(path: string): boolean {
  return (
    !!path &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes('%') &&
    !/[?#:]/.test(path) &&
    path.split('/').every((part) => part !== '..' && part !== '.' && part !== '')
  );
}

export function validateManifest(input: unknown): WebManifest {
  const m = input as WebManifest;
  if (
    !m ||
    m.schemaVersion !== 1 ||
    !/^[a-zA-Z0-9_-]+$/.test(m.releaseId) ||
    typeof m.contentHash !== 'string' ||
    typeof m.appVersion !== 'string' ||
    !safeAssetPath(m.bundle) ||
    !Array.isArray(m.files)
  )
    throw new Error('Invalid web manifest');
  const urls = new Set<string>();
  const clips = new Set<string>();
  for (const f of m.files) {
    if (
      !safeAssetPath(f.url) ||
      urls.has(f.url) ||
      !Number.isSafeInteger(f.bytes) ||
      f.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !['content', 'audio', 'model', 'shell', 'wasm'].includes(f.kind)
    )
      throw new Error(`Invalid asset: ${f.url}`);
    urls.add(f.url);
    if (f.kind === 'audio') {
      if (
        !f.clipKey ||
        clips.has(f.clipKey) ||
        !Array.isArray(f.weeks) ||
        f.weeks.some((w) => !Number.isInteger(w) || w < 1)
      )
        throw new Error(`Invalid clip: ${f.clipKey}`);
      clips.add(f.clipKey);
    }
    if (f.kind === 'model' && !f.modelId) throw new Error(`Missing model ID: ${f.url}`);
  }
  if (!m.files.some((f) => f.url === m.bundle && f.kind === 'content' && f.required))
    throw new Error('Missing content bundle');
  return m;
}

export async function verifyResponse(
  response: Response,
  file: { bytes: number; sha256: string },
): Promise<Response> {
  if (response.status !== 200) throw new Error(`Asset HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (bytes.byteLength !== file.bytes || hash !== file.sha256)
    throw new Error('Asset integrity check failed');
  return new Response(bytes, { status: 200, headers: response.headers });
}
