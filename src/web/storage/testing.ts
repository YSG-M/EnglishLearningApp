import type { ContentBundle } from '../../shared/content/bundle';
import type { StorageAssets, StorageSpeech } from './types';
import type { StorageTransport } from './client';
import type { StorageService } from './service';
import { AppError, storageError } from './errors';

export class FakeStorageAssets implements StorageAssets {
  paused = false;
  constructor(readonly bundle: ContentBundle) {}
  async getBundle(): Promise<ContentBundle> {
    return this.bundle;
  }
  pause(): void {
    this.paused = true;
  }
}
export class FakeStorageSpeech implements StorageSpeech {
  fail = false;
  async getStatus() {
    return { state: 'ready' as const };
  }
  async recognize(): Promise<string> {
    if (this.fail) throw new AppError('SPEECH_FAILED', 'Synthetic recognition failure');
    return 'Synthetic test sentence';
  }
}
export function fakeStorageTransport(service: StorageService): StorageTransport {
  let queue = Promise.resolve<unknown>(undefined);
  let closed = false;
  return {
    call: <T>(method: string, ...args: unknown[]): Promise<T> => {
      const result = queue.then(async () => {
        if (closed) throw new AppError('STORAGE_FAILED', 'Fake transport closed');
        try {
          return (await service.call(method, args)) as T;
        } catch (error) {
          throw storageError(error);
        }
      });
      queue = result.catch(() => {});
      return result;
    },
    close: () => {
      closed = true;
    },
  };
}
