/** Messages between the main process and the speech utility process. */

export interface WhisperModelFiles {
  encoder: string;
  decoder: string;
  tokens: string;
}

export type HostRequest =
  | { type: 'init'; id: number; model: WhisperModelFiles; numThreads: number }
  | { type: 'recognize'; id: number; samples: Float32Array; sampleRate: number };

export type HostResponse =
  | { type: 'ready'; id: number; loadMs: number }
  | { type: 'result'; id: number; text: string; decodeMs: number }
  | { type: 'error'; id: number; message: string };
