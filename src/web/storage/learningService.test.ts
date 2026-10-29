import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { DatabaseSync } from 'node:sqlite';
import { miniBundle } from '../../main/test-support/fixtures';
import { FakeClock } from '../../main/clock';
import { Database, migrate, type Row } from './database';
import { createRepositories } from './repositories';
import { LearningService } from './learningService';
import { silentLogger } from './support';

export function fakeDatabase(): Database {
  const raw = new DatabaseSync(':memory:');
  return new Database({
    exec: (sql, params) => {
      if (!params && /;.*\S/s.test(sql.replace(/;\s*$/, ''))) {
        raw.exec(sql);
        return [];
      }
      const stmt = raw.prepare(sql);
      return stmt.columns().length
        ? (stmt.all(...(params ?? [])) as Row[])
        : (stmt.run(...(params ?? [])), []);
    },
    close: () => raw.close(),
  });
}
export function createTestApp(options: { speechAvailable?: boolean; recordingsDir?: string } = {}) {
  const db = fakeDatabase();
  migrate(db);
  const bundle = miniBundle();
  const clock = new FakeClock('2026-11-02T09:00:00');
  const repos = createRepositories(db);
  const learning = new LearningService({
    db,
    content: () => bundle,
    clock,
    repos,
    logger: silentLogger,
    speechAvailable: () => options.speechAvailable ?? true,
  });
  return { db, bundle, clock, repos, learning };
}
export type TestApp = ReturnType<typeof createTestApp>;

