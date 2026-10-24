/** Production logging: electron-log, one rotating file in <userData>/logs. */
import { join } from 'node:path';
import { app } from 'electron';
import log from 'electron-log/main';
import type { Logger } from './logger';

const MAX_LOG_BYTES = 5 * 1024 * 1024;

export function initLogging(logsDir: string): Logger {
  log.transports.file.resolvePathFn = () => join(logsDir, 'main.log');
  // electron-log keeps one old file (main.old.log) when the size limit is reached.
  log.transports.file.maxSize = MAX_LOG_BYTES;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}';
  log.transports.console.level = app.isPackaged ? false : 'info';

  log.errorHandler.startCatching({ showDialog: false });

  app.on('render-process-gone', (_e, _wc, details) => log.error('renderer process gone', details));
  app.on('child-process-gone', (_e, details) => log.error('child process gone', details));

  const fmt = (message: string, meta?: Record<string, unknown>) => (meta ? [message, meta] : [message]);
  return {
    info: (m, meta) => log.info(...fmt(m, meta)),
    warn: (m, meta) => log.warn(...fmt(m, meta)),
    error: (m, meta) => log.error(...fmt(m, meta)),
  };
}

export function rendererLogger(base: Logger) {
  return (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) =>
    base[level](`[renderer] ${message}`, meta);
}
