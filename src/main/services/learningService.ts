/**
 * The learning loop: today's plan, finishing parts, reviews, hints, progress and settings.
 * All rules live in src/shared/domain; this class only loads state, applies them and saves.
 */
import {
  cardId,
  parseCardId,
  type CardKind,
  type ContentBundle,
  type Part,
} from '../../shared/content/bundle';
import { addDays, endOfDay, toDay, type DayString } from '../../shared/domain/dates';
import { chooseExercise, isCorrect } from '../../shared/domain/exercise';
import { planToday, type TodayPlan } from '../../shared/domain/planner';
import { introduceCard, reviewCard } from '../../shared/domain/srs';
import { markStudyDay, MIN_ACTIVE_MS, reconcileStreak } from '../../shared/domain/streak';
import type {
  CompletePartInput,
  CompletePartResult,
  ProgressStats,
  ReviewCardView,
  ReviewSubmission,
  TodayView,
} from '../../shared/ipc';
import { Settings } from '../../shared/settings';
import type { Clock } from '../clock';
import type { Database } from '../db/database';
import type { Repositories } from '../db/repositories';
import { AppError } from '../errors';
import type { Logger } from '../logger';

/** Interval (days) from which a card counts as "really remembered". */
export const MATURE_DAYS = 21;
const ACTIVITY_DAYS = 28;
/** A single active-time report larger than this is a stuck timer, not study. */
const MAX_ACTIVE_SLICE_MS = 10 * 60_000;

export interface LearningDeps {
  db: Database;
  repos: Repositories;
  content: () => ContentBundle;
  clock: Clock;
  logger: Logger;
  /** Whether speech recognition can be used for speaking exercises right now. */
  speechAvailable: () => boolean;
}

export class LearningService {
  constructor(private readonly d: LearningDeps) {}

  private today(): DayString {
    return toDay(this.d.clock.now());
  }

  // ---------------------------------------------------------------- today

  getToday(): TodayView {
    return this.d.db.transaction(() => {
      this.reconcileOncePerDay();
      return this.buildTodayView();
    });
  }

  addActiveTime(ms: number): TodayView {
    return this.d.db.transaction(() => {
      this.reconcileOncePerDay();
      this.d.repos.activity.addActiveMs(this.today(), Math.min(ms, MAX_ACTIVE_SLICE_MS));
      this.evaluateDay();
      return this.buildTodayView();
    });
  }

  private reconcileOncePerDay(): void {
    const day = this.today();
    const act = this.d.repos.activity.get(day);
    if (act.reconciled) return;
    const r = reconcileStreak(this.d.repos.streak.get(), day);
    this.d.repos.streak.set(r.state);
    this.d.repos.activity.markReconciled(day, r.restCardsUsed, r.streakReset);
    if (r.restCardsUsed || r.streakReset) {
      this.d.repos.events.add(
        'streak',
        { day, restCardsUsed: r.restCardsUsed, streakReset: r.streakReset },
        this.d.clock.now(),
      );
      this.d.logger.info('streak reconciled', {
        day,
        restCardsUsed: r.restCardsUsed,
        streakReset: r.streakReset,
      });
    }
  }

  private plan(): TodayPlan {
    const now = this.d.clock.now();
    const day = toDay(now);
    const bundle = this.d.content();
    const settings = this.d.repos.settings.get();
    return planToday({
      today: day,
      dueCardIds: this.d.repos.cards
        .dueIds(endOfDay(now).toISOString())
        .filter((id) => this.itemExists(bundle, id)),
      reviewCap: settings.reviewCap,
      reviewsDoneToday: this.d.repos.reviewLogs.countOnDay(day),
      parts: bundle.parts,
      completedPartIds: new Set(this.d.repos.parts.listIds()),
      partsCompletedToday: this.d.repos.parts.countOnDay(day),
      recentReviews: this.d.repos.reviewLogs.accuracyBetween(addDays(day, -6), day),
      lastStudyDay: this.d.repos.activity.lastCountedBefore(day),
    });
  }

