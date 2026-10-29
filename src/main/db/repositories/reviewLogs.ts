import type { DayString } from '../../../shared/domain/dates';
import type { Database } from '../database';

export interface ReviewLogInput {
  cardId: string;
  exercise: string;
  grade: string;
  correct: boolean;
  activeMs: number;
  reviewedAt: string;
  day: DayString;
}

export class ReviewLogRepository {
  constructor(private readonly db: Database) {}

  insert(l: ReviewLogInput): void {
    this.db.run(
      'INSERT INTO review_logs (card_id, exercise, grade, correct, active_ms, reviewed_at, day) VALUES (?, ?, ?, ?, ?, ?, ?)',
      l.cardId,
      l.exercise,
      l.grade,
      l.correct ? 1 : 0,
      Math.round(l.activeMs),
      l.reviewedAt,
      l.day,
    );
  }

  countOnDay(day: DayString): number {
    return Number(
      this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM review_logs WHERE day = ?', day)?.n ?? 0,
    );
  }

  /** Correct / total for days in [fromDay, toDay]. */
  accuracyBetween(fromDay: DayString, toDay: DayString): { correct: number; total: number } {
    const r = this.db.get<{ total: number; correct: number | null }>(
      'SELECT COUNT(*) AS total, SUM(correct) AS correct FROM review_logs WHERE day >= ? AND day <= ?',
      fromDay,
      toDay,
    );
    return { total: Number(r?.total ?? 0), correct: Number(r?.correct ?? 0) };
  }

  count(): number {
    return Number(this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM review_logs')?.n ?? 0);
  }
}
