import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetsClient } from '../assets/types';
import { createSpeechClient } from './index';
import type { SpeechRequest, SpeechResponse, SpeechWorker } from './types';

class FakeWorker implements SpeechWorker {
  onmessage: SpeechWorker['onmessage'] = null;
  onerror: SpeechWorker['onerror'] = null;
  onmessageerror: SpeechWorker['onmessageerror'] = null;
  terminated = false;
  requests: SpeechRequest[] = [];
  constructor(private respond: (request: SpeechRequest, worker: FakeWorker) => void) {}
  postMessage(request: SpeechRequest, transfer: Transferable[]) {
    const cloned = structuredClone(request, { transfer });
    this.requests.push(cloned);
    queueMicrotask(() => this.respond(cloned, this));
  }
  reply(response: SpeechResponse) {
    this.onmessage?.({ data: response } as MessageEvent<SpeechResponse>);
  }
  terminate() {
    this.terminated = true;
  }
}
const model = new Uint8Array([1, 2, 3]);
const assets = {
  modelFiles: vi.fn(async () => [{ path: 'model', bytes: model }]),
  downloadModelFiles: vi.fn(async () => {}),
  removeModelFiles: vi.fn(async () => {}),
} as unknown as AssetsClient;
const speech = () => Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i / 3) * 0.3);
const normal = (r: SpeechRequest, w: FakeWorker) => {
  if (r.type === 'init') w.reply({ id: r.id, type: 'ready' });
  if (r.type === 'recognize') w.reply({ id: r.id, type: 'result', text: 'hello', durationMs: 1 });
};
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SpeechClient', () => {
  it('recognizes a complete model cache after reopening without another download', async () => {
    const client = createSpeechClient(assets);
    expect((await client.getStatus()).state).toBe('ready');
    expect(assets.downloadModelFiles).not.toHaveBeenCalled();
    client.dispose();
  });
  it('cancels an unfinished model cache read without waiting for it', async () => {
    const source = { ...assets, modelFiles: vi.fn(() => new Promise<never>(() => {})) };
    const factory = vi.fn(() => new FakeWorker(normal));
    const client = createSpeechClient(source, { workerFactory: factory });
    const assertion = expect(client.recognize(speech(), 16000)).rejects.toMatchObject({
      code: 'SPEECH_FAILED',
    });
    await vi.waitFor(() => expect(source.modelFiles).toHaveBeenCalled());
    client.cancel();
    await assertion;
    expect(factory).not.toHaveBeenCalled();
    client.dispose();
  });
  it('requires an explicit model download before reporting production readiness', async () => {
    const client = createSpeechClient({
      ...assets,
      modelFiles: async () => {
        throw new Error('Missing cache');
      },
    });
    expect((await client.getStatus()).state).toBe('unavailable');
    expect(assets.downloadModelFiles).not.toHaveBeenCalled();
    await client.downloadModel();
    expect(assets.downloadModelFiles).toHaveBeenCalled();
    expect((await client.getStatus()).state).toBe('ready');
    client.dispose();
  });
  it('lazily initializes once, serializes recognition, and never detaches caller/model buffers', async () => {
    const workers: FakeWorker[] = [];
    const client = createSpeechClient(assets, {
      workerFactory: () => {
        const w = new FakeWorker(normal);
        workers.push(w);
        return w;
      },
    });
    expect(workers).toHaveLength(0);
    const samples = speech();
    await expect(
      Promise.all([client.recognize(samples, 16000), client.recognize(samples, 16000)]),
    ).resolves.toEqual(['hello', 'hello']);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.requests.map((r) => r.type)).toEqual(['init', 'recognize', 'recognize']);
    expect(samples.byteLength).toBe(64000);
    expect(model.byteLength).toBe(3);
    client.dispose();
  });
  it('guards silence and invalid samples before creating a worker', async () => {
    const factory = vi.fn(() => new FakeWorker(normal));
    const client = createSpeechClient(assets, { workerFactory: factory });
    await expect(client.recognize(new Float32Array(16000), 16000)).resolves.toBe('');
    await expect(client.recognize(new Float32Array([NaN]), 16000)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(factory).not.toHaveBeenCalled();
    client.dispose();
  });
  it.each(['init', 'recognize'] as const)(
    'terminates on a stuck %s and requires explicit re-enabling',
    async (stuck) => {
      vi.useFakeTimers();
      const w = new FakeWorker((r, worker) => {
        if (r.type !== stuck) normal(r, worker);
      });
      const client = createSpeechClient(assets, {
        workerFactory: () => w,
        initTimeoutMs: 100,
        timeoutMs: 100,
      });
      const assertion = expect(client.recognize(speech(), 16000)).rejects.toMatchObject({
        code: 'SPEECH_FAILED',
      });
      await vi.advanceTimersByTimeAsync(101);
      await assertion;
      expect(w.terminated).toBe(true);
      await expect(client.recognize(speech(), 16000)).rejects.toMatchObject({ code: 'SPEECH_UNAVAILABLE' });
      client.dispose();
    },
  );
  it('ignores late replies after cancel and rejects queued old-generation work', async () => {
    const w = new FakeWorker((r, worker) => {
      if (r.type === 'init') normal(r, worker);
    });
    const client = createSpeechClient(assets, { workerFactory: () => w });
    const first = client.recognize(speech(), 16000);
    const queued = client.recognize(speech(), 16000);
    const assertions = Promise.all([
      expect(first).rejects.toMatchObject({ code: 'SPEECH_FAILED' }),
      expect(queued).rejects.toMatchObject({ code: 'SPEECH_FAILED' }),
    ]);
    await vi.waitFor(() => expect(w.requests).toHaveLength(2));
    const late = w.onmessage;
    client.cancel();
    late?.({
      data: { id: w.requests[1]!.id, type: 'result', text: 'late', durationMs: 1 },
    } as MessageEvent<SpeechResponse>);
    await assertions;
    expect(w.terminated).toBe(true);
    expect((await client.getStatus()).state).toBe('unavailable');
    client.dispose();
  });
  it('falls back after model initialization errors or Worker crashes', async () => {
    for (const crash of [false, true]) {
      const w = new FakeWorker((r, worker) => {
        if (crash) worker.onerror?.({} as ErrorEvent);
        else worker.reply({ id: r.id, type: 'error', code: 'SPEECH_UNAVAILABLE', message: 'bad model' });
      });
      const client = createSpeechClient(assets, { workerFactory: () => w });
      await expect(client.recognize(speech(), 16000)).rejects.toHaveProperty('code');
      expect(w.terminated).toBe(true);
      expect((await client.getStatus()).state).toBe('unavailable');
      client.dispose();
    }
  });
});