  private buildTodayView(plan: TodayPlan = this.plan()): TodayView {
    const day = this.today();
    const act = this.d.repos.activity.get(day);
    return {
      today: day,
      plan,
      streak: this.d.repos.streak.get(),
      restCardsUsedToday: act.restCardsUsed,
      streakResetToday: act.streakReset,
      activeMsToday: act.activeMs,
      dayCounted: act.counted,
      partsCompletedToday: this.d.repos.parts.countOnDay(day),
      reviewsDoneToday: this.d.repos.reviewLogs.countOnDay(day),
    };
  }

  /**
   * A day counts once she has studied 5 minutes, finished a part, or cleared today's reviews
   * (a short day that finishes its work still counts).
   */
  private evaluateDay(): void {
    const day = this.today();
    const act = this.d.repos.activity.get(day);
    if (act.counted) return;
    const plan = this.plan();
    const reviewsDone = this.d.repos.reviewLogs.countOnDay(day);
    const counts =
      act.activeMs >= MIN_ACTIVE_MS ||
      this.d.repos.parts.countOnDay(day) > 0 ||
      (reviewsDone > 0 && plan.reviewIds.length === 0);
    if (!counts) return;
    this.d.repos.activity.markCounted(day);
    this.d.repos.streak.set(markStudyDay(this.d.repos.streak.get(), day));
  }

  // ---------------------------------------------------------------- parts

  completePart(input: CompletePartInput): CompletePartResult {
    const bundle = this.d.content();
    const part = bundle.parts.find((p) => p.id === input.partId);
    if (!part) throw new AppError('NOT_FOUND', '找不到这节课。');
    return this.d.db.transaction(() => {
      this.reconcileOncePerDay();
      const now = this.d.clock.now();
      const day = toDay(now);
      let introduced = 0;
      if (!this.d.repos.parts.isComplete(part.id)) {
        for (const id of cardsForPart(bundle, part)) {
          if (this.d.repos.cards.has(id)) continue;
          this.d.repos.cards.upsert(introduceCard(id, parseCardId(id).kind, now));
          introduced++;
        }
        this.d.repos.parts.complete(part.id, now.toISOString(), day, input.activeMs);
        this.d.repos.activity.increment(day, 'parts');
        this.d.logger.info('part completed', { partId: part.id, cardsIntroduced: introduced });
      }
      this.d.repos.activity.addActiveMs(day, Math.min(input.activeMs, MAX_ACTIVE_SLICE_MS * 3));
      this.evaluateDay();
      return { cardsIntroduced: introduced, today: this.buildTodayView() };
    });
  }

  listCompletedParts(): string[] {
    return this.d.repos.parts.listIds();
  }

  // ---------------------------------------------------------------- review

  getReviewQueue(): ReviewCardView[] {
    const plan = this.d.db.transaction(() => {
      this.reconcileOncePerDay();
      return this.plan();
    });
    return this.toViews(plan.reviewIds);
  }

  submitReview(input: ReviewSubmission): TodayView {
    return this.d.db.transaction(() => {
      const card = this.d.repos.cards.get(input.cardId);
      if (!card) throw new AppError('NOT_FOUND', '找不到这张复习卡片。');
      const now = this.d.clock.now();
      const day = toDay(now);
      this.d.repos.cards.upsert(reviewCard(card, input.grade, now));
      this.d.repos.reviewLogs.insert({
        cardId: card.id,
        exercise: input.exercise,
        grade: input.grade,
        correct: isCorrect(input.grade),
        activeMs: input.activeMs,
        reviewedAt: now.toISOString(),
        day,
      });
      this.d.repos.activity.increment(day, 'reviews');
      this.d.repos.activity.addActiveMs(day, Math.min(input.activeMs, MAX_ACTIVE_SLICE_MS));
      this.evaluateDay();
      return this.buildTodayView();
    });
  }

