import { ipcMain } from 'electron';
import { API_CHANNELS, type AppApi } from '../../shared/ipc';
import type { Logger } from '../logger';
import { createDispatcher } from './dispatch';

export function registerIpc(api: AppApi, logger: Logger): void {
  const dispatch = createDispatcher(api, logger);
  for (const channel of API_CHANNELS) {
    ipcMain.handle(channel, (_event, ...args: unknown[]) => dispatch(channel, args));
  }
}
