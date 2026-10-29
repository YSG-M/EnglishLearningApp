import { MIGRATIONS, type Migration } from '../../main/db/migrations';
import { AppError } from './errors';

export type SqlValue = string | number | null | Uint8Array;
export type Row = Record<string, unknown>;
export interface SqlDriver {
  exec(sql: string, params?: SqlValue[]): Row[];
  close(): void;
}
export class Database {
  private depth = 0;
  constructor(readonly driver: SqlDriver) {}
  run(sql: string, ...params: SqlValue[]): { changes: number; lastId: number } {
    this.driver.exec(sql, params);
    const r = this.get<{ changes: number; lastId: number }>(
      'SELECT changes() AS changes, last_insert_rowid() AS lastId',
    )!;
    return r;
  }
  get<T = Row>(sql: string, ...params: SqlValue[]): T | undefined {
    return this.all<T>(sql, ...params)[0];
  }
  all<T = Row>(sql: string, ...params: SqlValue[]): T[] {
    return this.driver.exec(sql, params) as T[];
  }
  exec(sql: string): void {
    this.driver.exec(sql);
  }
  transaction<T>(fn: () => T): T {
    if (this.depth) return fn();
    this.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const result = fn();
      if (result instanceof Promise) throw new AppError('INTERNAL', 'Async SQL transaction rejected');
      this.exec('COMMIT');
      return result;
    } catch (error) {
      this.exec('ROLLBACK');
      throw error;
    } finally {
      this.depth--;
    }
  }
  get userVersion(): number {
    return this.get<{ user_version: number }>('PRAGMA user_version')!.user_version;
  }
  close(): void {
    this.driver.close();
  }
}
export function migrate(db: Database, migrations: Migration[] = MIGRATIONS): void {
  if (db.userVersion > (migrations.at(-1)?.version ?? 0))
    throw new AppError('STORAGE_FUTURE_VERSION', '数据由较新版本创建，请更新应用。');
  db.transaction(() => {
    for (const m of migrations) {
      if (m.version <= db.userVersion) continue;
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.run(
        'INSERT INTO app_events (at, type, detail) VALUES (?, ?, ?)',
        new Date().toISOString(),
        'migration',
        JSON.stringify({ version: m.version, name: m.name }),
      );
    }
  });
}
