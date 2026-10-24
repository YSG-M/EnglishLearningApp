import type { CardKind } from '../../../shared/content/bundle';
import type { StoredCard } from '../../../shared/domain/srs';
import type { Database } from '../database';

interface CardRow {
  id: string;
  kind: CardKind;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  introduced_at: string;
}

const fromRow = (r: CardRow): StoredCard => ({
  id: r.id,
  kind: r.kind,
  due: r.due,
  stability: r.stability,
  difficulty: r.difficulty,
  scheduledDays: r.scheduled_days,
  learningSteps: r.learning_steps,
  reps: r.reps,
  lapses: r.lapses,
  state: r.state,
  lastReview: r.last_review,
  introducedAt: r.introduced_at,
});

export class CardRepository {
  constructor(private readonly db: Database) {}

  get(id: string): StoredCard | undefined {
    const r = this.db.get<CardRow>('SELECT * FROM cards WHERE id = ?', id);
    return r ? fromRow(r) : undefined;
  }

  has(id: string): boolean {
    return this.db.get('SELECT 1 AS x FROM cards WHERE id = ?', id) !== undefined;
  }

  getMany(ids: string[]): StoredCard[] {
    return ids.flatMap((id) => {
      const c = this.get(id);
      return c ? [c] : [];
    });
  }

  upsert(c: StoredCard): void {
    this.db.run(
      `INSERT INTO cards (id, kind, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, introduced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
         scheduled_days = excluded.scheduled_days, learning_steps = excluded.learning_steps, reps = excluded.reps,
         lapses = excluded.lapses, state = excluded.state, last_review = excluded.last_review`,
      c.id,
      c.kind,
      c.due,
      c.stability,
      c.difficulty,
      c.scheduledDays,
      c.learningSteps,
      c.reps,
      c.lapses,
      c.state,
      c.lastReview,
      c.introducedAt,
    );
  }

  /** Due by `until` (ISO), most overdue first. ISO strings in UTC sort chronologically. */
  dueIds(untilIso: string): string[] {
    return this.db
      .all<{ id: string }>('SELECT id FROM cards WHERE due <= ? ORDER BY due ASC, id ASC', untilIso)
      .map((r) => r.id);
  }

  count(): number {
    return Number(this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cards')?.n ?? 0);
  }

  countMature(minDays: number): number {
    return Number(
      this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cards WHERE scheduled_days >= ?', minDays)?.n ??
        0,
    );
  }

  mostLapsed(limit: number): { cardId: string; lapses: number }[] {
    return this.db
      .all<{ id: string; lapses: number }>(
        'SELECT id, lapses FROM cards WHERE lapses > 0 ORDER BY lapses DESC, id ASC LIMIT ?',
        limit,
      )
      .map((r) => ({ cardId: r.id, lapses: Number(r.lapses) }));
  }
}
