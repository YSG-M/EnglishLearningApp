import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { miniBundle } from '../../main/test-support/fixtures';
import { FakeClock } from '../../main/clock';
import { MIGRATIONS } from '../../main/db/migrations';
import { Database, migrate, type Row } from './database';
import { FakePersonalFiles } from './files';
import { StorageService } from './service';
import { inspectBackup, MAX_BACKUP_BYTES } from './backup';
import { generation } from './recordings';
import { validWav } from './wav';
import { createRuntime } from './index';
import { FakeStorageAssets, FakeStorageSpeech, fakeStorageTransport } from './testing';
import { API_CHANNELS } from '../../shared/ipc';

const opened: Database[] = [];
function fakeDatabase(): Database {
  const raw = new DatabaseSync(':memory:');
  const db = new Database({
    exec: (sql, params) => {
      if (!params) {
        raw.exec(sql);
        return [];
      }
      const stmt = raw.prepare(sql);
      return stmt.columns().length ? (stmt.all(...params) as Row[]) : (stmt.run(...params), []);
    },
    close: () => {
      if (raw.isOpen) raw.close();
    },
  });
  // The browser adapter sends reads without bindings as well.
  db.driver.exec = (sql, params) => {
    if (!params && /;.*\S/s.test(sql.replace(/;\s*$/, ''))) {
      raw.exec(sql);
      return [];
    }
    const stmt = raw.prepare(sql);
    return stmt.columns().length ? (stmt.all(...(params ?? [])) as Row[]) : (stmt.run(...(params ?? [])), []);
  };
  opened.push(db);
  return db;
}
function setup() {
  const db = fakeDatabase();
  migrate(db);
  const files = new FakePersonalFiles();
  const bundle = miniBundle();
  const clock = new FakeClock('2026-11-02T09:00:00');
  const service = new StorageService(db, files, bundle, clock);
  return { db, files, bundle, clock, service, l: service.learning };
}
const tone = () => Float32Array.from({ length: 1600 }, (_, i) => Math.sin(i / 5));
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

