import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { RawContent } from '../../src/shared/content/compile';

export const ROOT = resolve(__dirname, '..', '..');
export const CONTENT_DIR = join(ROOT, 'content');

export const sha1 = (text: string): string => createHash('sha1').update(text).digest('hex');

function readJson(file: string): { file: string; data: unknown } {
  const rel = relative(ROOT, file).split(sep).join('/');
  try {
    return { file: rel, data: JSON.parse(readFileSync(file, 'utf8')) as unknown };
  } catch (err) {
    throw new Error(`${rel}: invalid JSON: ${(err as Error).message}`);
  }
}

function readDir(dir: string): { file: string; data: unknown }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(join(dir, f)));
}

export function loadRawContent(contentDir = CONTENT_DIR): RawContent {
  return {
    curriculum: readJson(join(contentDir, 'curriculum.json')),
    lexicon: readDir(join(contentDir, 'lexicon')),
    units: readDir(join(contentDir, 'units')),
    phonics: readDir(join(contentDir, 'phonics')),
    weeks: readDir(join(contentDir, 'weeks')),
  };
}
