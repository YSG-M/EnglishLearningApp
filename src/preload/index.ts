/**
 * Exposes AppApi as window.api. Each call becomes ipcRenderer.invoke('<ns>.<method>', ...args);
 * a failed call rejects with `{ name: 'AppError', code: AppErrorCode, message: <Chinese, safe to show> }`.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { API_CHANNELS, type AppApi } from '../shared/ipc';
import type { IpcEnvelope } from '../main/ipc/envelope';

function buildApi(): AppApi {
  const api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> = {};
  for (const channel of API_CHANNELS) {
    const [ns, method] = channel.split('.') as [string, string];
    api[ns] ??= {};
    api[ns][method] = async (...args: unknown[]) => {
      const res = (await ipcRenderer.invoke(channel, ...args)) as IpcEnvelope;
      if (res.ok) return res.value;
      // A plain object, not an Error: contextBridge strips custom properties (like `code`) from Errors.
      throw { name: 'AppError', code: res.error.code, message: res.error.message };
    };
  }
  return api as unknown as AppApi;
}

contextBridge.exposeInMainWorld('api', buildApi());
