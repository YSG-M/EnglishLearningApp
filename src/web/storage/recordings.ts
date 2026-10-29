import type { Database } from './database';
import type { PersonalFiles } from './files';
import { RecordingRepository, type RecordingRow, type RecordingKind } from './repositories/recordings';
import { encodeWav } from './wav';
import { AppError } from './errors';
import type { RecordingView } from '../../shared/ipc';

export function generation(db: Database): string {
  return (
    db.get<{ value: string }>("SELECT value FROM web_metadata WHERE key = 'generation'")?.value ?? 'initial'
  );
}
export class WebRecordings {
  readonly repo: RecordingRepository;
  constructor(
    private readonly db: Database,
    private readonly files: PersonalFiles,
  ) {
    this.repo = new RecordingRepository(db);
  }
  async save(
    itemId: string,
    kind: RecordingKind,
    samples: Float32Array,
    sampleRate: number,
  ): Promise<RecordingRow> {
    const id = crypto.randomUUID();
    const key = `${generation(this.db)}/${id}`;
    await this.files.put(key, encodeWav(samples, sampleRate));
    const row: RecordingRow = {
      id,
      file: id,
      itemId,
      kind,
      createdAt: new Date().toISOString(),
      durationMs: Math.round((samples.length / sampleRate) * 1000),
      score: null,
      transcript: null,
    };
    this.db.transaction(() => {
      this.repo.insert(row);
      if (kind === 'speech') {
        const rows = this.repo.listForItem(itemId).filter((r) => r.kind === 'speech');
        for (const old of rows.slice(1, Math.max(1, rows.length - 3))) this.repo.delete(old.id);
      }
    });
    // File cleanup is deferred until startup; failure cannot turn a committed save into an error.
    return row;
  }
  async withBlobs(rows: RecordingRow[]): Promise<(RecordingView & { blob: Blob })[]> {
    const out: (RecordingView & { blob: Blob })[] = [];
    for (const r of rows) {
      const blob = await this.files.get(`${generation(this.db)}/${r.file}`);
      if (!blob) throw new AppError('STORAGE_MISSING_RECORDING', '录音文件缺失，请保留备份并重试。');
      out.push({ ...r, url: '', blob });
    }
    return out;
  }
  async cleanup(): Promise<void> {
    const active = generation(this.db);
    const referenced = new Set(
      this.db.all<{ file: string }>('SELECT file FROM recordings').map((r) => `${active}/${r.file}`),
    );
    for (const key of await this.files.keys()) {
      if (!key.startsWith('snapshot/') && !referenced.has(key)) await this.files.remove(key);
    }
  }
}
