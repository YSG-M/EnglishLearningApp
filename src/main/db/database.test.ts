import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './database';
import { MIGRATIONS, type Migration } from './migrations';
import { createRepositories } from './repositories';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaikou-db-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const LATEST = MIGRATIONS.at(-1)!.version;
const next: Migration = {
  version: LATEST + 1,
  name: 'test column',
  sql: 'ALTER TABLE cards ADD COLUMN note TEXT;',
};

describe('openDatabase', () => {
  it('creates the latest schema and records the migration', () => {
    const db = openDatabase(':memory:');
    expect(db.userVersion).toBe(MIGRATIONS.at(-1)!.version);
    expect(db.all('SELECT type FROM app_events')).toEqual(MIGRATIONS.map(() => ({ type: 'migration' })));
    db.close();
  });

  it('backs up an existing file before migrating it', () => {
    const file = join(dir, 'data', 'learning.sqlite');
    const backups = join(dir, 'backups');
    openDatabase(file, { backupsDir: backups }).close();
    expect(existsSync(backups)).toBe(false); // a brand new database has nothing to back up

    const db = openDatabase(file, { backupsDir: backups, migrations: [...MIGRATIONS, next] });
    expect(db.userVersion).toBe(LATEST + 1);
    db.close();
    const files = readdirSync(backups);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`^learning-v${LATEST}-.*\\.sqlite$`));
  });

  it('keeps data across reopen', () => {
    const file = join(dir, 'learning.sqlite');
    const a = openDatabase(file);
    createRepositories(a).hints.increment(['hi']);
    a.close();
    const b = openDatabase(file);
    expect(createRepositories(b).hints.all()).toEqual({ hi: 1 });
    b.close();
  });

  it('refuses a database written by a newer app version', () => {
    const file = join(dir, 'learning.sqlite');
    openDatabase(file, { migrations: [...MIGRATIONS, next] }).close();
    expect(() => openDatabase(file)).toThrow(/newer than this app supports/);
  });

  it('rolls back a failed transaction', () => {
    const db = openDatabase(':memory:');
    const repos = createRepositories(db);
    expect(() =>
      db.transaction(() => {
        repos.hints.increment(['hi']);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(repos.hints.all()).toEqual({});
    db.close();
  });

  it('rolls back a failed migration and leaves the version unchanged', () => {
    const file = join(dir, 'learning.sqlite');
    openDatabase(file).close();
    const bad: Migration = {
      version: LATEST + 1,
      name: 'bad',
      sql: 'ALTER TABLE cards ADD COLUMN x TEXT; SELECT * FROM nope;',
    };
    expect(() => openDatabase(file, { migrations: [...MIGRATIONS, bad] })).toThrow();
    const db = openDatabase(file);
    expect(db.userVersion).toBe(LATEST);
    expect(db.all("SELECT name FROM pragma_table_info('cards') WHERE name = 'x'")).toEqual([]);
    db.close();
  });
});

describe('migration 2: pattern example cards', () => {
  it('keeps existing cards and accepts the new card kind', () => {
    const file = join(dir, 'learning.sqlite');
    const v1 = openDatabase(file, { migrations: MIGRATIONS.filter((m) => m.version === 1) });
    v1.run(
      `INSERT INTO cards (id, kind, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, introduced_at)
       VALUES ('chunk:u01.c01', 'chunk', '2026-10-25T00:00:00.000Z', 1, 5, 1, 0, 1, 0, 2, NULL, '2026-10-24T00:00:00.000Z')`,
    );
    expect(() =>
      v1.run(
        `INSERT INTO cards (id, kind, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review, introduced_at)
         VALUES ('example:u01.e01', 'example', 'x', 1, 5, 1, 0, 1, 0, 2, NULL, 'x')`,
      ),
    ).toThrow();
    v1.close();

    const db = openDatabase(file, { backupsDir: join(dir, 'backups') });
    const { cards } = createRepositories(db);
    expect(cards.get('chunk:u01.c01')).toMatchObject({ kind: 'chunk', reps: 1 });
    cards.upsert({ ...cards.get('chunk:u01.c01')!, id: 'example:u01.e01', kind: 'example' });
    expect(cards.allIds()).toEqual(['chunk:u01.c01', 'example:u01.e01']);
    db.close();
  });
});

describe('repositories', () => {
  it('settings: defaults, round trip, and recovery from bad stored values', () => {
    const db = openDatabase(':memory:');
    const { settings } = createRepositories(db);
    expect(settings.get().reviewCap).toBe(20);
    settings.set({ ...settings.get(), reviewCap: 30 });
    expect(settings.get().reviewCap).toBe(30);
    db.run(
      'UPDATE settings SET value = ? WHERE id = 1',
      JSON.stringify({ reviewCap: 9999, showHints: false }),
    );
    expect(settings.get()).toMatchObject({ reviewCap: 20, showHints: false });
    db.run('UPDATE settings SET value = ? WHERE id = 1', 'not json');
    expect(settings.get().reviewCap).toBe(20);
    db.close();
  });

  it('cards: due ids are ordered most overdue first', () => {
    const db = openDatabase(':memory:');
    const { cards } = createRepositories(db);
    const base = {
      kind: 'word' as const,
      stability: 1,
      difficulty: 5,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      state: 2,
      lastReview: null,
      introducedAt: '2026-01-01T00:00:00.000Z',
    };
    cards.upsert({ ...base, id: 'word:b', due: '2026-01-03T00:00:00.000Z' });
    cards.upsert({ ...base, id: 'word:a', due: '2026-01-02T00:00:00.000Z' });
    cards.upsert({ ...base, id: 'word:c', due: '2026-02-01T00:00:00.000Z' });
    expect(cards.dueIds('2026-01-10T00:00:00.000Z')).toEqual(['word:a', 'word:b']);
    db.close();
  });
});
