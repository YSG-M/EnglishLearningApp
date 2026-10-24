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

const v2: Migration = { version: 2, name: 'test column', sql: 'ALTER TABLE cards ADD COLUMN note TEXT;' };

describe('openDatabase', () => {
  it('creates the latest schema and records the migration', () => {
    const db = openDatabase(':memory:');
    expect(db.userVersion).toBe(MIGRATIONS.at(-1)!.version);
    expect(db.all('SELECT type FROM app_events')).toEqual([{ type: 'migration' }]);
    db.close();
  });

  it('backs up an existing file before migrating it', () => {
    const file = join(dir, 'data', 'learning.sqlite');
    const backups = join(dir, 'backups');
    openDatabase(file, { backupsDir: backups }).close();
    expect(existsSync(backups)).toBe(false); // a brand new database has nothing to back up

    const db = openDatabase(file, { backupsDir: backups, migrations: [...MIGRATIONS, v2] });
    expect(db.userVersion).toBe(2);
    db.close();
    const files = readdirSync(backups);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^learning-v1-.*\.sqlite$/);
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
    openDatabase(file, { migrations: [...MIGRATIONS, v2] }).close();
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
      version: 2,
      name: 'bad',
      sql: 'ALTER TABLE cards ADD COLUMN x TEXT; SELECT * FROM nope;',
    };
    expect(() => openDatabase(file, { migrations: [...MIGRATIONS, bad] })).toThrow();
    const db = openDatabase(file);
    expect(db.userVersion).toBe(1);
    expect(db.all("SELECT name FROM pragma_table_info('cards') WHERE name = 'x'")).toEqual([]);
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
