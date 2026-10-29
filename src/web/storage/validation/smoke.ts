import type { ContentBundle } from '../../../shared/content/bundle';
import { createWebApi } from '../index';

const bundle: ContentBundle = {
  contentVersion: '0.0.0-smoke',
  contentHash: 'synthetic-smoke',
  lexicon: {},
  units: {},
  phonics: {},
  weeks: {},
  parts: [],
  clips: {},
  challenges: { smoke: { id: 'smoke', title: 'Synthetic', intro: 'Synthetic', prompts: [], maxSeconds: 10 } },
};
const deps = {
  assets: {
    async getBundle() {
      return bundle;
    },
    pause() {},
  },
  speech: {
    async getStatus() {
      return { state: 'unavailable' as const };
    },
    async recognize() {
      return '';
    },
  },
};
const target = window as unknown as { storageSmoke: { ready: Promise<unknown>; open: typeof open } };
const open = () => createWebApi(deps);
target.storageSmoke = {
  ready: open()
    .then((runtime) => {
      Object.assign(target.storageSmoke, { runtime });
      return true;
    })
    .catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && 'code' in error ? error.code : null,
    })),
  open,
};
