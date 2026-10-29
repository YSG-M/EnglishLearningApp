/**
 * Channel dispatch, independent of Electron: validate → call AppApi → wrap in an envelope.
 * registerIpc.ts plugs this into ipcMain; tests call it directly.
 */
import { API_CHANNELS, type ApiChannel, type AppApi } from '../../shared/ipc';
import { AppError, toSerializedError } from '../errors';
import type { Logger } from '../logger';
import { errorMeta } from '../logger';
import type { IpcEnvelope } from './envelope';
import { CHANNEL_ARGS } from './schemas';

type AnyFn = (...args: unknown[]) => Promise<unknown>;

export function resolveHandler(api: AppApi, channel: ApiChannel): AnyFn {
  const [ns, method] = channel.split('.') as [keyof AppApi, string];
  const group = api[ns] as unknown as Record<string, AnyFn>;
  const fn = group[method];
  if (typeof fn !== 'function') throw new Error(`AppApi has no implementation for ${channel}`);
  return fn.bind(group);
}

export function createDispatcher(api: AppApi, logger: Logger) {
  const handlers = new Map<string, AnyFn>(API_CHANNELS.map((c) => [c, resolveHandler(api, c)]));
  return async function dispatch(channel: string, args: unknown[]): Promise<IpcEnvelope> {
    const handler = handlers.get(channel);
    try {
      if (!handler) throw new AppError('INVALID_INPUT', `未知的请求：${channel}`);
      const parsed = CHANNEL_ARGS[channel as ApiChannel].safeParse(args);
      if (!parsed.success) {
        logger.warn('invalid IPC input', { channel, issues: parsed.error.issues.slice(0, 5) });
        throw new AppError('INVALID_INPUT', '请求的数据不正确。');
      }
      return { ok: true, value: await handler(...(parsed.data as unknown[])) };
    } catch (err) {
      const serialized = toSerializedError(err);
      const log = serialized.code === 'INTERNAL' ? logger.error : logger.warn;
      // log.write failures must not recurse into logging the same failure.
      if (channel !== 'log.write')
        log.call(logger, `IPC ${channel} failed`, { code: serialized.code, ...errorMeta(err) });
      return { ok: false, error: serialized };
    }
  };
}
