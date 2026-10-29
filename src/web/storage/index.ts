import type { AppApi, RecordingView } from '../../shared/ipc';
import { CHANNEL_ARGS } from '../../main/ipc/schemas';
import { createWorkerTransport, type StorageTransport } from './client';
import { AppError } from './errors';
import { LocalDiagnostics, download } from './diagnostics';
import { validateAudio } from './wav';
import type { StorageAssets, StorageSpeech, WebRuntime } from './types';
export type { BackupClient, WebRuntime } from './types';

export async function createWebApi(deps: {
  assets: StorageAssets;
  speech: StorageSpeech;
}): Promise<WebRuntime> {
  let transport: StorageTransport | undefined;
  try {
    const bundle = await deps.assets.getBundle();
    transport = createWorkerTransport(
      new Worker(new URL('./database.worker.ts', import.meta.url), { type: 'module' }),
    );
    await transport.call('init', bundle);
    return await createRuntime(deps, transport);
  } catch (error) {
    transport?.close();
    if (error instanceof AppError) throw error;
    throw new AppError('INTERNAL', '本机学习数据未能启动，请重试。', { cause: error });
  }
}
export async function createRuntime(
  deps: { assets: StorageAssets; speech: StorageSpeech },
  transport: StorageTransport,
): Promise<WebRuntime> {
  const bundle = await deps.assets.getBundle();
  const logs = new LocalDiagnostics();
  let queue = Promise.resolve<unknown>(undefined);
  let disposed = false;
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = queue.then(() => {
      if (disposed) throw new AppError('STORAGE_FAILED', '数据服务已关闭。');
      return fn();
    });
    queue = result.catch(() => {});
    return result.catch((error: unknown) => {
      logs.write('error', 'storage operation failed');
      if (error instanceof AppError && error.code === 'STORAGE_QUOTA') deps.assets.pause();
      throw error;
    });
  };
  const call = <T>(method: string, ...args: unknown[]) =>
    serialized(() => transport.call<T>(method, ...args));
  const urls = new Map<string, string>();
  const lists = new Map<string, Set<string>>();
  const views = (rows: (RecordingView & { blob: Blob })[], list?: string): RecordingView[] => {
    if (list) {
      const next = new Set(rows.map((r) => r.id));
      for (const id of lists.get(list) ?? []) {
        if (!next.has(id)) {
          const previous = urls.get(id);
          if (previous) URL.revokeObjectURL(previous);
          urls.delete(id);
        }
      }
      lists.set(list, next);
    }
    return rows.map(({ blob, ...r }) => {
      const previous = urls.get(r.id);
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(blob);
      urls.set(r.id, url);
      return { ...r, url };
    });
  };
  const status = async () => {
    const state = await deps.speech
      .getStatus()
      .catch(() => ({ state: 'unavailable' as const, message: '识别不可用，可以录音回听后自己评分。' }));
    await call('speech.available', state.state === 'ready');
    return state;
  };
  await status();
  const api: AppApi = {
    app: {
      getInfo: async () => ({
        appVersion: '0.1.0',
        contentVersion: bundle.contentVersion,
        dataDir: '浏览器本机存储（OPFS / IndexedDB）',
        logsDir: '浏览器本机诊断日志',
        isDev: false,
      }),
    },
    content: { getBundle: async () => bundle },
    today: { get: () => call('today.get'), addActiveTime: (ms) => call('today.addActiveTime', ms) },
    parts: {
      complete: (input) => call('parts.complete', input),
      listCompleted: () => call('parts.listCompleted'),
    },
    review: {
      getQueue: async () => {
        await status();
        return call('review.getQueue');
      },
      submit: (input) => call('review.submit', input),
      getPracticeSet: async (scope) => {
        await status();
        return call('review.getPracticeSet', scope);
      },
    },
    hints: {
      getProgress: () => call('hints.getProgress'),
      recordCorrect: (keys) => call('hints.recordCorrect', keys),
    },
    progress: { getStats: () => call('progress.getStats') },
    settings: { get: () => call('settings.get'), update: (patch) => call('settings.update', patch) },
    speech: {
      getStatus: status,
      recognize: async (input) => {
        if (!CHANNEL_ARGS['speech.recognize'].safeParse([input]).success)
          throw new AppError('INVALID_INPUT', '录音格式无效。');
        validateAudio(input.samples, input.sampleRate);
        const recordingId = input.keep ? await call<string>('recordings.saveSpeech', input) : null;
        let text: string;
        try {
          text = await deps.speech.recognize(input.samples.slice(), input.sampleRate);
        } catch (error) {
          if (error instanceof Error && 'code' in error && typeof error.code === 'string')
            throw new AppError(error.code, error.message);
          throw new AppError('SPEECH_FAILED', '没能识别这段录音，请回听后自己评分。');
        }
        if (recordingId) await call('recordings.transcript', recordingId, text);
        return {
          text,
          recordingId,
          durationMs: Math.round((input.samples.length / input.sampleRate) * 1000),
        };
      },
      annotateRecording: (input) => call('speech.annotateRecording', input),
    },
    recordings: {
      list: async (id) => views(await call('recordings.list', id), `item:${id}`),
      listChallenges: async () => views(await call('recordings.listChallenges'), 'challenges'),
      saveChallenge: async (input) => views([await call('recordings.saveChallenge', input)])[0]!,
    },
    diagnostics: {
      openLogsFolder: async () => {
        download(logs.blob(), 'kaikou-logs.json');
      },
      exportBundle: async () => {
        const folder = `kaikou-diagnostics-${Date.now()}.json`;
        download(logs.blob(), folder);
        return { folder };
      },
    },
    log: {
      write: async (level, message, meta) => {
        if (!CHANNEL_ARGS['log.write'].safeParse([level, message, meta]).success)
          throw new AppError('INVALID_INPUT', '日志输入格式无效。');
        logs.write(level, message);
      },
    },
  };
  return {
    api,
    backup: {
      exportFile: () => call('backup.export'),
      inspectFile: (file) => call('backup.inspect', file),
      importFile: (file) =>
        serialized(async () => {
          await transport.call('backup.inspect', file);
          // Preserve a complete current backup before any replacement is staged.
          const previous = await transport.call<Blob>('backup.export');
          download(previous, `kaikou-before-import-${Date.now()}.json`);
          await transport.call('backup.import', file);
          for (const url of urls.values()) URL.revokeObjectURL(url);
          urls.clear();
          lists.clear();
        }),
      storageStatus: async () => {
        if (!navigator.storage) return { persistent: false, usage: null, quota: null };
        let persistent = false;
        try {
          persistent = await navigator.storage.persist();
        } catch {
          /* Denial is reported by the status. */
        }
        try {
          const estimate = await navigator.storage.estimate();
          return { persistent, usage: estimate.usage ?? null, quota: estimate.quota ?? null };
        } catch {
          return { persistent, usage: null, quota: null };
        }
      },
    },
    dispose: async () => {
      await queue;
      disposed = true;
      try {
        await transport.call('dispose');
      } finally {
        transport.close();
        for (const url of urls.values()) URL.revokeObjectURL(url);
        urls.clear();
        lists.clear();
      }
    },
  };
}
