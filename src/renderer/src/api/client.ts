/**
 * The renderer's handle on the main process. Components import `api` from here instead of using
 * `window.api` directly, so tests can swap in `mockApi` with `setApi`.
 */
import type { AppApi, AppErrorCode } from '@shared/ipc';

let override: AppApi | undefined;

export function setApi(next: AppApi | undefined): void {
  override = next;
}

function current(): AppApi {
  const a = override ?? (typeof window !== 'undefined' ? window.api : undefined);
  if (!a) throw new Error('window.api is not available (preload script did not run)');
  return a;
}

export const api: AppApi = new Proxy({} as AppApi, {
  get(_t, ns: string) {
    return new Proxy(
      {},
      {
        get(_t2, method: string) {
          return (...args: unknown[]) => {
            const target = current()[ns as keyof AppApi] as Record<string, (...a: unknown[]) => unknown>;
            return target[method]!(...args);
          };
        },
      },
    );
  },
});

const CODES: AppErrorCode[] = [
  'SPEECH_UNAVAILABLE',
  'SPEECH_FAILED',
  'NOT_FOUND',
  'INVALID_INPUT',
  'INTERNAL',
];

/** Recovers the stable error code from an IPC error (Electron flattens errors into the message). */
export function errorCode(err: unknown): AppErrorCode {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (e && typeof e.code === 'string' && (CODES as string[]).includes(e.code)) return e.code as AppErrorCode;
  const msg = typeof e?.message === 'string' ? e.message : String(err);
  return CODES.find((c) => msg.includes(c)) ?? 'INTERNAL';
}

export function logError(context: string, err: unknown): void {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  try {
    void api.log.write('error', `${context}: ${message}`).catch(() => undefined);
  } catch {
    // No api (e.g. during tests without a mock): nothing more we can do.
  }
}
