/**
 * Development-only: trims raw content down to what is complete enough to compile, so the app
 * can run while later units are still being written. Never used for a release build.
 */
import type { CompileResult, RawContent } from '../../src/shared/content/compile';

export interface PartialResult {
  raw: RawContent;
  /** Human-readable list of what was left out and why. */
  dropped: string[];
}

interface WeekLike {
  week: number;
  units: string[];
  challengeBefore?: string;
  challengeAfter?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function toPartialContent(raw: RawContent): PartialResult {
  const dropped: string[] = [];
  const unitIds = new Set(
    raw.units
      .map((u) => (isRecord(u.data) && typeof u.data.id === 'string' ? u.data.id : ''))
      .filter(Boolean),
  );
  const phonicsIds = new Set(
    raw.phonics
      .map((p) => (isRecord(p.data) && typeof p.data.id === 'string' ? p.data.id : ''))
      .filter(Boolean),
  );

  const cur = isRecord(raw.curriculum.data) ? raw.curriculum.data : {};
  const weeks = Array.isArray(cur.weeks) ? (cur.weeks as WeekLike[]) : [];

  // Keep the leading run of weeks that have at least one written unit; week numbers stay
  // consecutive, so part ids remain the same as in the full course.
  const keptWeeks: WeekLike[] = [];
  for (const w of weeks) {
    const present = w.units.filter((u) => unitIds.has(u));
    if (present.length === 0) {
      dropped.push(`week ${w.week} and later: no unit written yet`);
      break;
    }
    for (const u of w.units) if (!unitIds.has(u)) dropped.push(`unit ${u} (week ${w.week}): not written yet`);
    keptWeeks.push({ ...w, units: present });
  }
  const scheduled = new Set(keptWeeks.flatMap((w) => w.units));

  const units = raw.units.flatMap((f) => {
    if (!isRecord(f.data)) return [f];
    const id = String(f.data.id ?? '');
    if (!scheduled.has(id)) {
      dropped.push(`unit ${id} (${f.file}): its week is not included yet`);
      return [];
    }
    const phonics = f.data.phonics;
    if (typeof phonics === 'string' && !phonicsIds.has(phonics)) {
      dropped.push(`unit ${id}: phonics ${phonics} not written yet, left out`);
      const { phonics: _omit, ...rest } = f.data;
      return [{ file: f.file, data: rest }];
    }
    return [f];
  });

  return {
    raw: { ...raw, curriculum: { file: raw.curriculum.file, data: { ...cur, weeks: keptWeeks } }, units },
    dropped,
  };
}

const BROKEN_FILE = /^(content\/(?:units|phonics)\/[^:\s]+\.json)/;

/**
 * Builds the largest bundle that compiles: first trims unwritten weeks, then repeatedly drops
 * unit/phonics files that still have errors (e.g. a unit whose new words are not in the lexicon
 * yet). Lexicon or curriculum errors cannot be worked around and are returned as-is.
 */
export function compilePartial(
  input: RawContent,
  compile: (raw: RawContent) => CompileResult,
  maxRounds = 30,
): { result: CompileResult; dropped: string[] } {
  const dropped: string[] = [];
  let raw = input;
  for (let round = 0; round < maxRounds; round++) {
    const partial = toPartialContent(raw);
    for (const d of partial.dropped) if (!dropped.includes(d)) dropped.push(d);
    const result = compile(partial.raw);
    if (result.bundle) return { result, dropped };

    const broken = new Map<string, number>();
    for (const e of result.errors) {
      const file = BROKEN_FILE.exec(e)?.[1];
      if (file) broken.set(file, (broken.get(file) ?? 0) + 1);
    }
    if (broken.size === 0) return { result, dropped };
    for (const [file, n] of broken) dropped.push(`${file}: ${n} error(s), left out until fixed`);
    raw = {
      ...raw,
      units: raw.units.filter((f) => !broken.has(f.file)),
      phonics: raw.phonics.filter((f) => !broken.has(f.file)),
    };
  }
  return { result: compile(toPartialContent(raw).raw), dropped };
}
