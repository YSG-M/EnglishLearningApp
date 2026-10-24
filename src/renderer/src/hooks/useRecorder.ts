import { useCallback, useEffect, useRef, useState } from 'react';
import { player } from '../audio/player';
import { MicError, startRecording, type Recording, type RecordingSession } from '../audio/recorder';
import { logError } from '../api/client';
import { zh } from '../i18n/zh';

export type RecorderState = 'idle' | 'recording';

export interface UseRecorder {
  state: RecorderState;
  level: number;
  error: string | null;
  /** Starts recording; resolves with the recording when it stops (auto or manual), or null on error. */
  record(opts: {
    silenceMs: number;
    autoStop?: boolean;
    maxMs?: number;
    noSpeechMs?: number;
  }): Promise<Recording | null>;
  stop(): void;
}

export function useRecorder(): UseRecorder {
  const [state, setState] = useState<RecorderState>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<RecordingSession | null>(null);

  useEffect(() => () => session.current?.stop(), []);

  const record = useCallback<UseRecorder['record']>(async (opts) => {
    if (session.current) return null;
    player.stop();
    setError(null);
    try {
      const s = await startRecording({
        silenceMs: opts.silenceMs,
        autoStop: opts.autoStop ?? true,
        maxMs: opts.maxMs ?? 15_000,
        noSpeechMs: opts.noSpeechMs ?? 7_000,
        onLevel: setLevel,
      });
      session.current = s;
      setState('recording');
      const rec = await s.done;
      return rec;
    } catch (err) {
      if (err instanceof MicError)
        setError(err.kind === 'missing' ? zh.errors.micMissing : zh.errors.micDenied);
      else setError(zh.errors.generic);
      logError('recording', err);
      return null;
    } finally {
      session.current = null;
      setState('idle');
      setLevel(0);
    }
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);

  return { state, level, error, record, stop };
}
