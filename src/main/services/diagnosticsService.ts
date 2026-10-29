/**
 * "导出诊断包": copies everything needed to debug a problem into one folder on the Desktop,
 * so the person helping her can ask for a single folder.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Clock } from '../clock';
import type { Database } from '../db/database';
import type { Logger } from '../logger';

export interface DiagnosticsDeps {
  logsDir: string;
  desktopDir: string;
  db: Database;
  clock: Clock;
  logger: Logger;
  /** Version, speech status, paths, counts — anything that helps, nothing secret. */
  info: () => Record<string, unknown>;
  openPath: (path: string) => Promise<string>;
}

export class DiagnosticsService {
  constructor(private readonly d: DiagnosticsDeps) {}

  async openLogsFolder(): Promise<void> {
    mkdirSync(this.d.logsDir, { recursive: true });
    const err = await this.d.openPath(this.d.logsDir);
    if (err) this.d.logger.warn('could not open logs folder', { error: err });
  }

  exportBundle(): { folder: string } {
    const stamp = this.d.clock
      .now()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '-');
    const folder = join(this.d.desktopDir, `KaikouEnglish-diagnostics-${stamp}`);
    mkdirSync(join(folder, 'logs'), { recursive: true });

    if (existsSync(this.d.logsDir)) {
      for (const f of readdirSync(this.d.logsDir)) {
        const src = join(this.d.logsDir, f);
        if (statSync(src).isFile()) copyFileSync(src, join(folder, 'logs', f));
      }
    }
    // VACUUM INTO produces a consistent single-file copy even while the app is using the database.
    const dbCopy = join(folder, 'learning.sqlite');
    try {
      this.d.db.exec(`VACUUM INTO '${dbCopy.replace(/'/g, "''")}'`);
    } catch (err) {
      this.d.logger.warn('database copy for diagnostics failed', { error: String(err) });
    }
    writeFileSync(
      join(folder, 'info.json'),
      JSON.stringify({ exportedAt: this.d.clock.now().toISOString(), ...this.d.info() }, null, 2),
      'utf8',
    );
    this.d.logger.info('diagnostics exported', { folder });
    return { folder };
  }
}
