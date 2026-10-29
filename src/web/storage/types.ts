import type { AppApi, SpeechStatus } from '../../shared/ipc';
import type { ContentBundle } from '../../shared/content/bundle';

export interface BackupClient {
  exportFile(): Promise<Blob>;
  inspectFile(file: Blob): Promise<{ createdAt: string; recordingCount: number }>;
  importFile(file: Blob): Promise<void>;
  storageStatus(): Promise<{ persistent: boolean; usage: number | null; quota: number | null }>;
}
export interface WebRuntime {
  api: AppApi;
  backup: BackupClient;
  dispose(): Promise<void>;
}
// Structural dependencies let Fake providers run without network or models.
export interface StorageAssets {
  getBundle(): Promise<ContentBundle>;
  pause(): void;
}
export interface StorageSpeech {
  getStatus(): Promise<SpeechStatus>;
  recognize(samples: Float32Array, sampleRate: 16000): Promise<string>;
}
export interface WorkerRequest {
  id: number;
  method: string;
  args: unknown[];
}
export type WorkerResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: { code: string; message: string } };
