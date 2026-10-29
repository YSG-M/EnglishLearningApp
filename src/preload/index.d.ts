import type { AppApi } from '../shared/ipc';

declare global {
  interface Window {
    /** Exposed by src/preload/index.ts. The renderer's only way to reach the main process. */
    api: AppApi;
  }
}

export {};
