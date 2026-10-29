import { afterEach, expect, it, vi } from 'vitest';
import { createWorkerTransport } from './client';
import type { WorkerRequest } from './types';

class FakeWorker extends EventTarget {
  messages: WorkerRequest[] = [];
  terminated = false;
  postMessage(message: WorkerRequest): void {
    this.messages.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  response(value: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: value }));
  }
}
afterEach(() => vi.useRealTimers());
it('routes replies by ID, preserving codes and ignoring stale replies', async () => {
  const worker = new FakeWorker();
  const client = createWorkerTransport(worker as unknown as Worker);
  const first = client.call('today.get');
  const second = client.call('settings.get');
  const failure = expect(second).rejects.toMatchObject({ code: 'STORAGE_QUOTA' });
  worker.response({ id: 100, ok: true, value: 'stale' });
  worker.response({ id: 2, ok: false, error: { code: 'STORAGE_QUOTA', message: 'Full' } });
  worker.response({ id: 1, ok: true, value: 'first' });
  expect(await first).toBe('first');
  await failure;
  client.close();
  expect(worker.terminated).toBe(true);
});
it('terminates an unresponsive Worker and rejects all requests without retrying writes', async () => {
  vi.useFakeTimers();
  const worker = new FakeWorker();
  const client = createWorkerTransport(worker as unknown as Worker, 50);
  const one = expect(client.call('init')).rejects.toMatchObject({ code: 'STORAGE_TIMEOUT' });
  const two = expect(client.call('parts.complete')).rejects.toMatchObject({ code: 'STORAGE_TIMEOUT' });
  await vi.advanceTimersByTimeAsync(51);
  await one;
  await two;
  expect(worker.terminated).toBe(true);
  expect(worker.messages).toHaveLength(2);
  await expect(client.call('today.get')).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
});