let dir: string;
let t: TestApp;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaikou-learning-'));
  t = createTestApp({ recordingsDir: dir });
});
afterEach(() => {
  t.db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('a first day', () => {
  it('starts with the first lesson and the baseline challenge, nothing to review', () => {
    const v = t.learning.getToday();
    expect(v.today).toBe('2026-11-02');
    expect(v.plan.nextPart?.id).toBe('u01:learn');
    expect(v.plan.lightParts.map((p) => p.id)).toEqual(['ch01']);
    expect(v.plan.reviewIds).toEqual([]);
    expect(v.plan.newPartRecommended).toBe(true);
    expect(v.dayCounted).toBe(false);
  });

  it('finishing the learn part creates sentence and word cards and counts the day', () => {
    const r = t.learning.completePart({ partId: 'u01:learn', activeMs: 60_000 });
    expect(r.cardsIntroduced).toBe(4 + 3 + 6); // sentences + words + daily words not already in words
    expect(r.today.dayCounted).toBe(true);
    expect(r.today.streak).toMatchObject({ current: 1, totalDays: 1 });
    expect(r.today.plan.nextPart?.id).toBe('u01:practice');
    // The first review is the next day, not later today.
    expect(r.today.plan.reviewIds).toEqual([]);
  });

  it('completing a part twice is harmless', () => {
    t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    const again = t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    expect(again.cardsIntroduced).toBe(0);
    expect(t.repos.cards.count()).toBe(13); // 4 sentences + 3 words + 6 more 🏠 daily words
  });

  it('the practice part introduces the unit’s pattern examples and sound-pair cards', () => {
    const r = t.learning.completePart({ partId: 'u01:practice', activeMs: 0 });
    expect(r.cardsIntroduced).toBe(10);
    expect(r.firstTime).toBe(true);
    expect(t.repos.cards.has('pair:p01.m01')).toBe(true);
    expect(t.repos.cards.has('example:u01.e08')).toBe(true);
  });

  it('taking a part again adds only missing cards and does not count as a new part', () => {
    t.learning.completePart({ partId: 'u01:practice', activeMs: 0 });
    t.db.run("DELETE FROM cards WHERE id = 'example:u01.e01'");
    const r = t.learning.completePart({ partId: 'u01:practice', activeMs: 0 });
    expect(r).toMatchObject({ firstTime: false, cardsIntroduced: 1 });
    expect(r.today.partsCompletedToday).toBe(1);
  });

  it('rejects unknown parts with NOT_FOUND', () => {
    expect(() => t.learning.completePart({ partId: 'u99:learn', activeMs: 0 })).toThrow(AppError);
  });
});

describe('reviews', () => {
  beforeEach(() => {
    t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    // The first review interval comes from FSRS (shared/domain/srs.ts); 2 days covers it either way.
    t.clock.advanceDays(2);
  });

  it('brings new cards back within two days as listening exercises', () => {
    const q = t.learning.getReviewQueue();
    expect(q).toHaveLength(13);
    expect(new Set(q.map((c) => c.exercise))).toEqual(new Set(['listen-choose']));
  });

  it('counts the day once today’s reviews are all done, even if quick', () => {
    for (const c of t.learning.getReviewQueue()) {
      const v = t.learning.submitReview({
        cardId: c.cardId,
        exercise: c.exercise,
        grade: 'good',
        activeMs: 1000,
      });
      expect(v.reviewsDoneToday).toBeGreaterThan(0);
    }
    const v = t.learning.getToday();
    expect(v.reviewsDoneToday).toBe(13);
    expect(v.plan.reviewIds).toEqual([]);
    expect(v.dayCounted).toBe(true);
    expect(v.streak.current).toBe(2);
  });

  it('caps reviews per day and defers the rest without losing them', () => {
    t.learning.updateSettings({ reviewCap: 5 });
    const v = t.learning.getToday();
    expect(v.plan.reviewIds).toHaveLength(5);
    expect(v.plan.deferredReviews).toBe(8);
  });

  it('switches to speaking once a card has been seen twice', () => {
    const id = 'chunk:u01.c01';
    for (let i = 0; i < 3; i++) {
      t.learning.submitReview({ cardId: id, exercise: 'listen-choose', grade: 'good', activeMs: 0 });
    }
    expect(t.repos.cards.get(id)!.reps).toBeGreaterThanOrEqual(2);
    const views = t.learning.getPracticeSet({ scope: 'unit', unitId: 'u01' });
    expect(views.find((v) => v.cardId === id)?.exercise).toBe('speak-from-zh');
  });

  it('uses self-rating instead of speaking when speech recognition is unavailable', () => {
    t.db.close();
    t = createTestApp({ recordingsDir: dir, speechAvailable: false });
    t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    for (let i = 0; i < 3; i++) {
      t.learning.submitReview({
        cardId: 'chunk:u01.c01',
        exercise: 'listen-choose',
        grade: 'good',
        activeMs: 0,
      });
    }
    expect(
      t.learning.getPracticeSet({ scope: 'unit', unitId: 'u01' }).find((v) => v.cardId === 'chunk:u01.c01')
        ?.exercise,
    ).toBe('recall-self-rate');
  });

  it('practice sets: recent parts, one unit, or a random draw, without rescheduling', () => {
    t.learning.completePart({ partId: 'u01:practice', activeMs: 0 });
    const due = t.repos.cards.get('chunk:u01.c01')!.due;
    const recent = t.learning.getPracticeSet({ scope: 'recent' }).map((c) => c.cardId);
    expect(recent).toContain('chunk:u01.c01');
    expect(recent).toContain('example:u01.e01');
    expect(t.learning.getPracticeSet({ scope: 'unit', unitId: 'u01' })).toHaveLength(recent.length);
    expect(t.learning.getPracticeSet({ scope: 'random', count: 3 })).toHaveLength(3);
    expect(t.repos.cards.get('chunk:u01.c01')!.due).toBe(due);

    t.clock.advanceDays(8);
    expect(t.learning.getPracticeSet({ scope: 'recent' })).toEqual([]);
    expect(() => t.learning.getPracticeSet({ scope: 'unit', unitId: 'u99' })).toThrow(AppError);
  });

  it('rejects reviews of unknown cards', () => {
    expect(() =>
      t.learning.submitReview({
        cardId: 'chunk:nope',
        exercise: 'listen-choose',
        grade: 'good',
        activeMs: 0,
      }),
    ).toThrow(AppError);
  });

  it('records lapses for the trouble list', () => {
    t.learning.submitReview({ cardId: 'word:meet', exercise: 'listen-choose', grade: 'good', activeMs: 0 });
    t.clock.advanceDays(5);
    t.learning.submitReview({ cardId: 'word:meet', exercise: 'listen-choose', grade: 'again', activeMs: 0 });
    expect(t.learning.getStats().troubleItems[0]).toEqual({ cardId: 'word:meet', lapses: 1 });
  });
});

describe('study days and the streak', () => {
  it('needs 5 active minutes when nothing was finished', () => {
    expect(t.learning.addActiveTime(4 * 60_000).dayCounted).toBe(false);
    expect(t.learning.addActiveTime(60_000).dayCounted).toBe(true);
  });

  it('ignores absurdly large active-time slices', () => {
    expect(t.learning.addActiveTime(3_600_000).activeMsToday).toBe(10 * 60_000);
  });

  it('a missed day spends a rest card instead of breaking the streak', () => {
    t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    t.clock.advanceDays(2); // skipped one day
    const v = t.learning.getToday();
    expect(v.restCardsUsedToday).toBe(1);
    expect(v.streakResetToday).toBe(false);
    expect(v.streak.restCards).toBe(0);
    t.learning.addActiveTime(5 * 60_000);
    expect(t.learning.getToday().streak).toMatchObject({ current: 2, totalDays: 2 });
  });

  it('a long break restarts the streak but never the total', () => {
    t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    t.clock.advanceDays(5);
    const v = t.learning.getToday();
    expect(v.streakResetToday).toBe(true);
    expect(v.streak).toMatchObject({ current: 0, totalDays: 1, best: 1 });
    // Reconciliation happens once per day: reopening does not report it twice or spend more.
    expect(t.learning.getToday().restCardsUsedToday).toBe(0);
  });

  it('after a few days away the session is lighter (welcome back)', () => {
    t.learning.completePart({ partId: 'u01:learn', activeMs: 0 });
    t.learning.completePart({ partId: 'u02:learn', activeMs: 0 });
    t.clock.advanceDays(4);
    const v = t.learning.getToday();
    expect(v.plan.welcomeBack).toBe(true);
    expect(v.plan.reviewIds).toHaveLength(10);
    expect(v.plan.deferredReviews).toBe(8);
  });
});

describe('progress, hints and settings', () => {
  it('reports 28 days of activity, oldest first', () => {
    t.learning.addActiveTime(60_000);
    const s = t.learning.getStats();
    expect(s.activity).toHaveLength(28);
    expect(s.activity.at(-1)).toMatchObject({ day: '2026-11-02', activeMs: 60_000 });
    expect(s.partsTotal).toBe(t.bundle.parts.length);
  });

  it('counts correct answers per word for fading hints', () => {
    t.learning.recordHintCorrect(['hi', 'meet', 'hi']);
    expect(t.learning.recordHintCorrect(['hi'])).toEqual({ hi: 2, meet: 1 });
  });

  it('merges settings patches and validates them', () => {
    t.learning.updateSettings({ showHints: false });
    const s = t.learning.updateSettings({ reviewCap: 30 });
    expect(s).toMatchObject({ showHints: false, reviewCap: 30 });
    expect(() => t.learning.updateSettings({ reviewCap: 1000 })).toThrow();
  });
});
