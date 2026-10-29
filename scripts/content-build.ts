/**
 * Compiles content/ into resources/content/bundle.json, the file the app loads.
 *
 *   npm run content:build
 *   npm run content:build -- --allow-missing   # dev only: build just the units written so far
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { compileContent } from '../src/shared/content/compile';
import { loadRawContent, ROOT, sha1 } from './lib/content-files';
import { compilePartial } from './lib/partial';
import { BUNDLE_FILE } from './lib/paths';

const allowMissing = process.argv.includes('--allow-missing');

const raw = loadRawContent();
const compile = (r: typeof raw) => compileContent(r, sha1);
let result;
if (allowMissing) {
  const partial = compilePartial(raw, compile);
  result = partial.result;
  if (partial.dropped.length) {
    console.warn('PARTIAL BUILD (development only) — left out:');
    for (const d of partial.dropped) console.warn(`  - ${d}`);
  }
} else {
  result = compile(raw);
}

for (const e of result.errors) console.error(`error: ${e}`);
if (!result.bundle) {
  console.error(`\nBuild failed: ${result.errors.length} error(s).`);
  if (!allowMissing)
    console.error('While units are still being written, try: npm run content:build -- --allow-missing');
  process.exit(1);
}

const b = result.bundle;
mkdirSync(dirname(BUNDLE_FILE), { recursive: true });
writeFileSync(BUNDLE_FILE, `${JSON.stringify(b)}\n`, 'utf8');
console.log(
  `wrote ${relative(ROOT, BUNDLE_FILE)}${allowMissing ? ' (PARTIAL)' : ''}: ` +
    `${Object.keys(b.units).length} units, ${Object.keys(b.lexicon).length} words, ` +
    `${Object.keys(b.phonics).length} phonics, ${b.parts.length} parts, ${Object.keys(b.clips).length} clips` +
    (result.warnings.length ? `, ${result.warnings.length} warnings` : ''),
);
