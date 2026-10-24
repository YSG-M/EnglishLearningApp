/**
 * Spaced-repetition scheduling (FSRS via ts-fsrs), behind a small serialisable card type so the
 * rest of the app never depends on the library's shapes.
 */
import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import type { CardKind } from '../content/bundle';

/** Only three answers: the learner never has to choose between four similar buttons. */
export type Grade = 'again' | 'hard' | 'good';

export interface StoredCard {
  id: string;
  kind: CardKind;
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
  introducedAt: string;
}

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 180,
  // Day-level intervals only: within-day relearning happens inside the session itself.
  enable_short_term: false,
  enable_fuzz: true,
});

const RATING: Record<Grade, Rating.Again | Rating.Hard | Rating.Good> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
};

function toFsrs(c: StoredCard): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: 0,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    ...(c.lastReview ? { last_review: new Date(c.lastReview) } : {}),
  };
}

function fromFsrs(id: string, kind: CardKind, introducedAt: string, c: Card): StoredCard {
  return {
    id,
    kind,
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review ? c.last_review.toISOString() : null,
    introducedAt,
  };
}

/**
 * Creates the card when an item is first taught. The lesson itself counts as a first, shaky
 * exposure ("hard"), which brings the first review back the next day.
 */
export function introduceCard(id: string, kind: CardKind, now: Date): StoredCard {
  const empty = createEmptyCard(now);
  const { card } = scheduler.next(empty, now, RATING.hard);
  // FSRS rounds this first interval to 1–2 days; a beginner needs it back tomorrow.
  const tomorrow = new Date(now.getTime() + DAY_MS);
  if (card.due.getTime() > tomorrow.getTime()) {
    card.due = tomorrow;
    card.scheduled_days = 1;
  }
  return fromFsrs(id, kind, now.toISOString(), card);
}

const DAY_MS = 86_400_000;

export function reviewCard(card: StoredCard, grade: Grade, now: Date): StoredCard {
  const { card: next } = scheduler.next(toFsrs(card), now, RATING[grade]);
  return fromFsrs(card.id, card.kind, card.introducedAt, next);
}

export function isDue(card: StoredCard, until: Date): boolean {
  return new Date(card.due).getTime() <= until.getTime();
}
