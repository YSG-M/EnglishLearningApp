import type { SpeechStatus } from '../../shared/ipc';
import type { AssetsClient, DownloadState } from '../assets/types';
import { ARTIFACT_VERIFIED, MODEL_ID, UNAVAILABLE_MESSAGE } from './model';
import { isSilent } from './silence';
import type { SpeechClient, SpeechRequest, SpeechResponse, SpeechWorker } from './types';
export type { SpeechClient } from './types';

export interface SpeechOptions {
  workerFactory?: () => SpeechWorker;
  initTimeoutMs?: number;
  timeoutMs?: number;
}
const failure = (message: string, code = 'SPEECH_FAILED') => Object.assign(new Error(message), { code });
const idle: DownloadState = {
  phase: 'idle',
  completedBytes: 0,
  totalBytes: 0,
  completedFiles: 0,
  totalFiles: 0,
};

export function createSpeechClient(assets: AssetsClient, options: SpeechOptions = {}): SpeechClient {
  let worker: SpeechWorker | null = null;
  let generation = 0;
  let abort = new AbortController();
  let nextId = 0;
  let disposed = false;
  let enabled = ARTIFACT_VERIFIED || !!options.workerFactory;
  let loaded = false;
  let checkedCache = false;
  let status: SpeechStatus = { state: 'unavailable', message: UNAVAILABLE_MESSAGE };
  let download = assets.getModelState?.(MODEL_ID) ?? idle;
  let chain: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(state: { status: SpeechStatus; download: DownloadState }) => void>();
  const pending = new Map<
    number,
    {
      resolve: (response: SpeechResponse) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const emit = () => {
    for (const listener of listeners) listener({ status, download });
  };
  const reset = (message: string) => {
    checkedCache = true;
    generation++;
    abort.abort();
    abort = new AbortController();
    worker?.terminate();
    worker = null;
    loaded = false;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(failure(message));
    }
    pending.clear();
    status = { state: 'unavailable', message };
    emit();
  };
  const unsubscribe = assets.subscribeModel?.(MODEL_ID, (state) => {
    download = state;
    emit();
  });
  const request = (req: SpeechRequest, transfer: Transferable[], timeout: number) =>
    new Promise<SpeechResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        enabled = false;
        reset('识别等待太久，请先回听和自己评分。');
      }, timeout);
      pending.set(req.id, { resolve, reject, timer });
      try {
        worker!.postMessage(req, transfer);
      } catch {
        enabled = false;
        reset('识别无法启动，请先自己评分。');
      }
    });
  const ensureReady = async (my: number) => {
    if (loaded) return;
    if (!enabled) throw failure(UNAVAILABLE_MESSAGE, 'SPEECH_UNAVAILABLE');
    status = { state: 'loading', message: '正在准备离线识别…' };
    emit();
    const started = Date.now();
    const timeout = options.initTimeoutMs ?? 60_000;
    const signal = abort.signal;
    const files = await new Promise<Awaited<ReturnType<AssetsClient['modelFiles']>>>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancelled);
      };
      const cancelled = () => {
        cleanup();
        reject(failure('识别已取消。'));
      };
      const timer = setTimeout(() => {
        enabled = false;
        reset('模型读取等待太久，请先自己评分。');
      }, timeout);
      signal.addEventListener('abort', cancelled, { once: true });
      assets.modelFiles(MODEL_ID).then(
        (files) => {
          cleanup();
          resolve(files);
        },
        (error) => {
          cleanup();
          reject(error);
        },
      );
    });
    if (my !== generation || disposed) throw failure('识别已取消。');
    if (!files.length) throw failure('请先在设置下载离线识别模型。', 'SPEECH_UNAVAILABLE');
    worker = options.workerFactory
      ? options.workerFactory()
      : new Worker(new URL('./speech.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (my !== generation) return;
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      clearTimeout(p.timer);
      if (data.type === 'error') {
        p.reject(failure(data.message, data.code));
        enabled = false;
        reset(data.message);
      } else p.resolve(data);
    };
    worker.onerror = worker.onmessageerror = () => {
      enabled = false;
      reset('识别中断了，请先自己评分。');
    };
    const copied = files.map(({ path, bytes }) => ({ path, buffer: bytes.slice().buffer }));
    const response = await request(
      { id: ++nextId, type: 'init', modelId: MODEL_ID, files: copied },
      copied.map((f) => f.buffer),
      Math.max(1, timeout - (Date.now() - started)),
    );
    if (response.type !== 'ready' || my !== generation) throw failure('识别初始化失败。');
    loaded = true;
    status = { state: 'ready' };
    emit();
  };
  return {
    async getStatus() {
      if (!checkedCache && enabled && !disposed) {
        checkedCache = true;
        const my = generation;
        try {
          const files = await assets.modelFiles(MODEL_ID);
          if (files.length && my === generation && !disposed) {
            status = { state: 'ready' };
            emit();
          }
        } catch {
          // Missing optional cached files must not block the learning UI.
        }
      }
      return status;
    },
    recognize(samples, sampleRate) {
      if (disposed || !enabled) return Promise.reject(failure(UNAVAILABLE_MESSAGE, 'SPEECH_UNAVAILABLE'));
      if (
        sampleRate !== 16000 ||
        !samples.length ||
        samples.length > 16000 * 180 ||
        !samples.every(Number.isFinite)
      )
        return Promise.reject(failure('录音格式无效。', 'INVALID_INPUT'));
      if (isSilent(samples, sampleRate)) return Promise.resolve('');
      const copy = samples.slice();
      const my = generation;
      const run = chain.then(async () => {
        if (my !== generation || disposed) throw failure('识别已取消。');
        try {
          await ensureReady(my);
          const response = await request(
            { id: ++nextId, type: 'recognize', samples: copy, sampleRate },
            [copy.buffer],
            options.timeoutMs ?? 20_000,
          );
          if (response.type !== 'result' || my !== generation) throw failure('识别失败。');
          return response.text;
        } catch (error) {
          if (my === generation) {
            enabled = false;
            reset('识别不可用，请先回听和自己评分。');
          }
          throw error;
        }
      });
      chain = run.catch(() => {});
      return run;
    },
    async downloadModel() {
      if (disposed || (!ARTIFACT_VERIFIED && !options.workerFactory))
        throw failure(UNAVAILABLE_MESSAGE, 'SPEECH_UNAVAILABLE');
      const my = generation;
      await assets.downloadModelFiles(MODEL_ID);
      if (disposed || my !== generation) throw failure('模型准备已取消。');
      enabled = true;
      checkedCache = true;
      status = { state: 'ready' };
      emit();
    },
    async removeModel() {
      enabled = false;
      reset('离线识别模型已移除，可以继续自己评分。');
      await assets.removeModelFiles(MODEL_ID);
    },
    cancel() {
      reset('识别已取消，可以回听和自己评分。');
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ status, download });
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      enabled = false;
      reset(UNAVAILABLE_MESSAGE);
      unsubscribe?.();
      listeners.clear();
    },
  };
}
