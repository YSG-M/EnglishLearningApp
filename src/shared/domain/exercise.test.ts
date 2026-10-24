import { describe, expect, it } from 'vitest';
import { chooseExercise, gradeOutcome, pickDistractors, stableShuffle } from './exercise';

describe('chooseExercise', () => {
  it('starts with recognition, then moves to speaking', () => {
    expect(chooseExercise('chunk', 1, true)).toBe('listen-choose');
    expect(chooseExercise('chunk', 2, true)).toBe('speak-from-zh');
    expect(chooseExercise('word', 5, true)).toBe('speak-from-zh');
  });
  it('falls back to self-rating when speech recognition is unavailable', () => {
    expect(chooseExercise('chunk', 3, false)).toBe('recall-self-rate');
  });
  it('always uses discrimination for phonics pairs', () => {
    expect(chooseExercise('pair', 0, true)).toBe('pair-discriminate');
    expect(chooseExercise('pair', 9, false)).toBe('pair-discriminate');
  });
});

describe('gradeOutcome', () => {
  it('maps choices', () => {
    expect(gradeOutcome({ type: 'choice', correct: true })).toBe('good');
    expect(gradeOutcome({ type: 'choice', correct: false })).toBe('again');
  });
  it('rewards a clean first attempt, and treats help as "hard"', () => {
    const speech = { type: 'speech' as const, passed: true, attempts: 1, usedHint: false, gaveUp: false };
    expect(gradeOutcome(speech)).toBe('good');
    expect(gradeOutcome({ ...speech, attempts: 2 })).toBe('hard');
    expect(gradeOutcome({ ...speech, usedHint: true })).toBe('hard');
    expect(gradeOutcome({ ...speech, passed: false })).toBe('again');
    expect(gradeOutcome({ ...speech, gaveUp: true })).toBe('again');
  });
  it('passes self-rating through', () => {
    expect(gradeOutcome({ type: 'self', grade: 'hard' })).toBe('hard');
  });
});

describe('deterministic helpers', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  it('picks distinct distractors, excluding the answer, stable per seed', () => {
    const one = pickDistractors(pool, (x) => x === 'c', 3, 'seed');
    expect(new Set(one).size).toBe(3);
    expect(one).not.toContain('c');
    expect(pickDistractors(pool, (x) => x === 'c', 3, 'seed')).toEqual(one);
  });
  it('returns fewer distractors when the pool is small', () => {
    expect(pickDistractors(['a', 'b'], (x) => x === 'a', 3, 's')).toEqual(['b']);
  });
  it('shuffles stably and keeps all items', () => {
    const s = stableShuffle(pool, 'x');
    expect([...s].sort()).toEqual(pool);
    expect(stableShuffle(pool, 'x')).toEqual(s);
  });
});
