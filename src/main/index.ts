/**
 * Main process entry: wires paths, logging, database, services, speech and IPC, then opens the window.
 * Everything with logic lives in modules that can be tested without Electron.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, net, protocol, session, shell, utilityProcess } from 'electron';
import { MEDIA_SCHEME } from '../shared/ipc';
import { createAppApi } from './api';
import { parseCaptureRequest, runCapture } from './app/capture';
import { mediaFilePath, parseMediaUrl } from './app/media';
import { chooseUserDataDir, resolveAppPaths, type AppPaths } from './app/paths';
import { systemClock } from './clock';
import { openDatabase, type Database } from './db/database';
import { createRepositories } from './db/repositories';
import { registerIpc } from './ipc/registerIpc';
import { errorMeta, type Logger } from './logger';
import { initLogging, rendererLogger } from './logging';
import { ContentService } from './services/contentService';
import { DiagnosticsService } from './services/diagnosticsService';
import { LearningService } from './services/learningService';
import { RecordingService } from './services/recordingService';
import { UnavailableAsrProvider, type AsrProvider } from './speech/asrProvider';
import type { HostProcess } from './speech/whisperAsrProvider';
import { modelFilesPresent, whisperModelFiles, WhisperAsrProvider } from './speech/whisperAsrProvider';

const WINDOW_TITLE = '开口说 · 新加坡生活英语';
const capture = parseCaptureRequest(process.argv, process.env);

// Must happen before `ready`: media:// behaves like a secure, fetchable, streamable origin.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

app.setPath(
  'userData',
  chooseUserDataDir({
    isPackaged: app.isPackaged,
    appDataDir: app.getPath('appData'),
    override: process.env.KAIKOU_USER_DATA,
  }),
);

if (!capture && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  void app.whenReady().then(start);
}

let db: Database | null = null;
let asr: AsrProvider | null = null;

async function start(): Promise<void> {
  const paths = resolveAppPaths({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userDataDir: app.getPath('userData'),
  });
  for (const dir of [paths.dataDir, paths.recordingsDir, paths.logsDir]) mkdirSync(dir, { recursive: true });
  const logger = initLogging(paths.logsDir);
  logger.info('app starting', {
    version: app.getVersion(),
    electron: process.versions.electron,
    packaged: app.isPackaged,
    userData: paths.userDataDir,
  });

  try {
    db = openDatabase(paths.dbFile, { backupsDir: paths.backupsDir, logger });
  } catch (err) {
    logger.error('database could not be opened', errorMeta(err));
    throw err;
  }
  const repos = createRepositories(db);
  const content = new ContentService(paths.contentBundle, logger);
  content.load();
  asr = createAsr(paths, logger);
  const speech = asr;

  const learning = new LearningService({
    db,
    repos,
    content: () => content.bundle(),
    clock: systemClock,
    logger,
    speechAvailable: () => speech.getStatus().state === 'ready' || speech.getStatus().state === 'loading',
  });
  const recordings = new RecordingService(paths.recordingsDir, repos.recordings, systemClock, logger);
  const info = () => ({
    appVersion: app.getVersion(),
    contentVersion: content.version(),
    dataDir: paths.userDataDir,
    logsDir: paths.logsDir,
    isDev: !app.isPackaged,
  });
  const diagnostics = new DiagnosticsService({
    logsDir: paths.logsDir,
    desktopDir: app.getPath('desktop'),
    db,
    clock: systemClock,
    logger,
    openPath: (p) => shell.openPath(p),
    info: () => ({
      ...info(),
      electron: process.versions.electron,
      os: `${process.platform} ${process.getSystemVersion()}`,
      arch: process.arch,
      speech: speech.getStatus(),
      cards: repos.cards.count(),
      reviews: repos.reviewLogs.count(),
      partsCompleted: repos.parts.listIds().length,
      recentEvents: repos.events.recent(20),
    }),
  });

  registerIpc(
    createAppApi({
      info,
      content,
      learning,
      recordings,
      asr: speech,
      diagnostics,
      logger,
      rendererLog: rendererLogger(logger),
    }),
    logger,
  );
  registerMediaProtocol(paths, logger);
  configureSession(logger);

  const win = createWindow(logger);
  // Load the model while she reads the home screen, so the first answer is quick.
  if (!capture) setTimeout(() => speech.warmup?.(), 4000);

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    asr?.dispose?.();
    db?.close();
  });
  if (capture)
    win.webContents.once('did-finish-load', () => void runCapture(win, capture, logger, () => app.quit()));
}

function createAsr(paths: AppPaths, logger: Logger): AsrProvider {
  if (!modelFilesPresent(paths.whisperModelDir)) {
    logger.warn('whisper model not found; speech recognition disabled', { dir: paths.whisperModelDir });
    return new UnavailableAsrProvider();
  }
  const hostScript = join(__dirname, 'speechHost.js');
  return new WhisperAsrProvider({
    model: whisperModelFiles(paths.whisperModelDir),
    logger,
    fork: () =>
      utilityProcess.fork(hostScript, [], {
        serviceName: 'speech-host',
        stdio: 'ignore',
      }) as unknown as HostProcess,
  });
}

function registerMediaProtocol(paths: AppPaths, logger: Logger): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const target = parseMediaUrl(request.url);
    if (!target) {
      logger.warn('rejected media request', { url: request.url });
      return new Response('Not found', { status: 404 });
    }
    try {
      const res = await net.fetch(pathToFileURL(mediaFilePath(target, paths)).toString());
      if (!res.ok) return new Response('Not found', { status: 404 });
      // The page's origin is file:// (or the dev server), so fetch() needs CORS; <audio> does not.
      return new Response(res.body, {
        status: 200,
        headers: {
          'content-type': 'audio/wav',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      });
    } catch {
      // Missing file: the renderer falls back to speechSynthesis.
      return new Response('Not found', { status: 404 });
    }
  });
}

function configureSession(logger: Logger): void {
  const ses = session.defaultSession;
  // Only the microphone is ever needed.
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const ok =
      permission === 'media' &&
      (details as { mediaTypes?: string[] }).mediaTypes?.every((t) => t === 'audio') !== false;
    if (!ok) logger.warn('permission denied', { permission });
    callback(ok);
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  if (app.isPackaged) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
              "media-src 'self' media: blob:; connect-src 'self' media:; font-src 'self' data:; worker-src 'self' blob:",
          ],
        },
      });
    });
  }
}

function createWindow(logger: Logger): BrowserWindow {
  const win = new BrowserWindow({
    title: WINDOW_TITLE,
    width: 1200,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    show: !capture,
    backgroundColor: '#fdfbf7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // No popups, no navigating away from the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'file://')) e.preventDefault();
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    logger.error('renderer crashed; reloading', { ...details });
    if (details.reason !== 'clean-exit') win.reload();
  });
  win.on('page-title-updated', (e) => e.preventDefault());

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}
