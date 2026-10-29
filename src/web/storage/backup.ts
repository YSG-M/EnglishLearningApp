import { z } from 'zod';
import { MIGRATIONS } from '../../main/db/migrations';
import type { ContentBundle } from '../../shared/content/bundle';
import { parseCardId } from '../../shared/content/bundle';
import { Settings } from '../../shared/settings';
import { itemExistsInBundle } from './learningService';
import type { Database, SqlValue } from './database';
import type { PersonalFiles } from './files';
import { AppError } from './errors';
import { generation } from './recordings';
import { validWav } from './wav';
import { recordingItemIds } from './contentIds';

const text = z.string().max(10000);
const id = z.string().min(1).max(120);
const uuid = z.uuid();
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const flag = z.union([z.literal(0), z.literal(1)]);
const date = z.iso.datetime({ offset: true });
const day = z.iso.date();
const schemas = {
  app_events: z.object({ id: count, at: date, type: id, detail: text.nullable() }).strict(),
  cards: z
    .object({
      id,
      kind: z.enum(['chunk', 'word', 'pair', 'example']),
      due: date,
      stability: z.number().finite().nonnegative(),
      difficulty: z.number().finite().min(0).max(10),
      scheduled_days: z.number().finite().nonnegative(),
      learning_steps: count,
      reps: count,
      lapses: count,
      state: z.number().int().min(0).max(3),
      last_review: date.nullable(),
      introduced_at: date,
    })
    .strict(),
  review_logs: z
    .object({
      id: count,
      card_id: id,
      exercise: z.enum(['listen-choose', 'speak-from-zh', 'recall-self-rate', 'pair-discriminate']),
      grade: z.enum(['again', 'hard', 'good']),
      correct: flag,
      active_ms: count,
      reviewed_at: date,
      day,
    })
    .strict(),
  part_progress: z.object({ part_id: id, completed_at: date, day, active_ms: count }).strict(),
  daily_activity: z
    .object({
      day,
      active_ms: count,
      reviews: count,
      parts: count,
      counted: flag,
      reconciled: flag,
      rest_cards_used: count,
      streak_reset: flag,
    })
    .strict(),
  streak: z.object({ id: z.literal(1), state: text }).strict(),
  hint_progress: z.object({ word_key: id, correct: count }).strict(),
  recordings: z
    .object({
      id: uuid,
      item_id: id,
      kind: z.enum(['speech', 'challenge']),
      file: uuid,
      created_at: date,
      duration_ms: count.max(130000),
      score: z.number().min(0).max(1).nullable(),
      transcript: z.string().max(2000).nullable(),
    })
    .strict(),
  settings: z.object({ id: z.literal(1), value: text }).strict(),
};
export const TABLES = Object.keys(schemas) as (keyof typeof schemas)[];
const tablesSchema = z
  .object({
    app_events: z.array(schemas.app_events),
    cards: z.array(schemas.cards),
    review_logs: z.array(schemas.review_logs),
    part_progress: z.array(schemas.part_progress),
    daily_activity: z.array(schemas.daily_activity),
    streak: z.array(schemas.streak).max(1),
    hint_progress: z.array(schemas.hint_progress),
    recordings: z.array(schemas.recordings),
    settings: z.array(schemas.settings).max(1),
  })
  .strict();
const schema = z
  .object({
    format: z.literal('kaikou-backup'),
    version: z.literal(1),
    createdAt: date,
    appVersion: id,
    contentHash: id,
    dbUserVersion: z.literal(MIGRATIONS.at(-1)!.version),
    tables: tablesSchema,
    recordings: z.array(
      z
        .object({
          id: uuid,
          mime: z.literal('audio/wav'),
          bytes: count.max(44 + 16000 * 130 * 2),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          dataBase64: z.string().max(6_000_000),
        })
        .strict(),
    ),
  })
  .strict();
