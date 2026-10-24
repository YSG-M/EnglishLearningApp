/**
 * Opt-in screenshot mode for verifying the UI without a human:
 *   electron . --capture=shot.png          or  KAIKOU_CAPTURE=shot.png
 *   KAIKOU_CAPTURE_DELAY=3000                    wait after load (ms, default 2500)
 *   KAIKOU_CAPTURE_SCRIPT="document.querySelector('button').click()"   run first (e.g. navigate)
 * The window is captured to PNG and the app quits.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserWindow } from 'electron';
import type { Logger } from '../logger';

export interface CaptureRequest {
  file: string;
  delayMs: number;
  script?: string;
}

export function parseCaptureRequest(argv: string[], env: NodeJS.ProcessEnv): CaptureRequest | null {
  const arg = argv.find((a) => a.startsWith('--capture='));
  const file = arg ? arg.slice('--capture='.length) : env.KAIKOU_CAPTURE;
  if (!file) return null;
  const delay = Number(env.KAIKOU_CAPTURE_DELAY);
  return {
    file: resolve(file),
    delayMs: Number.isFinite(delay) && delay >= 0 ? delay : 2500,
    ...(env.KAIKOU_CAPTURE_SCRIPT ? { script: env.KAIKOU_CAPTURE_SCRIPT } : {}),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runCapture(
  win: BrowserWindow,
  req: CaptureRequest,
  logger: Logger,
  quit: () => void,
): Promise<void> {
  try {
    await sleep(req.delayMs);
    if (req.script) {
      await win.webContents.executeJavaScript(req.script, true);
      await sleep(req.delayMs);
    }
    const image = await win.webContents.capturePage();
    writeFileSync(req.file, image.toPNG());
    logger.info('capture written', { file: req.file });
  } catch (err) {
    logger.error('capture failed', { error: String(err) });
    process.exitCode = 1;
  } finally {
    quit();
  }
}
