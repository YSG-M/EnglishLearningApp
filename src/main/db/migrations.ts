/**
 * Schema history. Append only: never edit a migration that has shipped; add a new one.
 * Each migration runs in a transaction and bumps PRAGMA user_version.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE app_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        type TEXT NOT NULL,
        detail TEXT
      );

      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('chunk', 'word', 'pair')),
        due TEXT NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        scheduled_days REAL NOT NULL,
        learning_steps INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        state INTEGER NOT NULL,
        last_review TEXT,
        introduced_at TEXT NOT NULL
      );
      CREATE INDEX cards_due ON cards (due);

      CREATE TABLE review_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT NOT NULL,
        exercise TEXT NOT NULL,
        grade TEXT NOT NULL,
        correct INTEGER NOT NULL,
        active_ms INTEGER NOT NULL,
        reviewed_at TEXT NOT NULL,
        day TEXT NOT NULL
      );
      CREATE INDEX review_logs_day ON review_logs (day);
      CREATE INDEX review_logs_card ON review_logs (card_id);

      CREATE TABLE part_progress (
        part_id TEXT PRIMARY KEY,
        completed_at TEXT NOT NULL,
        day TEXT NOT NULL,
        active_ms INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE daily_activity (
        day TEXT PRIMARY KEY,
        active_ms INTEGER NOT NULL DEFAULT 0,
        reviews INTEGER NOT NULL DEFAULT 0,
        parts INTEGER NOT NULL DEFAULT 0,
        counted INTEGER NOT NULL DEFAULT 0,
        reconciled INTEGER NOT NULL DEFAULT 0,
        rest_cards_used INTEGER NOT NULL DEFAULT 0,
        streak_reset INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE streak (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL
      );

      CREATE TABLE hint_progress (
        word_key TEXT PRIMARY KEY,
        correct INTEGER NOT NULL
      );

      CREATE TABLE recordings (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('speech', 'challenge')),
        file TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        score REAL,
        transcript TEXT
      );
      CREATE INDEX recordings_item ON recordings (item_id, created_at);

      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value TEXT NOT NULL
      );
    `,
  },
];
