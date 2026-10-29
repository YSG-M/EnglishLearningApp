/**
 * Chooses how a review card is practised and maps the outcome to a scheduling grade.
 *
 * New-ish cards are recognised (listen and choose: easy, builds confidence); once she has seen a
 * card twice it switches to production (see Chinese, say English), which is what speaking needs.
 */
import type { CardKind } from '../content/bundle';
import type { Grade } from './srs';

export type ExerciseType = 'listen-choose' | 'speak-from-zh' | 'recall-self-rate' | 'pair-discriminate';

export const PRODUCTION_AFTER_REPS = 2;

export function chooseExercise(kind: CardKind, reps: number, speechAvailable: boolean): ExerciseType {
  if (kind === 'pair') return 'pair-discriminate';
  if (reps < PRODUCTION_AFTER_REPS) return 'listen-choose';
  return speechAvailable ? 'speak-from-zh' : 'recall-self-rate';
}

export type ExerciseOutcome =
  | { type: 'choice'; correct: boolean }
  | { type: 'speech'; passed: boolean; attempts: number; usedHint: boolean; gaveUp: boolean }
  | { type: 'self'; grade: Grade };

export function gradeOutcome(outcome: ExerciseOutcome): Grade {
  switch (outcome.type) {
    case 'choice':
      return outcome.correct ? 'good' : 'again';
    case 'self':
      return outcome.grade;
    case 'speech':
      if (outcome.gaveUp || !outcome.passed) return 'again';
      return outcome.attempts === 1 && !outcome.usedHint ? 'good' : 'hard';
  }
}

export function isCorrect(grade: Grade): boolean {
  return grade !== 'again';
}

/** Picks `count` distractors deterministically (stable across re-renders) from a pool. */
export function pickDistractors<T>(pool: T[], exclude: (t: T) => boolean, count: number, seed: string): T[] {
  const candidates = pool.filter((t) => !exclude(t));
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < count && used.size < candidates.length) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    const idx = h % candidates.length;
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(candidates[idx]!);
  }
  return out;
}

/** Deterministic shuffle so options don't jump around when a component re-renders. */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
