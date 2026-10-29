/**
 * Runs the real content through the compiler, so a broken content file fails `npm test`
 * (not only `npm run content:validate`).
 */
import { describe, expect, it } from 'vitest';
import { compileContent } from '../src/shared/content/compile';
import { loadRawContent, sha1 } from '../scripts/lib/content-files';

describe('shipped content', () => {
  const result = compileContent(loadRawContent(), sha1);

  it('compiles without errors', () => {
    expect(result.errors).toEqual([]);
  });

  it('covers 13 weeks', () => {
    expect(result.bundle?.parts.at(-1)?.week).toBe(13);
  });

  it('only uses red hints without 谐音, and gives every word a hint', () => {
    for (const w of Object.values(result.bundle?.lexicon ?? {})) {
      if (w.hint.grade === 'red') expect(w.hint.hanzi, w.text).toBeUndefined();
      else expect(w.hint.hanzi, w.text).toBeTruthy();
    }
  });

  it('gives every green / yellow word a pinyin line (the only form the UI shows)', () => {
    const missing = Object.values(result.bundle?.lexicon ?? {})
      .filter((w) => w.hint.grade !== 'red' && !w.hint.pinyin)
      .map((w) => w.text);
    expect(missing).toEqual([]);
  });
});
