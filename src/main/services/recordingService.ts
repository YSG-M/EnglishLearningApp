/**
 * Her recordings: written as WAV files under <userData>/recordings, indexed in the database.
 *
 * Retention for practice recordings: keep the very first attempt (for "then vs now") and the
 * latest 3 per item; older middle attempts are deleted to keep disk use small.
 * Challenge recordings are never deleted automatically.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordingView } from '../../shared/ipc';
import { recordingUrl } from '../app/media';
import type { Clock } from '../clock';
import type { RecordingKind, RecordingRepository, RecordingRow } from '../db/repositories/recordings';
import type { Logger } from '../logger';
import { errorMeta } from '../logger';
import { encodeWav } from './wav';

export const KEEP_LATEST = 3;

export function safeFileStem(itemId: string): string {
  const s = itemId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (s || 'item').slice(0, 60);
}

export function toView(r: RecordingRow): RecordingView {
  return {
    id: r.id,
    itemId: r.itemId,
    createdAt: r.createdAt,
    durationMs: r.durationMs,
    url: recordingUrl(r.file),
    score: r.score,
    transcript: r.transcript,
  };
}

export class RecordingService {
  constructor(
    private readonly dir: string,
    private readonly repo: RecordingRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  save(itemId: string, kind: RecordingKind, samples: Float32Array, sampleRate: number): RecordingRow {
    mkdirSync(this.dir, { recursive: true });
    const now = this.clock.now();
    const id = randomUUID();
    const file = `${safeFileStem(itemId)}-${now.getTime()}-${id.slice(0, 8)}.wav`;
    writeFileSync(join(this.dir, file), encodeWav(samples, sampleRate));
    const row: RecordingRow = {
      id,
      itemId,
      kind,
      file,
      createdAt: now.toISOString(),
      durationMs: Math.round((samples.length / sampleRate) * 1000),
      score: null,
      transcript: null,
    };
    this.repo.insert(row);
    if (kind === 'speech') this.applyRetention(itemId);
    return row;
  }

  list(itemId: string): RecordingView[] {
    return this.repo.listForItem(itemId).map(toView);
  }

  listChallenges(): RecordingView[] {
    return this.repo.listByKind('challenge').map(toView);
  }

  annotate(id: string, score: number, transcript: string): boolean {
    return this.repo.annotate(id, score, transcript);
  }

  setTranscript(id: string, transcript: string): void {
    this.repo.setTranscript(id, transcript);
  }

  private applyRetention(itemId: string): void {
    const rows = this.repo.listForItem(itemId).filter((r) => r.kind === 'speech');
    if (rows.length <= KEEP_LATEST + 1) return;
    const doomed = rows.slice(1, rows.length - KEEP_LATEST);
    for (const r of doomed) {
      try {
        rmSync(join(this.dir, r.file), { force: true });
      } catch (err) {
        // A file we cannot delete is only wasted space; keep the row consistent anyway.
        this.logger.warn('could not delete old recording', { file: r.file, ...errorMeta(err) });
      }
      this.repo.delete(r.id);
    }
  }
}
