/**
 * Every filesystem location the app uses, resolved in one place (see docs/02-architecture.md §3.3).
 * Pure: Electron values are passed in, so the rules are unit-tested.
 */
import { join } from 'node:path';

export interface AppPaths {
  /** Read-only resources shipped with the app (content bundle, audio, models). */
  resourcesDir: string;
  contentBundle: string;
  audioDir: string;
  whisperModelDir: string;
  userDataDir: string;
  dataDir: string;
  dbFile: string;
  backupsDir: string;
  recordingsDir: string;
  logsDir: string;
}

export interface PathInputs {
  isPackaged: boolean;
  /** app.getAppPath(): the project root in development. */
  appPath: string;
  /** process.resourcesPath: where electron-builder puts extraResources. */
  resourcesPath: string;
  userDataDir: string;
}

export function resolveAppPaths(i: PathInputs): AppPaths {
  const resourcesDir = i.isPackaged ? i.resourcesPath : join(i.appPath, 'resources');
  const dataDir = join(i.userDataDir, 'data');
  return {
    resourcesDir,
    contentBundle: join(resourcesDir, 'content', 'bundle.json'),
    audioDir: join(resourcesDir, 'audio'),
    whisperModelDir: join(resourcesDir, 'models', 'whisper-base.en'),
    userDataDir: i.userDataDir,
    dataDir,
    dbFile: join(dataDir, 'learning.sqlite'),
    backupsDir: join(dataDir, 'backups'),
    recordingsDir: join(i.userDataDir, 'recordings'),
    logsDir: join(i.userDataDir, 'logs'),
  };
}

/**
 * Development and the installed app must never share learner data on the same machine.
 * KAIKOU_USER_DATA overrides both (used for clean-state screenshots and manual testing).
 */
export function chooseUserDataDir(opts: {
  isPackaged: boolean;
  appDataDir: string;
  override?: string;
}): string {
  if (opts.override) return opts.override;
  return join(opts.appDataDir, opts.isPackaged ? 'KaikouEnglish' : 'KaikouEnglish-dev');
}