describe('SQL adapter and migrations with an injected provider', () => {
  it('rolls back all nested changes on failure and rejects async transactions', () => {
    const { db, l } = setup();
    expect(() =>
      db.transaction(() => {
        l.recordHintCorrect(['hi']);
        throw new Error('interrupted');
      }),
    ).toThrow('interrupted');
    expect(l.getHintProgress()).toEqual({});
    expect(() => db.transaction(() => Promise.resolve())).toThrow('Async');
  });
  it('preserves v1 cards and rejects future schemas without changing them', () => {
    const db = fakeDatabase();
    migrate(db, MIGRATIONS.slice(0, 1));
    db.run("INSERT INTO hint_progress VALUES ('hi', 3)");
    db.run(
      "INSERT INTO cards VALUES ('chunk:u01.c01', 'chunk', '2026-11-01T00:00:00.000Z', 1, 5, 1, 0, 1, 0, 2, NULL, '2026-10-01T00:00:00.000Z')",
    );
    migrate(db);
    expect(db.get<{ correct: number }>('SELECT correct FROM hint_progress')?.correct).toBe(3);
    expect(db.get<{ id: string }>('SELECT id FROM cards')?.id).toBe('chunk:u01.c01');
    db.exec('PRAGMA user_version = 900');
    expect(() => migrate(db)).toThrow('较新版本');
    expect(db.userVersion).toBe(900);
  });
  it('rolls back failed migration DDL and version together', () => {
    const db = fakeDatabase();
    migrate(db);
    expect(() =>
      migrate(db, [
        ...MIGRATIONS,
        { version: 3, name: 'bad', sql: 'ALTER TABLE cards ADD COLUMN x TEXT; SELECT * FROM missing;' },
      ]),
    ).toThrow();
    expect(db.userVersion).toBe(2);
    expect(db.all("SELECT name FROM pragma_table_info('cards') WHERE name='x'")).toEqual([]);
  });
});
describe('learning compatibility', () => {
  it('repeated completion repairs missing cards without counting twice', () => {
    const { l, db } = setup();
    l.completePart({ partId: 'u01:practice', activeMs: 0 });
    db.run("DELETE FROM cards WHERE id='example:u01.e01'");
    expect(l.completePart({ partId: 'u01:practice', activeMs: 0 })).toMatchObject({
      firstTime: false,
      cardsIntroduced: 1,
      today: { partsCompletedToday: 1 },
    });
  });
  it('limits scheduled reviews, and extra practice leaves intervals unchanged', () => {
    const { l, clock, db } = setup();
    l.completePart({ partId: 'u01:learn', activeMs: 0 });
    l.completePart({ partId: 'u01:practice', activeMs: 0 });
    l.updateSettings({ reviewCap: 5 });
    clock.advanceDays(2);
    const queue = l.getReviewQueue();
    expect(queue).toHaveLength(5);
    const before = db.all('SELECT * FROM cards ORDER BY id');
    expect(l.getPracticeSet({ scope: 'recent' }).length).toBeGreaterThan(5);
    l.getPracticeSet({ scope: 'random', count: 20 });
    expect(db.all('SELECT * FROM cards ORDER BY id')).toEqual(before);
    for (const r of queue)
      l.submitReview({ cardId: r.cardId, exercise: r.exercise, grade: 'good', activeMs: 100 });
    expect(l.getReviewQueue()).toEqual([]);
    expect(l.recordHintCorrect(['hi', 'hi'])).toEqual({ hi: 1 });
    expect(l.recordHintCorrect(['hi'])).toEqual({ hi: 2 });
  });
});
describe('recordings and complete backup generations', () => {
  it('round trips SQL, settings, hints, and recording bytes', async () => {
    const { service, l, files, db, bundle } = setup();
    l.completePart({ partId: 'u01:learn', activeMs: 1234 });
    l.recordHintCorrect(['hi']);
    l.updateSettings({ showHints: false });
    const recording = await service.recordings.save('ch01', 'challenge', tone(), 16000);
    const backup = await service.backup.exportFile();
    const parsed = await inspectBackup(backup, bundle);
    expect(parsed.recordings).toHaveLength(1);
    const oldKey = `${generation(db)}/${recording.file}`;
    const old = await files.get(oldKey);
    l.recordHintCorrect(['hi']);
    await service.backup.importFile(backup);
    expect(l.getHintProgress()).toEqual({ hi: 1 });
    expect(l.getSettings().showHints).toBe(false);
    const restored = await files.get(`${generation(db)}/${recording.file}`);
    expect(await restored?.arrayBuffer()).toEqual(await old?.arrayBuffer());
    expect(validWav(new Uint8Array(await restored!.arrayBuffer()))).toBe(true);
    await service.recordings.cleanup();
    expect(await files.get(oldKey)).toBeUndefined();
  });
  it('retains first and recent three attempts, and all challenges', async () => {
    const { service } = setup();
    const ids = [];
    for (let i = 0; i < 7; i++) {
      const r = await service.recordings.save('u01.c01', 'speech', tone(), 16000);
      service.db.run(
        'UPDATE recordings SET created_at = ? WHERE id = ?',
        new Date(1000 * i).toISOString(),
        r.id,
      );
      ids.push(r.id);
      await service.recordings.save('ch01', 'challenge', tone(), 16000);
    }
    expect(service.recordings.repo.listForItem('u01.c01').map((r) => r.id)).toEqual([
      ids[0],
      ...ids.slice(-3),
    ]);
    expect(service.recordings.repo.listByKind('challenge')).toHaveLength(7);
  });
  it('refuses corruption, future versions, foreign keys, extra fields and oversized input', async () => {
    const { service, bundle, l } = setup();
    l.completePart({ partId: 'u01:learn', activeMs: 0 });
    await service.recordings.save('ch01', 'challenge', tone(), 16000);
    const original = JSON.parse(await (await service.backup.exportFile()).text());
    const check = async (mutate: (b: typeof original) => void) => {
      const b = structuredClone(original);
      mutate(b);
      await expect(inspectBackup(new Blob([JSON.stringify(b)]), bundle)).rejects.toMatchObject({
        code: 'BACKUP_INVALID',
      });
    };
    await check((b) => {
      b.version = 100;
    });
    await check((b) => {
      b.dbUserVersion = 100;
    });
    await check((b) => {
      b.recordings[0].sha256 = '0'.repeat(64);
    });
    await check((b) => {
      b.tables.cards[0].injected = 'DROP TABLE cards';
    });
    await check((b) => {
      b.tables.part_progress[0].part_id = 'unknown';
    });
    await check((b) => {
      b.recordings[0].dataBase64 = 'AAAA';
    });
    await expect(inspectBackup({ size: MAX_BACKUP_BYTES + 1 } as Blob, bundle)).rejects.toMatchObject({
      code: 'BACKUP_INVALID',
    });
    expect(l.listCompletedParts()).toEqual(['u01:learn']);
  });
  it('quota failure before SQL indexing preserves all prior attempts', async () => {
    const { service, files } = setup();
    const old = await service.recordings.save('u01.c01', 'speech', tone(), 16000);
    files.failAfter = 0;
    await expect(service.recordings.save('u01.c01', 'speech', tone(), 16000)).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
    expect(service.recordings.repo.listForItem('u01.c01').map((r) => r.id)).toEqual([old.id]);
  });
  it('recovers interrupted import by retaining the old generation and pruning staged files on reopen', async () => {
    const { service, files, db, bundle, l } = setup();
    await service.recordings.save('ch01', 'challenge', tone(), 16000);
    await service.recordings.save('ch01', 'challenge', tone(), 16000);
    const backup = await service.backup.exportFile();
    l.recordHintCorrect(['hi']);
    const originalGeneration = generation(db);
    files.failAfter = 1;
    await expect(service.backup.importFile(backup)).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(generation(db)).toBe(originalGeneration);
    expect(l.getHintProgress()).toEqual({ hi: 1 });
    expect(await files.keys()).toHaveLength(3);
    const reopened = new StorageService(db, files, bundle);
    await reopened.recordings.cleanup();
    expect(await files.keys()).toHaveLength(2);
  });
  it('SQL replacement failure preserves the old generation and data', async () => {
    const { service, db, l } = setup();
    await service.recordings.save('ch01', 'challenge', tone(), 16000);
    const backup = await service.backup.exportFile();
    l.recordHintCorrect(['hi']);
    db.exec(
      "CREATE TRIGGER fail_import BEFORE INSERT ON recordings BEGIN SELECT RAISE(ABORT, 'interrupted'); END;",
    );
    await expect(service.backup.importFile(backup)).rejects.toThrow('interrupted');
    expect(generation(db)).toBe('initial');
    expect(l.getHintProgress()).toEqual({ hi: 1 });
    expect(service.recordings.repo.listByKind('challenge')).toHaveLength(1);
  });
  it('missing referenced files fail export instead of producing an incomplete backup', async () => {
    const { service, files } = setup();
    await service.recordings.save('ch01', 'challenge', tone(), 16000);
    files.blobs.clear();
    await expect(service.backup.exportFile()).rejects.toMatchObject({ code: 'STORAGE_MISSING_RECORDING' });
  });
});

