import { build } from 'vite';
import { cpSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileEntry, hash, root, writeChanged } from './asset-files';
import { validateManifest } from '../../src/web/assets/manifest';

async function main() {
  const output = join(root, 'dist-web');
  await build({ configFile: join(root, 'vite.web.config.ts'), publicDir: false });
  const source = join(root, 'resources/web');
  const manifest = validateManifest(JSON.parse(readFileSync(join(source, 'web-manifest.json'), 'utf8')));
  for (const file of manifest.files) {
    cpSync(join(source, file.url), join(output, file.url), { recursive: true });
  }
  cpSync(join(root, 'public/web'), output, { recursive: true });
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: output,
      emptyOutDir: false,
      target: 'es2022',
      lib: { entry: join(root, 'src/web/pwa/service-worker.ts'), formats: ['es'], fileName: () => 'sw.js' },
    },
  });
  function walk(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    );
  }
  const assetUrls = new Set(manifest.files.map((f) => f.url));
  for (const url of walk(output)) {
    if (
      assetUrls.has(url) ||
      url.startsWith('.') ||
      ['web-manifest.json', 'measurement.json', 'measure.ffconcat'].includes(url)
    )
      continue;
    manifest.files.push(fileEntry(output, url, url.endsWith('.wasm') ? 'wasm' : 'shell', { required: true }));
  }
  manifest.releaseId = hash(JSON.stringify(manifest.files));
  validateManifest(manifest);
  writeChanged(join(output, 'web-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
void main();
