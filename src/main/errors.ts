import type { AppErrorCode } from '../shared/ipc';

/** An error that crosses IPC with a stable code; `message` is Chinese and safe to show. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

export interface SerializedAppError {
  code: AppErrorCode;
  message: string;
}

export function toSerializedError(err: unknown): SerializedAppError {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  // Internal details go to the log, not to the screen.
  return { code: 'INTERNAL', message: '出了点问题，请稍后再试。如果一直出现，请在设置里导出诊断包。' };
}
