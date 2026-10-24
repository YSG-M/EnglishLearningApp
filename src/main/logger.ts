/** The logging surface services depend on; production wires it to electron-log (see logging.ts). */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

export function errorMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error)
    return { error: err.message, stack: err.stack, ...('code' in err ? { code: err.code } : {}) };
  return { error: String(err) };
}
