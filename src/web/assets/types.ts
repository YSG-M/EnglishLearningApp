import type { ContentBundle } from '../../shared/content/bundle';

export interface DownloadState {
  phase: 'idle' | 'downloading' | 'paused' | 'ready' | 'error';
  completedBytes: number;
  totalBytes: number;
  completedFiles: number;
  totalFiles: number;
  message?: string;
}
export interface AssetFile {
  url: string;
  kind: 'content' | 'audio' | 'model' | 'shell' | 'wasm';
  bytes: number;
  sha256: string;
  required?: boolean;
  clipKey?: string;
  weeks?: number[];
  modelId?: string;
}
export interface WebManifest {
  schemaVersion: 1;
  releaseId: string;
  appVersion: string;
  contentHash: string;
  bundle: string;
  files: AssetFile[];
  modelsIncluded: boolean;
}
export interface AssetsClient {
  getBundle(): Promise<ContentBundle>;
  resolveClip(key: string): string;
  ensureWeeks(weeks: number[]): Promise<void>;
  downloadModelFiles(modelId: string): Promise<void>;
  removeModelFiles(modelId: string): Promise<void>;
  modelFiles(modelId: string): Promise<{ path: string; bytes: Uint8Array }[]>;
  pause(): void;
  subscribe(listener: (state: DownloadState) => void): () => void;
  getState(): DownloadState;
  checkForUpdate(): Promise<boolean>;
  activateUpdate(): Promise<void>;
  getModelState?(modelId: string): DownloadState;
  getAvailableWeeks?(): Promise<number[]>;
  getClipWeeks?(key: string): number[];
  subscribeModel?(modelId: string, listener: (state: DownloadState) => void): () => void;
}
