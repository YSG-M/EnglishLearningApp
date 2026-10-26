import type { DayString } from '../../../shared/domain/dates';
import { initialStreak, type StreakState } from '../../../shared/domain/streak';
import type { Database } from '../database';

export class PartProgressRepository {
  constructor(private readonly db: Database) {}

  isComplete(partId: string): boolean {
    return this.db.get('SELECT 1 AS x FROM part_progress WHERE part_id = ?', partId) !== undefined;
  }

  complete(partId: string, completedAt: string, day: DayString, activeMs: number): void {
    this.db.run(
      'INSERT OR IGNORE INTO part_progress (part_id, completed_at, day, active_ms) VALUES (?, ?, ?, ?)',
      partId,
      completedAt,
      day,
      Math.round(activeMs),
    );
  }

  listIds(): string[] {
    return this.db
      .all<{ part_id: string }>('SELECT part_id FROM part_progress ORDER BY completed_at')
      .map((r) => r.part_id);
  }

  /** Parts first completed on or after `day`. */
  listIdsSince(day: DayString): string[] {
    return this.db
      .all<{ part_id: string }>('SELECT part_id FROM part_progress WHERE day >= ? ORDER BY completed_at', day)
      .map((r) => r.part_id);
  }

  countOnDay(day: DayString): number {
    return Number(
      this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM part_progress WHERE day = ?', day)?.n ?? 0,
    );
  }
}

export interface DailyActivity {
  day: DayString;
  activeMs: number;
  reviews: number;
  parts: number;
  counted: boolean;
  reconciled: boolean;
  restCardsUsed: number;
  streakReset: boolean;
}

interface ActivityRow {
  day: string;
  active_ms: number;
  reviews: number;
  parts: number;
  counted: number;
  reconciled: number;
  rest_cards_used: number;
  streak_reset: number;
}

const fromRow = (r: ActivityRow): DailyActivity => ({
  day: r.day,
  activeMs: Number(r.active_ms),
  reviews: Number(r.reviews),
  parts: Number(r.parts),
  counted: r.counted === 1,
  reconciled: r.reconciled === 1,
  restCardsUsed: Number(r.rest_cards_used),
  streakReset: r.streak_reset === 1,
});

export class DailyActivityRepository {
  constructor(private readonly db: Database) {}

  get(day: DayString): DailyActivity {
    this.db.run('INSERT OR IGNORE INTO daily_activity (day) VALUES (?)', day);
    return fromRow(this.db.get<ActivityRow>('SELECT * FROM daily_activity WHERE day = ?', day)!);
  }

  addActiveMs(day: DayString, ms: number): void {
    this.get(day);
    this.db.run(
      'UPDATE daily_activity SET active_ms = active_ms + ? WHERE day = ?',
      Math.max(0, Math.round(ms)),
      day,
    );
  }

  increment(day: DayString, field: 'reviews' | 'parts'): void {
    this.get(day);
    this.db.run(`UPDATE daily_activity SET ${field} = ${field} + 1 WHERE day = ?`, day);
  }

  markCounted(day: DayString): void {
    this.db.run('UPDATE daily_activity SET counted = 1 WHERE day = ?', day);
  }

  markReconciled(day: DayString, restCardsUsed: number, streakReset: boolean): void {
    this.get(day);
    this.db.run(
      'UPDATE daily_activity SET reconciled = 1, rest_cards_used = ?, streak_reset = ? WHERE day = ?',
      restCardsUsed,
      streakReset ? 1 : 0,
      day,
    );
  }

  /** Most recent counted study day strictly before `day`. */
  lastCountedBefore(day: DayString): DayString | null {
    return (
      this.db.get<{ day: string }>(
        'SELECT day FROM daily_activity WHERE counted = 1 AND day < ? ORDER BY day DESC LIMIT 1',
        day,
      )?.day ?? null
    );
  }

  range(fromDay: DayString, toDay: DayString): DailyActivity[] {
    return this.db
      .all<ActivityRow>(
        'SELECT * FROM daily_activity WHERE day >= ? AND day <= ? ORDER BY day',
        fromDay,
        toDay,
      )
      .map(fromRow);
  }
}

export class StreakRepository {
  constructor(private readonly db: Database) {}

  get(): StreakState {
    const r = this.db.get<{ state: string }>('SELECT state FROM streak WHERE id = 1');
    if (!r) return { ...initialStreak };
    try {
      return { ...initialStreak, ...(JSON.parse(r.state) as Partial<StreakState>) };
    } catch {
      return { ...initialStreak };
    }
  }

  set(s: StreakState): void {
    this.db.run(
      'INSERT INTO streak (id, state) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET state = excluded.state',
      JSON.stringify(s),
    );
  }
}

export class HintProgressRepository {
  constructor(private readonly db: Database) {}

  all(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.db.all<{ word_key: string; correct: number }>(
      'SELECT word_key, correct FROM hint_progress',
    )) {
      out[r.word_key] = Number(r.correct);
    }
    return out;
  }

  increment(keys: string[]): void {
    for (const k of new Set(keys)) {
      this.db.run(
        'INSERT INTO hint_progress (word_key, correct) VALUES (?, 1) ON CONFLICT (word_key) DO UPDATE SET correct = correct + 1',
        k,
      );
    }
  }
}

export class EventRepository {
  constructor(private readonly db: Database) {}

  add(type: string, detail: Record<string, unknown>, at = new Date()): void {
    this.db.run(
      'INSERT INTO app_events (at, type, detail) VALUES (?, ?, ?)',
      at.toISOString(),
      type,
      JSON.stringify(detail),
    );
  }

  recent(limit: number): { at: string; type: string; detail: string | null }[] {
    return this.db.all('SELECT at, type, detail FROM app_events ORDER BY id DESC LIMIT ?', limit);
  }
}
