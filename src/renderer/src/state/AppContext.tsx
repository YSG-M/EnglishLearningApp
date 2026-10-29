/**
 * App-wide state: the content bundle, settings, speech status, per-word hint progress and the
 * current screen. Pages read it through `useApp()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ContentBundle } from '@shared/content/bundle';
import type { SpeechStatus } from '@shared/ipc';
import type { Settings } from '@shared/settings';
import { api, logError } from '../api/client';

export type Route =
  | { name: 'today' }
  | { name: 'course' }
  | { name: 'review' }
  | { name: 'phrasebook' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'mine' }
  | { name: 'part'; partId: string; from?: 'today' | 'course' }
  | { name: 'unitSummary'; unitId: string; from?: Route }
  | { name: 'weekSummary'; week: number; from?: Route };

export interface AppState {
  bundle: ContentBundle;
  settings: Settings;
  speech: SpeechStatus;
  saveError: string | null;
  hintProgress: Record<string, number>;
  route: Route;
  navigate(route: Route): void;
  goBack(): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  recordCorrectWords(keys: string[]): Promise<void>;
  refreshSpeech(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}

export type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      bundle: ContentBundle;
      settings: Settings;
      speech: SpeechStatus;
      hints: Record<string, number>;
    };

export function useInitialLoad(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.content.getBundle(),
      api.settings.get(),
      api.speech.getStatus(),
      api.hints.getProgress(),
    ])
      .then(([bundle, settings, speech, hints]) => {
        if (alive) setState({ status: 'ready', bundle, settings, speech, hints });
      })
      .catch((err: unknown) => {
        logError('initial load', err);
        if (alive) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function AppProvider(props: {
  bundle: ContentBundle;
  settings: Settings;
  speech: SpeechStatus;
  hints: Record<string, number>;
  initialRoute?: Route;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(props.settings);
  const [speech, setSpeech] = useState(props.speech);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hintProgress, setHintProgress] = useState(props.hints);
  const [route, setRoute] = useState<Route>(props.initialRoute ?? { name: 'today' });
  const [history, setHistory] = useState<Route[]>([]);

  const refreshSpeech = useCallback(async () => {
    try {
      setSpeech(await api.speech.getStatus());
    } catch (err) {
      logError('speech status', err);
    }
  }, []);

  // The recogniser loads lazily in the background; poll until it settles.
  useEffect(() => {
    if (speech.state !== 'loading') return;
    const t = setTimeout(() => void refreshSpeech(), 2000);
    return () => clearTimeout(t);
  }, [speech.state, refreshSpeech]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSaveError(null);
    try {
      setSettings(await api.settings.update(patch));
    } catch (err) {
      logError('settings update', err);
      setSaveError('设置未保存，请检查本机可用空间后重试。');
    }
  }, []);

  const recordCorrectWords = useCallback(async (keys: string[]) => {
    if (!keys.length) return;
    try {
      setHintProgress(await api.hints.recordCorrect(keys));
    } catch (err) {
      logError('hint progress', err);
    }
  }, []);

  const navigate = useCallback(
    (r: Route) => {
      setHistory((h) => [...h, route]);
      setRoute(r);
      document.querySelector('main')?.scrollTo?.(0, 0);
    },
    [route],
  );

  const goBack = useCallback(() => {
    if (route.name === 'today') {
      document.querySelector('main')?.scrollTo?.(0, 0);
      return;
    }
    if (route.name === 'course' || route.name === 'review' || route.name === 'mine') {
      setRoute({ name: 'today' });
      setHistory([]);
      return;
    }
    const previous = history.at(-1);
    setHistory((h) => h.slice(0, -1));
    setRoute(previous ?? { name: 'today' });
  }, [history, route.name]);

  const value = useMemo<AppState>(
    () => ({
      bundle: props.bundle,
      settings,
      speech,
      saveError,
      hintProgress,
      route,
      navigate,
      goBack,
      updateSettings,
      recordCorrectWords,
      refreshSpeech,
    }),
    [
      props.bundle,
      settings,
      speech,
      saveError,
      hintProgress,
      route,
      navigate,
      goBack,
      updateSettings,
      recordCorrectWords,
      refreshSpeech,
    ],
  );
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}
