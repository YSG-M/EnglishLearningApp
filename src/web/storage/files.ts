import { AppError } from './errors';

export interface PersonalFiles {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
  keys(): Promise<string[]>;
  remove(key: string): Promise<void>;
  close(): void;
}
export async function openPersonalFiles(): Promise<PersonalFiles> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('kaikou-personal', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('recordings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new AppError('STORAGE_BUSY', '请关闭其他学习窗口后重试。'));
  });
  const execute = <T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', mode);
      const req = action(tx.objectStore('recordings'));
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error ?? req.error);
      tx.onerror = () => reject(tx.error ?? req.error);
    });
  return {
    put: async (key, blob) => {
      await execute('readwrite', (s) => s.put(blob, key));
    },
    get: (key) => execute<Blob | undefined>('readonly', (s) => s.get(key)),
    keys: async () => (await execute('readonly', (s) => s.getAllKeys())).map(String),
    remove: async (key) => {
      await execute('readwrite', (s) => s.delete(key));
    },
    close: () => db.close(),
  };
}
export class FakePersonalFiles implements PersonalFiles {
  readonly blobs = new Map<string, Blob>();
  failAfter = Infinity;
  async put(key: string, blob: Blob): Promise<void> {
    if (this.failAfter-- <= 0) throw new DOMException('Quota exhausted', 'QuotaExceededError');
    this.blobs.set(key, blob);
  }
  async get(key: string): Promise<Blob | undefined> {
    return this.blobs.get(key);
  }
  async keys(): Promise<string[]> {
    return [...this.blobs.keys()];
  }
  async remove(key: string): Promise<void> {
    this.blobs.delete(key);
  }
  close(): void {}
}
