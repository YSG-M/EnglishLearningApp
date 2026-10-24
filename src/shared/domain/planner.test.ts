import { describe, expect, it } from 'vitest';
import type { Part } from '../content/bundle';
import { computePace, MIN_REVIEWS_FOR_PACING, planToday, type PlannerInput } from './planner';

const part = (id: string, light = false): Part => ({
  id,
  kind: light ? 'challenge' : 'learn',
  week: 1,
  day: 1,
  title: id,
  unitIds: light ? [] : ['u01'],
  light,
});

const parts = [part('ch01', true), part('u01:learn'), part('u01:practice'), part('u01:apply')];

const base: PlannerInput = {
  today: '2026-10-24',
  dueCardIds: [],
  reviewCap: 20,
  reviewsDoneToday: 0,
  parts,
  completedPartIds: new Set(),
  partsCompletedToday: 0,
  recentReviews: { correct: 0, total: 0 },
  lastStudyDay: '2026-10-23',
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => `chunk:c${i}`);

describe('computePace', () => {
  it('stays normal until there is enough data', () => {
    expect(computePace({ correct: 1, total: MIN_REVIEWS_FOR_PACING - 1 }, 0, 20)).toBe('normal');
  });
  it('speeds up when accuracy is high and nothing is piling up', () => {
    expect(computePace({ correct: 18, total: 20 }, 5, 20)).toBe('fast');
  });
  it('slows down when accuracy is low', () => {
    expect(computePace({ correct: 10, total: 20 }, 5, 20)).toBe('consolidate');
  });
  it('slows down when more than two days of reviews are due', () => {
    expect(computePace({ correct: 20, total: 20 }, 41, 20)).toBe('consolidate');
  });
  it('does not speed up with a full day of reviews waiting', () => {
    expect(computePace({ correct: 19, total: 20 }, 25, 20)).toBe('normal');
  });
});

describe('planToday', () => {
  it('starts a new learner with the baseline challenge and the first lesson', () => {
    const plan = planToday(base);
    expect(plan.nextPart?.id).toBe('u01:learn');
    expect(plan.lightParts.map((p) => p.id)).toEqual(['ch01']);
    expect(plan.newPartRecommended).toBe(true);
  });

  it('caps reviews and never presents the rest as debt', () => {
    const plan = planToday({ ...base, dueCardIds: ids(35) });
    expect(plan.reviewIds).toHaveLength(20);
    expect(plan.deferredReviews).toBe(15);
  });

  it('subtracts reviews already done today from the cap', () => {
    const plan = planToday({ ...base, dueCardIds: ids(10), reviewsDoneToday: 15 });
    expect(plan.reviewIds).toHaveLength(5);
  });

  it('makes the first day back after a break lighter', () => {
    const plan = planToday({ ...base, dueCardIds: ids(30), lastStudyDay: '2026-10-18' });
    expect(plan.welcomeBack).toBe(true);
    expect(plan.reviewIds).toHaveLength(10);
  });

  it('recommends only one new part per normal day', () => {
    const plan = planToday({
      ...base,
      completedPartIds: new Set(['ch01', 'u01:learn']),
      partsCompletedToday: 1,
    });
    expect(plan.nextPart?.id).toBe('u01:practice');
    expect(plan.newPartRecommended).toBe(false);
  });

  it('offers a second part on a fast day', () => {
    const plan = planToday({
      ...base,
      completedPartIds: new Set(['ch01', 'u01:learn']),
      partsCompletedToday: 1,
      recentReviews: { correct: 19, total: 20 },
    });
    expect(plan.pace).toBe('fast');
    expect(plan.newPartRecommended).toBe(true);
  });

  it('suggests consolidation but still exposes the next part', () => {
    const plan = planToday({ ...base, recentReviews: { correct: 8, total: 20 } });
    expect(plan.pace).toBe('consolidate');
    expect(plan.newPartRecommended).toBe(false);
    expect(plan.nextPart?.id).toBe('u01:learn');
  });

  it('reports the end of the course', () => {
    const plan = planToday({ ...base, completedPartIds: new Set(parts.map((p) => p.id)) });
    expect(plan.nextPart).toBeNull();
    expect(plan.newPartRecommended).toBe(false);
  });
});
