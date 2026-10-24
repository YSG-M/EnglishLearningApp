/** Helpers for renderer component tests (jsdom). */
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SpeechStatus } from '@shared/ipc';
import { defaultSettings, type Settings } from '@shared/settings';
import { setApi } from './api/client';
import { createMockApi, fixtureBundle, type MockApi } from './api/mockApi';
import { AppProvider } from './state/AppContext';

/** jsdom has no media playback; make play() resolve so the player's fallbacks are not hit. */
export function stubMedia(): void {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: function play(this: HTMLMediaElement) {
      return Promise.resolve();
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => undefined });
}

export function renderWithApp(
  ui: ReactNode,
  opts: {
    api?: MockApi;
    settings?: Partial<Settings>;
    speech?: SpeechStatus;
    hints?: Record<string, number>;
  } = {},
): { api: MockApi } & ReturnType<typeof render> {
  stubMedia();
  const api = opts.api ?? createMockApi();
  setApi(api);
  const result = render(
    <AppProvider
      bundle={fixtureBundle()}
      settings={{ ...defaultSettings, ...opts.settings }}
      speech={opts.speech ?? { state: 'ready' }}
      hints={opts.hints ?? {}}
    >
      {ui}
    </AppProvider>,
  );
  return { api, ...result };
}
