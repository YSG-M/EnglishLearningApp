import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { createAssetsClient } from './assets';
import { createSpeechClient } from './speech';
import { createWebApi } from './storage';
import { setApi } from '../renderer/src/api/client';
import { configurePlayer, player, type PlaybackError } from '../renderer/src/audio/player';
import type { AssetsClient } from './assets/types';
import { App } from '../renderer/src/App';
import { WebServicesProvider } from './ui/WebServices';
import '../renderer/src/styles/global.css';

const container = document.getElementById('root')!;
const root = createRoot(container);
function PlaybackNotice({ assets }: { assets: AssetsClient }) {
  const [error, setError] = useState<PlaybackError | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const listener = (event: Event) => {
      setError((event as CustomEvent<PlaybackError>).detail);
      setMessage('');
    };
    window.addEventListener('kaikou-playback-error', listener);
    return () => window.removeEventListener('kaikou-playback-error', listener);
  }, []);
  if (!error) return null;
  return (
    <div
      role="alertdialog"
      aria-label="音频播放提示"
      style={{
        position: 'fixed',
        inset: '20% 16px auto',
        zIndex: 100,
        background: '#fff',
        padding: 24,
        border: '2px solid #365c42',
        borderRadius: 16,
      }}
    >
      <p>
        {error.kind === 'gesture'
          ? '请点一下继续播放原音。'
          : '这段音频还没下载，或暂时无法播放。联网后可重试。'}
      </p>
      {message ? <p role="status">{message}</p> : null}
      {error.kind === 'missing' && error.request.clip ? (
        <button
          onClick={() => {
            const weeks = assets.getClipWeeks?.(error.request.clip!) ?? [1];
            setMessage('正在核对并下载音频…');
            void assets
              .ensureWeeks(weeks.length ? weeks : [1])
              .then(() => setMessage('音频已准备，请点播放。'))
              .catch(() => setMessage('下载未完成，请检查网络或手机剩余空间后重试。'));
          }}
        >
          核对并下载本周
        </button>
      ) : null}
      <button
        onClick={() => {
          setError(null);
          void player.play(error.request);
        }}
      >
        播放
      </button>
      <button onClick={() => setError(null)}>返回课程</button>
    </div>
  );
}
async function start() {
  root.render(
    <main role="status">
      <h1>正在准备开口英语</h1>
      <p>首次使用需要连接网络。</p>
    </main>,
  );
  let dispose: (() => Promise<void>) | undefined;
  let speech: ReturnType<typeof createSpeechClient> | undefined;
  try {
    const base = new URL(import.meta.env.BASE_URL, location.href).href;
    const assets = await createAssetsClient(base);
    speech = createSpeechClient(assets);
    const runtime = await createWebApi({ assets, speech });
    dispose = runtime.dispose;
    setApi(runtime.api);
    configurePlayer({
      resolveClip: (key) => assets.resolveClip(key),
      allowSpeechSynthesis: false,
      onError: (error) => window.dispatchEvent(new CustomEvent('kaikou-playback-error', { detail: error })),
    });
    if (import.meta.env.PROD && 'serviceWorker' in navigator)
      await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base, type: 'module' });
    root.render(
      <WebServicesProvider assets={assets} speech={speech} backup={runtime.backup}>
        <App />
        <PlaybackNotice assets={assets} />
      </WebServicesProvider>,
    );
    void assets
      .ensureWeeks([1])
      .then(async () => {
        if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.serviceWorker.controller) {
          const registration = await navigator.serviceWorker.ready;
          await new Promise<void>((resolve, reject) => {
            const channel = new MessageChannel();
            const timer = window.setTimeout(() => {
              channel.port1.close();
              reject(new Error('离线应用准备超时，请重新打开'));
            }, 15000);
            channel.port1.onmessage = (event) => {
              clearTimeout(timer);
              channel.port1.close();
              if (event.data?.ok) resolve();
              else reject(new Error('离线应用校验未完成'));
            };
            registration.active?.postMessage({ type: 'CLAIM_INITIAL_VERIFIED' }, [channel.port2]);
          });
        }
        const idle =
          window.requestIdleCallback ??
          ((fn: IdleRequestCallback) =>
            window.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 10 }), 2000));
        idle(() => {
          if (document.visibilityState === 'visible')
            void assets.ensureWeeks(Array.from({ length: 12 }, (_, i) => i + 2)).catch(() => undefined);
        });
      })
      .catch(() => undefined);
    window.addEventListener(
      'pagehide',
      () => {
        assets.pause();
        speech?.dispose();
        void runtime.dispose();
      },
      { once: true },
    );
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) location.reload();
    });
  } catch (error) {
    speech?.dispose();
    await dispose?.();
    root.render(
      <main role="alert">
        <h1>启动没有完成</h1>
        <p>{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={() => void start()}>重试</button>
      </main>,
    );
  }
}
void start();
