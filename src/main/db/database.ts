/**
 * SQLite via Node's built-in `node:sqlite` (no native module to rebuild for Electron).
 * Opening a file database runs pending migrations; the file is backed up first.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Logger } from '../logger';
import { silentLogger } from '../logger';
import { MIGRATIONS, type Migration } from './migrations';

export type Row = Record<string, unknown>;

export class Database {
  private depth = 0;

  constructor(readonly raw: DatabaseSync) {}

  run(sql: string, ...params: SQLInputValue[]): { changes: number; lastId: number } {
    const r = this.raw.prepare(sql).run(...params);
    return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
  }

  get<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /** Runs `fn` atomically. Nested calls join the outer transaction. */
  transaction<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    } finally {
      this.depth--;
    }
  }

  get userVersion(): number {
    const row = this.raw.prepare('PRAGMA user_version').get() as { user_version: number };
    return Number(row.user_version);
  }

  close(): void {
    if (this.raw.isOpen) this.raw.close();
  }
}

export interface OpenOptions {
  backupsDir?: string;
  logger?: Logger;
  now?: () => Date;
  migrations?: Migration[];
}

export function openDatabase(file: string, opts: OpenOptions = {}): Database {
  const logger = opts.logger ?? silentLogger;
  const migrations = opts.migrations ?? MIGRATIONS;
  const inMemory = file === ':memory:';
  const existed = !inMemory && existsSync(file);
  if (!inMemory) mkdirSync(dirname(file), { recursive: true });

  const db = new Database(new DatabaseSync(file));
  if (!inMemory) db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 3000');

  const target = migrations.at(-1)?.version ?? 0;
  const current = db.userVersion;
  if (current > target) {
    db.close();
    throw new Error(
      `Database version ${current} is newer than this app supports (${target}). Install the latest version.`,
    );
  }
  try {
    if (current < target && existed && opts.backupsDir) {
      backupFile(db, file, opts.backupsDir, current, (opts.now ?? (() => new Date()))());
      logger.info('database backed up before migration', { from: current, to: target });
    }
    migrate(db, migrations, logger);
  } catch (err) {
    // Release the file handle so the app (or a retry) can recover from the backup.
    db.close();
    throw err;
  }
  return db;
}

function backupFile(db: Database, file: string, backupsDir: string, version: number, now: Date): void {
  mkdirSync(backupsDir, { recursive: true });
  // Fold the WAL into the main file so the copy is complete.
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  copyFileSync(file, join(backupsDir, `learning-v${version}-${stamp}.sqlite`));
}

export function migrate(db: Database, migrations: Migration[], logger: Logger = silentLogger): void {
  for (const m of migrations) {
    if (m.version <= db.userVersion) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.run(
        'INSERT INTO app_events (at, type, detail) VALUES (?, ?, ?)',
        new Date().toISOString(),
        'migration',
        JSON.stringify({ version: m.version, name: m.name }),
      );
    });
    logger.info('database migrated', { version: m.version, name: m.name });
  }
}
