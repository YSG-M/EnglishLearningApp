export interface Clock {
  now(): Date;
}
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
