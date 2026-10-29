/**
 * Validates everything under content/. Exits non-zero on any error.
 *
 *   npm run content:validate
 *   npm run content:validate -- --allow-missing   # while units are still being written
 *   npm run content:validate -- --warnings        # also list unused lexicon entries
 *   npm run content:validate -- --only u02,u03,w02  # just these units / week files (implies --allow-missing);
 *                                                  # earlier units are compiled too, other files' errors are hidden
 */
import { compileContent } from '../src/shared/content/compile';
import { loadRawContent, sha1 } from './lib/content-files';

const argv = process.argv.slice(2);
const args = new Set(argv);
const onlyArg = argv[argv.indexOf('--only') + 1];
const only = args.has('--only') && onlyArg ? onlyArg.split(',') : null;
const raw = loadRawContent();
// Units before the listed ones stay in, so "not taught yet" checks for stories see what came earlier.
const lastUnit =
  only
    ?.filter((id) => id.startsWith('u'))
    .sort()
    .at(-1) ?? 'u00';
const lastWeekUnit = only
  ?.filter((id) => id.startsWith('w'))
  .map((w) => {
    const units = (raw.curriculum.data as { weeks?: { week: number; units: string[] }[] }).weeks ?? [];
    return units.find((x) => `w${String(x.week).padStart(2, '0')}` === w)?.units.at(-1) ?? 'u00';
  })
  .sort()
  .at(-1);
const upTo = [lastUnit, lastWeekUnit ?? 'u00'].sort().at(-1)!;
if (only) raw.units = raw.units.filter((u) => (/\/(u\d{2})-/.exec(u.file)?.[1] ?? 'u99') <= upTo);
const result = compileContent(raw, sha1);
const mine = (msg: string) =>
  !only ||
  !/content\/(units|weeks)\//.test(msg) ||
  only.some((id) => msg.includes(id.startsWith('u') ? `/${id}-` : `/${id}.json`));

let errors = result.errors.filter(mine);
if (only || args.has('--allow-missing')) {
  errors = errors.filter(
    (e) => !/has no content file|refers to missing challenge|phonics p\d+ does not exist/.test(e),
  );
}
if (args.has('--warnings')) for (const w of result.warnings.filter(mine)) console.warn(`warning: ${w}`);
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
