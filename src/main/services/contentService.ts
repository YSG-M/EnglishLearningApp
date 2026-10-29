import { readFileSync } from 'node:fs';
import type { ContentBundle } from '../../shared/content/bundle';
import { AppError } from '../errors';
import type { Logger } from '../logger';
import { errorMeta } from '../logger';

export type ContentState = { ok: true; bundle: ContentBundle } | { ok: false; reason: string };

/**
 * Loads resources/content/bundle.json once. A missing or broken bundle does not crash the app:
 * every content-dependent call raises a clear NOT_FOUND error that the UI shows as an error screen.
 */
export class ContentService {
  private state: ContentState | null = null;

  constructor(
    private readonly bundlePath: string,
    private readonly logger: Logger,
    private readonly read: (path: string) => string = (p) => readFileSync(p, 'utf8'),
  ) {}

  load(): ContentState {
    if (this.state) return this.state;
    try {
      const data = JSON.parse(this.read(this.bundlePath)) as Partial<ContentBundle>;
      if (
        !data ||
        typeof data.contentVersion !== 'string' ||
        !Array.isArray(data.parts) ||
        !data.units ||
        !data.lexicon
      ) {
        throw new Error('bundle.json is missing required fields');
      }
      this.state = { ok: true, bundle: data as ContentBundle };
      this.logger.info('content loaded', {
        version: data.contentVersion,
        hash: data.contentHash,
        units: Object.keys(data.units).length,
        parts: data.parts.length,
      });
    } catch (err) {
      this.state = { ok: false, reason: (err as Error).message };
      this.logger.error('content bundle could not be loaded', { path: this.bundlePath, ...errorMeta(err) });
    }
    return this.state;
  }

  /** Throws a user-facing error when there is no content. */
  bundle(): ContentBundle {
    const s = this.load();
    if (s.ok) return s.bundle;
    throw new AppError(
      'NOT_FOUND',
      '没有找到课程内容。请重新安装软件；如果是开发环境，请先运行 npm run content:build。',
    );
  }

  version(): string {
    const s = this.load();
    return s.ok ? s.bundle.contentVersion : 'missing';
  }
}
