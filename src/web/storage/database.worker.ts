import { openPersonalFiles } from './files';
import { openPersistentDatabase, type OpenedDatabase } from './sqlite';
import { StorageService } from './service';
import { AppError, storageError } from './errors';
import type { WorkerRequest, WorkerResponse } from './types';
import type { ContentBundle } from '../../shared/content/bundle';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};
let service: StorageService | undefined;
let opened: OpenedDatabase | undefined;
let queue = Promise.resolve();
scope.onmessage = (event) => {
  const { id, method, args } = event.data;
  queue = queue.then(async () => {
    try {
      let value: unknown;
      if (method === 'init') {
        if (service) throw new AppError('INTERNAL', 'Storage already initialized');
        const files = await openPersonalFiles();
        try {
          opened = await openPersistentDatabase(files);
          service = new StorageService(opened.db, files, args[0] as ContentBundle);
          if (opened.db.get<{ quick_check: string }>('PRAGMA quick_check')?.quick_check !== 'ok')
            throw new AppError('STORAGE_CORRUPT', '学习数据库校验失败，请保留数据并恢复备份。');
          await service.recordings.withBlobs([
            ...service.recordings.repo.listByKind('speech'),
            ...service.recordings.repo.listByKind('challenge'),
          ]);
          await service.recordings.cleanup();
        } catch (error) {
          files.close();
          await opened?.release();
          opened = undefined;
          service = undefined;
          throw error;
        }
      } else if (method === 'dispose') {
        service?.files.close();
        await opened?.release();
        service = undefined;
        opened = undefined;
      } else {
        if (!service) throw new AppError('STORAGE_UNAVAILABLE', '学习数据尚未就绪。');
        value = await service.call(method, args);
      }
      scope.postMessage({ id, ok: true, value });
    } catch (error) {
      const e = storageError(error);
      scope.postMessage({ id, ok: false, error: { code: e.code, message: e.message } });
    }
  });
};
