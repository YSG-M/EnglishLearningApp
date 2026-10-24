import { describe, expect, it } from 'vitest';
import { introduceCard, isDue, reviewCard } from './srs';

const DAY = 86_400_000;
const t0 = new Date('2026-10-24T09:00:00+08:00');
const daysUntilDue = (due: string, from: Date) => (new Date(due).getTime() - from.getTime()) / DAY;

describe('srs', () => {
  it('brings a newly taught card back the next day', () => {
    const c = introduceCard('chunk:u01.c01', 'chunk', t0);
    const d = daysUntilDue(c.due, t0);
    expect(d).toBeGreaterThanOrEqual(0.9);
    expect(d).toBeLessThanOrEqual(1);
    expect(c.introducedAt).toBe(t0.toISOString());
    expect(c.reps).toBe(1);
  });

  it('spaces intervals out after successful reviews', () => {
    let now = t0;
    let c = introduceCard('word:hello', 'word', now);
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      now = new Date(c.due);
      c = reviewCard(c, 'good', now);
      intervals.push(daysUntilDue(c.due, now));
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!);
  });

  it('brings a forgotten card back soon and counts the lapse', () => {
    let c = introduceCard('word:thank', 'word', t0);
    let now = new Date(c.due);
    c = reviewCard(c, 'good', now);
    now = new Date(c.due);
    c = reviewCard(c, 'again', now);
    expect(c.lapses).toBe(1);
    expect(daysUntilDue(c.due, now)).toBeLessThanOrEqual(2.1);
  });

  it('keeps id, kind and introduction time across reviews', () => {
    const c = introduceCard('pair:p17.m01', 'pair', t0);
    const r = reviewCard(c, 'hard', new Date(c.due));
    expect(r).toMatchObject({ id: c.id, kind: 'pair', introducedAt: c.introducedAt });
  });

  it('isDue compares against the given cut-off', () => {
    const c = introduceCard('word:hi', 'word', t0);
    expect(isDue(c, t0)).toBe(false);
    expect(isDue(c, new Date(new Date(c.due).getTime() + 1))).toBe(true);
  });
});