describe('browser AppApi with Fake dependencies', () => {
  it('exposes every AppApi channel and rejects invalid inputs with a stable code', async () => {
    const { service, bundle } = setup();
    const runtime = await createRuntime(
      { assets: new FakeStorageAssets(bundle), speech: new FakeStorageSpeech() },
      fakeStorageTransport(service),
    );
    const channels = Object.entries(runtime.api).flatMap(([namespace, methods]) =>
      Object.keys(methods).map((method) => `${namespace}.${method}`),
    );
    expect(channels.sort()).toEqual([...API_CHANNELS].sort());
    await expect(runtime.api.settings.update({ reviewCap: 1000 })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect((await runtime.api.settings.get()).reviewCap).toBe(20);
    await runtime.dispose();
    await expect(runtime.api.today.get()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  });
  it('keeps audio when ASR fails and pauses downloads on quota failure', async () => {
    const { service, bundle, files } = setup();
    const assets = new FakeStorageAssets(bundle);
    const speech = new FakeStorageSpeech();
    speech.fail = true;
    const runtime = await createRuntime({ assets, speech }, fakeStorageTransport(service));
    await expect(
      runtime.api.speech.recognize({ samples: tone(), sampleRate: 16000, itemId: 'u01.c01', keep: true }),
    ).rejects.toMatchObject({ code: 'SPEECH_FAILED' });
    const saved = await runtime.api.recordings.list('u01.c01');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ score: null, transcript: null });
    expect(saved[0]!.url).toMatch(/^blob:/);
    files.failAfter = 0;
    await expect(
      runtime.api.recordings.saveChallenge({ samples: tone(), sampleRate: 16000, challengeId: 'ch01' }),
    ).rejects.toMatchObject({ code: 'STORAGE_QUOTA' });
    expect(assets.paused).toBe(true);
    await runtime.dispose();
  });
});
