/**
 * Decides what today's session contains: which reviews, which new part, and how fast to go.
 *
 * Pacing rules (docs/01-learning-method.md):
 *  - review accuracy > 85% over the last 7 days and no backlog  -> "fast": offer an extra part
 *  - accuracy < 70%, or more than two days' worth of reviews due -> "consolidate": suggest review only
 *  - otherwise "normal": one new part per day
 * Consolidation is a suggestion; she can always choose to learn new content anyway.
 */
import type { Part } from '../content/bundle';
import { daysBetween, type DayString } from './dates';

export type PaceMode = 'normal' | 'fast' | 'consolidate';

export const FAST_ACCURACY = 0.85;
export const SLOW_ACCURACY = 0.7;
/** Below this many recent reviews, accuracy is too noisy to act on. */
export const MIN_REVIEWS_FOR_PACING = 15;
/** After this many days away, the first day back is deliberately lighter. */
export const WELCOME_BACK_AFTER_DAYS = 3;

export interface PlannerInput {
  today: DayString;
  /** Ids of cards due by the end of today, most overdue first. */
  dueCardIds: string[];
  reviewCap: number;
  reviewsDoneToday: number;
  parts: Part[];
  completedPartIds: ReadonlySet<string>;
  partsCompletedToday: number;
  /** Correct / total reviews over the last 7 days. */
  recentReviews: { correct: number; total: number };
  lastStudyDay: DayString | null;
}

export interface TodayPlan {
  pace: PaceMode;
  welcomeBack: boolean;
  /** Reviews to do now, already capped. */
  reviewIds: string[];
  /** Due cards beyond today's cap: they wait for later days, and are never shown as a debt. */
  deferredReviews: number;
  /** The next regular part, or null if the course is finished. */
  nextPart: Part | null;
  /** Light parts (challenges) that come with the next part. */
  lightParts: Part[];
  /** Whether the next part is the recommended step for today (false = today's step is done, or consolidate). */
  newPartRecommended: boolean;
  accuracy: number | null;
}

export function computePace(recent: PlannerInput['recentReviews'], dueCount: number, cap: number): PaceMode {
  if (dueCount > cap * 2) return 'consolidate';
  if (recent.total < MIN_REVIEWS_FOR_PACING) return 'normal';
  const acc = recent.correct / recent.total;
  if (acc < SLOW_ACCURACY) return 'consolidate';
  if (acc > FAST_ACCURACY && dueCount <= cap) return 'fast';
  return 'normal';
}

export function planToday(input: PlannerInput): TodayPlan {
  const welcomeBack =
    input.lastStudyDay !== null && daysBetween(input.lastStudyDay, input.today) >= WELCOME_BACK_AFTER_DAYS;
  // Coming back after a break: a small, winnable session instead of a wall of reviews.
  const cap = welcomeBack ? Math.min(10, input.reviewCap) : input.reviewCap;
  const remaining = Math.max(0, cap - input.reviewsDoneToday);
  const reviewIds = input.dueCardIds.slice(0, remaining);
  const deferredReviews = Math.max(0, input.dueCardIds.length - reviewIds.length);

  const pace = computePace(
    input.recentReviews,
    input.dueCardIds.length + input.reviewsDoneToday,
    input.reviewCap,
  );

  const lightParts: Part[] = [];
  let nextPart: Part | null = null;
  for (const p of input.parts) {
    if (input.completedPartIds.has(p.id)) continue;
    if (p.light) {
      lightParts.push(p);
      continue;
    }
    nextPart = p;
    break;
  }

  const dailyQuota = pace === 'fast' ? 2 : 1;
  const newPartRecommended =
    nextPart !== null && pace !== 'consolidate' && input.partsCompletedToday < dailyQuota;
  const accuracy = input.recentReviews.total ? input.recentReviews.correct / input.recentReviews.total : null;

  return {
    pace,
    welcomeBack,
    reviewIds,
    deferredReviews,
    nextPart,
    lightParts,
    newPartRecommended,
    accuracy,
  };
}