  /** Cards already introduced for a unit, for extra practice; nothing is rescheduled. */
  getPracticeSet(unitId: string): ReviewCardView[] {
    const bundle = this.d.content();
    const unit = bundle.units[unitId];
    if (!unit) throw new AppError('NOT_FOUND', '找不到这个单元。');
    const ids = [
      ...unit.chunks.map((c) => cardId('chunk', c.id)),
      ...unit.words.map((w) => cardId('word', w)),
    ];
    return this.toViews(ids.filter((id) => this.d.repos.cards.has(id)));
  }

  private toViews(ids: string[]): ReviewCardView[] {
    const speech = this.d.speechAvailable();
    return this.d.repos.cards.getMany(ids).map((c) => {
      const { kind, itemId } = parseCardId(c.id);
      return {
        cardId: c.id,
        kind,
        itemId,
        reps: c.reps,
        lapses: c.lapses,
        exercise: chooseExercise(kind, c.reps, speech),
      };
    });
  }

  private itemExists(bundle: ContentBundle, id: string): boolean {
    // Content updates may retire items; their cards simply stop appearing.
    const { kind, itemId } = parseCardId(id);
    return itemExistsInBundle(bundle, kind, itemId);
  }

  // ---------------------------------------------------------------- hints

  getHintProgress(): Record<string, number> {
    return this.d.repos.hints.all();
  }

  recordHintCorrect(keys: string[]): Record<string, number> {
    this.d.db.transaction(() => this.d.repos.hints.increment(keys));
    return this.d.repos.hints.all();
  }

  // ---------------------------------------------------------------- progress

  getStats(): ProgressStats {
    const day = this.today();
    const bundle = this.d.content();
    const from = addDays(day, -(ACTIVITY_DAYS - 1));
    const byDay = new Map(this.d.repos.activity.range(from, day).map((a) => [a.day, a]));
    const activity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
      const d = addDays(from, i);
      const a = byDay.get(d);
      return { day: d, activeMs: a?.activeMs ?? 0, counted: a?.counted ?? false };
    });
    const acc = this.d.repos.reviewLogs.accuracyBetween(addDays(day, -6), day);
    const completed = new Set(this.d.repos.parts.listIds());
    return {
      streak: this.d.repos.streak.get(),
      partsCompleted: bundle.parts.filter((p) => completed.has(p.id)).length,
      partsTotal: bundle.parts.length,
      cardsLearned: this.d.repos.cards.count(),
      cardsMature: this.d.repos.cards.countMature(MATURE_DAYS),
      reviewsTotal: this.d.repos.reviewLogs.count(),
      accuracy7d: acc.total ? acc.correct / acc.total : null,
      activity,
      troubleItems: this.d.repos.cards.mostLapsed(10),
    };
  }

  // ---------------------------------------------------------------- settings

  getSettings(): Settings {
    return this.d.repos.settings.get();
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const next = Settings.parse({ ...this.d.repos.settings.get(), ...patch });
    this.d.repos.settings.set(next);
    this.d.logger.info('settings updated', { keys: Object.keys(patch) });
    return next;
  }
}

/** Review cards a part creates: new sentences and words on "learn", sound pairs on "practice". */
export function cardsForPart(bundle: ContentBundle, part: Part): string[] {
  const ids: string[] = [];
  for (const uid of part.unitIds) {
    const unit = bundle.units[uid];
    if (!unit) continue;
    if (part.kind === 'learn') {
      ids.push(...unit.chunks.map((c) => cardId('chunk', c.id)));
      ids.push(...unit.words.map((w) => cardId('word', w)));
    } else if (part.kind === 'practice' && unit.phonics) {
      ids.push(...(bundle.phonics[unit.phonics]?.pairs ?? []).map((p) => cardId('pair', p.id)));
    }
  }
  return ids;
}

export function itemExistsInBundle(bundle: ContentBundle, kind: CardKind, itemId: string): boolean {
  if (kind === 'word') return itemId in bundle.lexicon;
  if (kind === 'chunk') {
    const unitId = itemId.split('.')[0] ?? '';
    return bundle.units[unitId]?.chunks.some((c) => c.id === itemId) ?? false;
  }
  const phonicsId = itemId.split('.')[0] ?? '';
  return bundle.phonics[phonicsId]?.pairs.some((p) => p.id === itemId) ?? false;
}
