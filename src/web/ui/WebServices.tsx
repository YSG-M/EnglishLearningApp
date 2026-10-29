/* @jsxRuntime automatic */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configurePlayer, player, type PlaybackError } from '../../renderer/src/audio/player';
import { Button, Notice } from '../../renderer/src/components/ui';
import { useApp } from '../../renderer/src/state/AppContext';
import type { AssetsClient } from '../assets/types';
import type { SpeechClient } from '../speech/types';
import type { BackupClient } from '../storage/types';

export interface WebServices {
  assets: AssetsClient;
  speech: SpeechClient;
  backup: BackupClient;
}

const Context = createContext<WebServices | null>(null);
const PlaybackContext = createContext<PlaybackError | null>(null);
const WeeksContext = createContext<number[]>([]);

export function WebServicesProvider({ children, ...services }: WebServices & { children: ReactNode }) {
  const [error, setError] = useState<PlaybackError | null>(null);
  const [weeks, setWeeks] = useState<number[]>([]);
  const value = useMemo(
    () => ({ assets: services.assets, speech: services.speech, backup: services.backup }),
    [services.assets, services.speech, services.backup],
  );
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void services.assets
        .getAvailableWeeks?.()
        .then((available) => {
          if (alive) setWeeks(available);
        })
        .catch(() => {
          if (alive) setWeeks([]);
        });
    };
    refresh();
    const unsubscribe = services.assets.subscribe((state) => {
      if (state.phase === 'ready' || state.phase === 'error') refresh();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [services.assets]);
  useEffect(() => {
    configurePlayer({
      resolveClip: (key) => services.assets.resolveClip(key),
      allowSpeechSynthesis: false,
      onError: setError,
    });
    return player.subscribe(() => setError(null));
  }, [services.assets]);
  return (
    <Context.Provider value={value}>
      <WeeksContext.Provider value={weeks}>
        <PlaybackContext.Provider value={error}>{children}</PlaybackContext.Provider>
      </WeeksContext.Provider>
    </Context.Provider>
  );
}

export function PlaybackNotice() {
  const error = useContext(PlaybackContext);
  const { navigate } = useApp();
  if (!error) return null;
  return (
    <Notice tone="warn">
      {error.kind === 'gesture' ? (
        <>
          <p>请点一下继续播放原音。</p>
          <Button onClick={() => void player.play(error.request)}>继续播放</Button>
        </>
      ) : (
        <>
          <p>这段音频还没下载，或暂时无法播放。请连网下载这周课程后重试。</p>
          <Button onClick={() => navigate({ name: 'settings' })}>打开离线课程设置</Button>
          <Button onClick={() => navigate({ name: 'course' })}>返回可用课程</Button>
        </>
      )}
    </Notice>
  );
}

export function useWebServices(): WebServices | null {
  return useContext(Context);
}

export function useAvailableWeeks(): number[] {
  return useContext(WeeksContext);
}
