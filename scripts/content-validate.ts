/**
 * Validates everything under content/. Exits non-zero on any error.
 *
 *   npm run content:validate
 *   npm run content:validate -- --allow-missing   # while units are still being written
 *   npm run content:validate -- --warnings        # also list unused lexicon entries
 */
import { compileContent } from '../src/shared/content/compile';
import { loadRawContent, sha1 } from './lib/content-files';

const args = new Set(process.argv.slice(2));
const result = compileContent(loadRawContent(), sha1);

let errors = result.errors;
if (args.has('--allow-missing')) {
  errors = errors.filter(
    (e) => !/has no content file|refers to missing challenge|phonics p\d+ does not exist/.test(e),
  );
}
if (args.has('--warnings')) for (const w of result.warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);

if (errors.length) {
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
const b = result.bundle;
console.log(
  b
    ? `content ok: ${Object.keys(b.units).length} units, ${Object.keys(b.lexicon).length} words, ` +
        `${Object.keys(b.phonics).length} phonics units, ${b.parts.length} parts, ${Object.keys(b.clips).length} audio clips` +
        (result.warnings.length ? ` (${result.warnings.length} warnings, run with --warnings)` : '')
    : 'content ok (partial: some units missing)',
);
