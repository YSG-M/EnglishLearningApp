import { describe, expect, it } from 'vitest';
import { initialStreak, markStudyDay, MAX_REST_CARDS, reconcileStreak, type StreakState } from './streak';

const studyDays = (days: string[], start: StreakState = initialStreak) => days.reduce(markStudyDay, start);

describe('markStudyDay', () => {
  it('starts a streak on the first day', () => {
    const s = markStudyDay(initialStreak, '2026-10-24');
    expect(s).toMatchObject({ totalDays: 1, current: 1, best: 1, lastStudyDay: '2026-10-24' });
  });

  it('is idempotent within a day', () => {
    const once = markStudyDay(initialStreak, '2026-10-24');
    expect(markStudyDay(once, '2026-10-24')).toBe(once);
  });

  it('extends across consecutive days, including month ends', () => {
    const s = studyDays(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(s.current).toBe(3);
    expect(s.totalDays).toBe(3);
  });

  it('earns a rest card every 7 days, up to the maximum', () => {
    const days = Array.from({ length: 21 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const s = studyDays(days, { ...initialStreak, restCards: 0 });
    expect(s.restCards).toBe(MAX_REST_CARDS);
    expect(s.current).toBe(21);
  });

  it('never lowers the total when a streak restarts', () => {
    const s = studyDays(['2026-10-01', '2026-10-02', '2026-10-10']);
    expect(s.totalDays).toBe(3);
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });
});

describe('reconcileStreak', () => {
  it('does nothing when she studied yesterday', () => {
    const s = studyDays(['2026-10-23']);
    expect(reconcileStreak(s, '2026-10-24')).toEqual({ state: s, restCardsUsed: 0, streakReset: false });
  });

  it('spends a rest card for one missed day and keeps the streak going', () => {
    const s = studyDays(['2026-10-21', '2026-10-22']); // 1 rest card from the initial state
    const r = reconcileStreak(s, '2026-10-24');
    expect(r.restCardsUsed).toBe(1);
    expect(r.streakReset).toBe(false);
    expect(r.state.restCards).toBe(0);
    const after = markStudyDay(r.state, '2026-10-24');
    expect(after.current).toBe(3);
  });

  it('does not charge the same missed day twice', () => {
    const s = studyDays(['2026-10-22']);
    const first = reconcileStreak(s, '2026-10-24').state;
    expect(reconcileStreak(first, '2026-10-24').restCardsUsed).toBe(0);
  });

  it('restarts the streak gently when more days were missed than rest cards cover', () => {
    const s = studyDays(['2026-10-10']);
    const r = reconcileStreak(s, '2026-10-24');
    expect(r.streakReset).toBe(true);
    expect(r.state.current).toBe(0);
    expect(r.state.totalDays).toBe(1);
  });
});
