import { AppError } from './errors';
import type { WorkerRequest, WorkerResponse } from './types';

export interface StorageTransport {
  call<T>(method: string, ...args: unknown[]): Promise<T>;
  close(): void;
}
export function createWorkerTransport(worker: Worker, timeoutMs = 120_000): StorageTransport {
  let nextId = 0;
  let closed = false;
  const pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
  >();
  const fail = (error = new AppError('STORAGE_FAILED', '数据服务已停止，请重新打开应用。')) => {
    closed = true;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    pending.clear();
  };
  worker.addEventListener('error', () => fail());
  worker.addEventListener('messageerror', () => fail());
  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const r = event.data;
    const p = pending.get(r.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(r.id);
    if (r.ok) p.resolve(r.value);
    else p.reject(new AppError(r.error.code, r.error.message));
  });
  return {
    call: <T>(method: string, ...args: unknown[]) =>
      new Promise<T>((resolve, reject) => {
        if (closed) {
          reject(new AppError('STORAGE_FAILED', '数据服务已关闭。'));
          return;
        }
        const id = ++nextId;
        const timer = setTimeout(
          () => {
            fail(new AppError('STORAGE_TIMEOUT', '本机数据操作超时，请重新打开应用后检查记录。'));
            worker.terminate();
          },
          method === 'init' ? Math.min(timeoutMs, 60_000) : timeoutMs,
        );
        pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
        try {
          worker.postMessage({ id, method, args } satisfies WorkerRequest);
        } catch (error) {
          pending.delete(id);
          clearTimeout(timer);
          reject(new AppError('INVALID_INPUT', '无法传送数据。', { cause: error }));
        }
      }),
    close: () => {
      fail();
      worker.terminate();
    },
  };
}
