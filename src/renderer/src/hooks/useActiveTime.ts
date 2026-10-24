/**
 * Measures time she is actually learning on this screen and reports it in slices.
 *
 * Time counts while the window is visible and she has interacted (or audio played) within the
 * last IDLE_MS; walking away from an open lesson does not inflate "minutes learned".
 */
import { useCallback, useEffect, useRef } from 'react';
import { api, logError } from '../api/client';

const TICK_MS = 1000;
const IDLE_MS = 90_000;
const FLUSH_MS = 30_000;

export interface ActiveTime {
  /** Total active ms on this screen so far (including already-flushed time). */
  total(): number;
  /** Sends unreported time now and returns the total. */
  flush(): Promise<number>;
  /**
   * Returns the not-yet-reported time and marks it reported. For calls that report time
   * themselves (parts.complete adds its activeMs to the day), so it is not counted twice.
   */
  takeUnsent(): number;
  /** Call on meaningful activity that is not a DOM event (e.g. a recording finished). */
  poke(): void;
}

export function useActiveTime(enabled = true): ActiveTime {
  const total = useRef(0);
  const unsent = useRef(0);
  const lastActivity = useRef(0);

  const send = useCallback(async () => {
    const ms = unsent.current;
    if (ms < 1000) return;
    unsent.current = 0;
    try {
      await api.today.addActiveTime(ms);
    } catch (err) {
      unsent.current += ms;
      logError('addActiveTime', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    lastActivity.current = Date.now();
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity.current < IDLE_MS) {
        total.current += TICK_MS;
        unsent.current += TICK_MS;
      }
    }, TICK_MS);
    const flusher = setInterval(() => void send(), FLUSH_MS);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
      clearInterval(flusher);
      void send();
    };
  }, [enabled, send]);

  return {
    total: () => total.current,
    flush: async () => {
      await send();
      return total.current;
    },
    takeUnsent: () => {
      const ms = unsent.current;
      unsent.current = 0;
      return ms;
    },
    poke: () => {
      lastActivity.current = Date.now();
    },
  };
}