export type Backup = z.infer<typeof schema>;
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
function base64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(result);
}
function decode(value: string, size: number): Uint8Array {
  if (
    value.length !== 4 * Math.ceil(size / 3) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    throw new Error('Invalid base64');
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  if (bytes.length !== size || base64(bytes) !== value) throw new Error('Invalid base64 size');
  return bytes;
}
export async function inspectBackup(file: Blob, bundle: ContentBundle): Promise<Backup> {
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds size limit');
    const backup = schema.parse(JSON.parse(await file.text()));
    const unique = (values: (string | number)[]) => {
      if (new Set(values).size !== values.length) throw new Error('Duplicate key');
    };
    for (const name of TABLES) {
      const rows = backup.tables[name] as Record<string, unknown>[];
      const primary =
        name === 'part_progress'
          ? 'part_id'
          : name === 'daily_activity'
            ? 'day'
            : name === 'hint_progress'
              ? 'word_key'
              : 'id';
      unique(rows.map((r) => r[primary] as string | number));
    }
    const cards = new Set(backup.tables.cards.map((r) => r.id));
    for (const r of backup.tables.cards) {
      const parsed = parseCardId(r.id);
      if (parsed.kind !== r.kind || !itemExistsInBundle(bundle, parsed.kind, parsed.itemId))
        throw new Error('Unknown card');
    }
    for (const r of backup.tables.review_logs)
      if (!cards.has(r.card_id)) throw new Error('Unknown review card');
    for (const r of backup.tables.part_progress)
      if (!bundle.parts.some((p) => p.id === r.part_id)) throw new Error('Unknown part');
    for (const r of backup.tables.hint_progress)
      if (!Object.hasOwn(bundle.lexicon, r.word_key)) throw new Error('Unknown word');
    for (const r of backup.tables.settings) Settings.strict().parse(JSON.parse(r.value));
    for (const r of backup.tables.streak) {
      z.object({
        current: count,
        best: count,
        totalDays: count,
        restCards: count.max(2),
        lastStudyDay: day.nullable(),
      })
        .strict()
        .parse(JSON.parse(r.state));
    }
    const files = new Map(backup.recordings.map((r) => [r.id, r]));
    const knownItems = recordingItemIds(bundle);
    unique(backup.recordings.map((r) => r.id));
    unique(backup.tables.recordings.map((r) => r.file));
    if (files.size !== backup.tables.recordings.length) throw new Error('Unindexed recording');
    for (const r of backup.tables.recordings) {
      if (r.file !== r.id || !files.has(r.file)) throw new Error('Missing recording');
      if (r.kind === 'challenge' && !Object.hasOwn(bundle.challenges, r.item_id))
        throw new Error('Unknown challenge');
      if (r.kind === 'speech' && !knownItems.has(r.item_id)) throw new Error('Unknown recording item');
      const audio = files.get(r.file)!;
      const bytes = decode(audio.dataBase64, audio.bytes);
      if (
        !validWav(bytes) ||
        (await digest(bytes)) !== audio.sha256 ||
        Math.round((bytes.length - 44) / 32) !== r.duration_ms
      )
        throw new Error('Damaged recording');
    }
    return backup;
  } catch (error) {
    throw new AppError('BACKUP_INVALID', '备份损坏、版本不兼容或内容引用无效，未替换现有数据。', {
      cause: error,
    });
  }
}
export class BackupService {
  constructor(
    private readonly db: Database,
    private readonly files: PersonalFiles,
    private readonly bundle: ContentBundle,
  ) {}
  async exportFile(): Promise<Blob> {
    const tables = this.db.transaction(() =>
      Object.fromEntries(TABLES.map((table) => [table, this.db.all(`SELECT * FROM ${table}`)])),
    ) as Backup['tables'];
    const recordings: Backup['recordings'] = [];
    let total = JSON.stringify(tables).length;
    for (const r of tables.recordings) {
      const blob = await this.files.get(`${generation(this.db)}/${r.file}`);
      if (!blob) throw new AppError('STORAGE_MISSING_RECORDING', '录音文件缺失，无法生成完整备份。');
      total += 4 * Math.ceil(blob.size / 3) + 256;
      if (total > MAX_BACKUP_BYTES) throw new AppError('BACKUP_TOO_LARGE', '备份超过大小上限。');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      recordings.push({
        id: r.file,
        mime: 'audio/wav',
        bytes: bytes.length,
        sha256: await digest(bytes),
        dataBase64: base64(bytes),
      });
    }
    const result = new Blob(
      [
        JSON.stringify({
          format: 'kaikou-backup',
          version: 1,
          createdAt: new Date().toISOString(),
          appVersion: '0.1.0',
          contentHash: this.bundle.contentHash,
          dbUserVersion: this.db.userVersion,
          tables,
          recordings,
        }),
      ],
      { type: 'application/json' },
    );
    if (result.size > MAX_BACKUP_BYTES) throw new AppError('BACKUP_TOO_LARGE', '备份超过大小上限。');
    return result;
  }
  async importFile(file: Blob): Promise<void> {
    const backup = await inspectBackup(file, this.bundle);
    const next = crypto.randomUUID();
    // The old generation remains authoritative until the single SQL commit.
    for (const r of backup.recordings)
      await this.files.put(
        `${next}/${r.id}`,
        new Blob([new Uint8Array(decode(r.dataBase64, r.bytes))], { type: r.mime }),
      );
    this.db.transaction(() => {
      for (const name of [...TABLES].reverse()) this.db.exec(`DELETE FROM ${name}`);
      for (const name of TABLES) {
        for (const row of backup.tables[name]) {
          const columns = Object.keys(row);
          this.db.run(
            `INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
            ...(Object.values(row) as SqlValue[]),
          );
        }
      }
      this.db.run(
        "INSERT INTO web_metadata (key, value) VALUES ('generation', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        next,
      );
    });
  }
}
