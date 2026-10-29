import type { SpeechStatus } from '../../shared/ipc';
import type { DownloadState } from '../assets/types';

export interface SpeechClient {
  getStatus(): Promise<SpeechStatus>;
  recognize(samples: Float32Array, sampleRate: 16000): Promise<string>;
  downloadModel(): Promise<void>;
  removeModel(): Promise<void>;
  cancel(): void;
  subscribe(listener: (state: { status: SpeechStatus; download: DownloadState }) => void): () => void;
  dispose(): void;
}

export type SpeechRequest =
  | { id: number; type: 'init'; modelId: string; files: { path: string; buffer: ArrayBuffer }[] }
  | { id: number; type: 'recognize'; samples: Float32Array; sampleRate: 16000 }
  | { id: number; type: 'dispose' };
export type SpeechResponse =
  | { id: number; type: 'ready' }
  | { id: number; type: 'result'; text: string; durationMs: number }
  | { id: number; type: 'disposed' }
  | { id: number; type: 'error'; code: 'SPEECH_UNAVAILABLE' | 'SPEECH_FAILED'; message: string };

export interface SpeechWorker {
  onmessage: ((event: MessageEvent<SpeechResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: SpeechRequest, transfer: Transferable[]): void;
  terminate(): void;
}
