import type { SpeechRequest, SpeechResponse } from './types';

export interface OfflineEngine {
  init(modelId: string, files: { path: string; buffer: ArrayBuffer }[]): Promise<void>;
  recognize(samples: Float32Array, sampleRate: 16000): Promise<string>;
  dispose(): void;
}

export function createWorkerHandler(engine: OfflineEngine, send: (response: SpeechResponse) => void) {
  let chain = Promise.resolve();
  return (request: SpeechRequest): void => {
    chain = chain.then(async () => {
      try {
        if (request.type === 'dispose') {
          engine.dispose();
          send({ id: request.id, type: 'disposed' });
        } else if (request.type === 'init') {
          await engine.init(request.modelId, request.files);
          send({ id: request.id, type: 'ready' });
        } else {
          const started = performance.now();
          const text = await engine.recognize(request.samples, request.sampleRate);
          send({ id: request.id, type: 'result', text, durationMs: performance.now() - started });
        }
      } catch {
        engine.dispose();
        send({
          id: request.id,
          type: 'error',
          code: request.type === 'init' ? 'SPEECH_UNAVAILABLE' : 'SPEECH_FAILED',
          message: '离线识别不可用，请先自己评分。',
        });
      }
    });
  };
}
