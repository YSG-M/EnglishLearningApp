import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import wasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
import { Database, migrate, type Row, type SqlValue } from './database';
import { MIGRATIONS } from '../../main/db/migrations';
import type { PersonalFiles } from './files';
import { AppError } from './errors';

interface WasmDb {
  exec(options: { sql: string; bind?: SqlValue[]; rowMode: 'object'; returnValue: 'resultRows' }): Row[];
  close(): void;
}
interface Pool {
  OpfsSAHPoolDb: new (filename: string) => WasmDb;
  getFileNames(): string[];
  exportFile(filename: string): Uint8Array;
  pauseVfs(): Promise<void>;
}
interface Sqlite {
  capi: { sqlite3_libversion_number(): number };
  installOpfsSAHPoolVfs(options: {
    name: string;
    directory: string;
    initialCapacity: number;
    clearOnInit: false;
    preserveOnInitFailure: true;
  }): Promise<Pool>;
}
export interface OpenedDatabase {
  db: Database;
  release(): Promise<void>;
}
export async function openPersistentDatabase(files: PersonalFiles): Promise<OpenedDatabase> {
  if (!navigator.locks || !navigator.storage?.getDirectory)
    throw new AppError('STORAGE_UNAVAILABLE', '当前浏览器无法安全保存学习数据，请使用支持本机存储的浏览器。');
  let releaseLock!: () => void;
  let acquired!: (value: boolean) => void;
  const ready = new Promise<boolean>((resolve) => {
    acquired = resolve;
  });
  const held = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const lockTask = navigator.locks
    .request('kaikou-learning-writer', { ifAvailable: true }, async (lock) => {
      acquired(!!lock);
      if (lock) await held;
    })
    .catch(() => {
      acquired(false);
    });
  if (!(await ready)) throw new AppError('STORAGE_BUSY', '请回到已打开的学习窗口。');
  let pool: Pool | undefined;
  let db: Database | undefined;
  try {
    const initialize = sqlite3InitModule as unknown as (options: {
      locateFile: (name: string) => string;
      print: () => void;
      printErr: () => void;
    }) => Promise<Sqlite>;
    const sqlite = await initialize({ locateFile: () => wasmUrl, print: () => {}, printErr: () => {} });
    // Earlier releases can erase the pool after an initialization failure.
    if (sqlite.capi.sqlite3_libversion_number() < 3054000)
      throw new AppError('STORAGE_UNSAFE_SQLITE', 'SQLite 构件缺少初始化失败保护，暂不能安全打开学习数据。');
    pool = await sqlite.installOpfsSAHPoolVfs({
      name: 'opfs-sahpool',
      directory: '.kaikou-sahpool',
      initialCapacity: 6,
      clearOnInit: false,
      preserveOnInitFailure: true,
    });
    const existed = pool.getFileNames().includes('/learning.sqlite3');
    const raw = new pool.OpfsSAHPoolDb('/learning.sqlite3');
    db = new Database({
      exec: (sql, params) =>
        raw.exec({
          sql,
          ...(params?.length ? { bind: params } : {}),
          rowMode: 'object',
          returnValue: 'resultRows',
        }),
      close: () => raw.close(),
    });
    if (db.userVersion > MIGRATIONS.at(-1)!.version)
      throw new AppError('STORAGE_FUTURE_VERSION', '数据由较新版本创建，请更新应用。');
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE; PRAGMA busy_timeout = 3000');
    if (existed && db.userVersion < MIGRATIONS.at(-1)!.version) {
      const snapshot = pool.exportFile('/learning.sqlite3');
      await files.put(
        `snapshot/pre-migration-v${db.userVersion}`,
        new Blob([new Uint8Array(snapshot)], { type: 'application/vnd.sqlite3' }),
      );
    }
    migrate(db);
    db.transaction(() => {
      db!.exec('CREATE TABLE IF NOT EXISTS web_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      db!.run(
        "INSERT INTO web_metadata (key, value) VALUES ('write-probe', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        new Date().toISOString(),
      );
    });
    return {
      db,
      release: async () => {
        try {
          db!.close();
          await pool!.pauseVfs();
        } finally {
          releaseLock();
          await lockTask;
        }
      },
    };
  } catch (error) {
    try {
      db?.close();
      await pool?.pauseVfs();
    } finally {
      releaseLock();
      await lockTask;
    }
    throw error;
  }
}
