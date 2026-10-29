import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileEntry, root } from './asset-files';
import { validateManifest } from '../../src/web/assets/manifest';

const source = process.argv.includes('--source');
const dir = join(root, source ? 'resources/web' : 'dist-web');
const manifest = validateManifest(JSON.parse(readFileSync(join(dir, 'web-manifest.json'), 'utf8')));
for (const file of manifest.files) {
  const actual = fileEntry(dir, file.url, file.kind);
  if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256)
    throw new Error(`Invalid output: ${file.url}`);
  if (
    file.url.endsWith('.js') &&
    /(?:from\s*["'](?:node:|electron|sherpa-onnx-node)|require\(["'](?:node:|electron|sherpa-onnx-node))/.test(
      readFileSync(join(dir, file.url), 'utf8'),
    )
  )
    throw new Error(`Native runtime import: ${file.url}`);
}
if (!source && !manifest.files.some((f) => f.url.endsWith('.wasm'))) throw new Error('SQLite WASM missing');
console.log(`Verified ${manifest.files.length} files, release ${manifest.releaseId}`);
