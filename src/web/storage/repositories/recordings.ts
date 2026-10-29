import type { Database } from '../database';

export type RecordingKind = 'speech' | 'challenge';

export interface RecordingRow {
  id: string;
  itemId: string;
  kind: RecordingKind;
  file: string;
  createdAt: string;
  durationMs: number;
  score: number | null;
  transcript: string | null;
}

interface Raw {
  id: string;
  item_id: string;
  kind: RecordingKind;
  file: string;
  created_at: string;
  duration_ms: number;
  score: number | null;
  transcript: string | null;
}

const fromRaw = (r: Raw): RecordingRow => ({
  id: r.id,
  itemId: r.item_id,
  kind: r.kind,
  file: r.file,
  createdAt: r.created_at,
  durationMs: Number(r.duration_ms),
  score: r.score === null ? null : Number(r.score),
  transcript: r.transcript,
});

export class RecordingRepository {
  constructor(private readonly db: Database) {}

  insert(r: RecordingRow): void {
    this.db.run(
      'INSERT INTO recordings (id, item_id, kind, file, created_at, duration_ms, score, transcript) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      r.id,
      r.itemId,
      r.kind,
      r.file,
      r.createdAt,
      Math.round(r.durationMs),
      r.score,
      r.transcript,
    );
  }

  get(id: string): RecordingRow | undefined {
    const r = this.db.get<Raw>('SELECT * FROM recordings WHERE id = ?', id);
    return r ? fromRaw(r) : undefined;
  }

  /** Oldest first, so index 0 is always her first attempt. */
  listForItem(itemId: string): RecordingRow[] {
    return this.db
      .all<Raw>('SELECT * FROM recordings WHERE item_id = ? ORDER BY created_at, id', itemId)
      .map(fromRaw);
  }

  listByKind(kind: RecordingKind): RecordingRow[] {
    return this.db
      .all<Raw>('SELECT * FROM recordings WHERE kind = ? ORDER BY created_at, id', kind)
      .map(fromRaw);
  }

  annotate(id: string, score: number, transcript: string): boolean {
    return (
      this.db.run('UPDATE recordings SET score = ?, transcript = ? WHERE id = ?', score, transcript, id)
        .changes > 0
    );
  }

  setTranscript(id: string, transcript: string): void {
    this.db.run('UPDATE recordings SET transcript = ? WHERE id = ?', transcript, id);
  }

  delete(id: string): void {
    this.db.run('DELETE FROM recordings WHERE id = ?', id);
  }
}
