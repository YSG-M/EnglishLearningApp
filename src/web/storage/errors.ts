export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}
export function storageError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' ||
      ('resultCode' in error && typeof error.resultCode === 'number' && (error.resultCode & 255) === 13) ||
      /SQLITE_FULL|database or disk is full/i.test(error.message))
  )
    return new AppError('STORAGE_QUOTA', '存储空间不足，请释放空间后重试。');
  return new AppError('STORAGE_FAILED', '本机数据保存失败，请重试并保留现有数据。');
}
