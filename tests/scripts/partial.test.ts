import { describe, expect, it } from 'vitest';
import type { CompileResult, RawContent } from '../../src/shared/content/compile';
import { compilePartial, toPartialContent } from '../../scripts/lib/partial';

function raw(
  unitIds: string[],
  phonics: string[] = [],
  unitPhonics: Record<string, string> = {},
): RawContent {
  return {
    curriculum: {
      file: 'curriculum.json',
      data: {
        contentVersion: '0.1.0',
        weeks: [
          { week: 1, units: ['u01', 'u02'] },
          { week: 2, units: ['u03', 'u04'] },
          { week: 3, units: ['u05', 'u06'] },
        ],
      },
    },
    lexicon: [],
    units: unitIds.map((id) => ({
      file: `${id}.json`,
      data: { id, ...(unitPhonics[id] ? { phonics: unitPhonics[id] } : {}) },
    })),
    phonics: phonics.map((id) => ({ file: `${id}.json`, data: { id } })),
    weeks: [],
  };
}

const weeksOf = (r: RawContent) =>
  (r.curriculum.data as { weeks: { week: number; units: string[] }[] }).weeks;

describe('toPartialContent', () => {
  it('keeps the leading weeks that have written units, with the missing units removed', () => {
    const { raw: out, dropped } = toPartialContent(raw(['u01', 'u03', 'u04']));
    expect(weeksOf(out)).toEqual([
      { week: 1, units: ['u01'] },
      { week: 2, units: ['u03', 'u04'] },
    ]);
    expect(dropped).toContain('unit u02 (week 1): not written yet');
    expect(dropped.some((d) => d.startsWith('week 3'))).toBe(true);
  });

  it('stops at the first empty week so week numbers stay consecutive', () => {
    const { raw: out } = toPartialContent(raw(['u01', 'u05']));
    expect(weeksOf(out).map((w) => w.week)).toEqual([1]);
    expect(out.units.map((u) => (u.data as { id: string }).id)).toEqual(['u01']);
  });

  it('removes a reference to a phonics unit that is not written yet', () => {
    const { raw: out, dropped } = toPartialContent(raw(['u01', 'u02'], ['p01'], { u01: 'p01', u02: 'p02' }));
    const [u1, u2] = out.units.map((u) => u.data as { phonics?: string });
    expect(u1?.phonics).toBe('p01');
    expect(u2?.phonics).toBeUndefined();
    expect(dropped).toContain('unit u02: phonics p02 not written yet, left out');
  });

  it('leaves complete content untouched', () => {
    const input = raw(['u01', 'u02', 'u03', 'u04', 'u05', 'u06']);
    const { raw: out, dropped } = toPartialContent(input);
    expect(dropped).toEqual([]);
    expect(weeksOf(out)).toEqual(weeksOf(input));
  });
});

describe('compilePartial', () => {
  // Fake compiler: u02 is "broken" (as if its words were missing from the lexicon).
  const compile = (r: RawContent): CompileResult => {
    const ids = r.units.map((u) => (u.data as { id: string }).id);
    if (ids.includes('u02'))
      return { errors: ['content/units/u02.json u02.c01: "say" is not in the lexicon'], warnings: [] };
    return { errors: [], warnings: [], bundle: { units: ids } as never };
  };
  const named = (r: RawContent): RawContent => ({
    ...r,
    units: r.units.map((u) => ({ ...u, file: `content/units/${u.file}` })),
  });

  it('drops units that do not compile yet and builds the rest', () => {
    const { result, dropped } = compilePartial(named(raw(['u01', 'u02', 'u03'])), compile);
    expect(result.bundle).toEqual({ units: ['u01', 'u03'] });
    expect(dropped).toContain('content/units/u02.json: 1 error(s), left out until fixed');
  });

  it('gives up when the errors are not in a unit or phonics file', () => {
    const lexiconBroken = (): CompileResult => ({
      errors: ['content/lexicon/core.json: duplicate'],
      warnings: [],
    });
    const { result } = compilePartial(named(raw(['u01'])), lexiconBroken);
    expect(result.bundle).toBeUndefined();
    expect(result.errors).toEqual(['content/lexicon/core.json: duplicate']);
  });
});
