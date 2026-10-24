/**
 * Whisper recognition in a separate Electron utilityProcess (src/main/speech/host/speechHost.ts).
 *
 * - The process starts on first use (or warmup) and loads the model once.
 * - Each request has an id and a timeout; a stuck decode kills the process, which restarts on demand.
 * - If the process crashes repeatedly, the provider reports 'error' and stops retrying for a while,
 *   so the UI can fall back to self-rating instead of failing every answer.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SpeechStatus } from '../../shared/ipc';
import type { Clock } from '../clock';
import { systemClock } from '../clock';
import { AppError } from '../errors';
import type { Logger } from '../logger';
import type { AsrProvider } from './asrProvider';
import type { HostRequest, HostResponse, WhisperModelFiles } from './host/protocol';
import { isSilent } from './silence';

/** The subset of Electron's UtilityProcess used here (lets tests supply a fake). */
export interface HostProcess {
  postMessage(message: HostRequest): void;
  on(event: 'message', listener: (message: HostResponse) => void): this;
  on(event: 'exit', listener: (code: number) => void): this;
  kill(): boolean;
}

export type ForkHost = () => HostProcess;

export const MODEL_FILES = {
  encoder: 'encoder.int8.onnx',
  decoder: 'decoder.int8.onnx',
  tokens: 'tokens.txt',
} as const;

export function whisperModelFiles(dir: string): WhisperModelFiles {
  return {
    encoder: join(dir, MODEL_FILES.encoder),
    decoder: join(dir, MODEL_FILES.decoder),
    tokens: join(dir, MODEL_FILES.tokens),
  };
}

export function modelFilesPresent(dir: string): boolean {
  return Object.values(whisperModelFiles(dir)).every((f) => existsSync(f));
}

export interface WhisperOptions {
  model: WhisperModelFiles;
  fork: ForkHost;
  logger: Logger;
  clock?: Clock;
  timeoutMs?: number;
  /** Init (model load) can be slow on a cold laptop. */
  initTimeoutMs?: number;
  numThreads?: number;
  maxCrashes?: number;
  crashWindowMs?: number;
}

interface Pending {
  resolve: (r: HostResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WhisperAsrProvider implements AsrProvider {
  private child: HostProcess | null = null;
  private ready: Promise<void> | null = null;
  private loaded = false;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private crashes: number[] = [];
  private killing = false;
  private readonly o: Required<Omit<WhisperOptions, 'clock'>> & { clock: Clock };

  constructor(opts: WhisperOptions) {
    this.o = {
      timeoutMs: 20_000,
      initTimeoutMs: 60_000,
      numThreads: 2,
      maxCrashes: 3,
      crashWindowMs: 120_000,
      clock: systemClock,
      ...opts,
    };
  }

  getStatus(): SpeechStatus {
    if (this.tooManyCrashes()) {
      return {
        state: 'error',
        message: '语音识别暂时出了问题。现在可以先用"自己评分"，过几分钟会自动重试。',
      };
    }
    if (this.loaded) return { state: 'ready' };
    // Not loaded yet but loadable on demand: speaking exercises are available.
    return this.ready ? { state: 'loading', message: '正在准备语音识别…' } : { state: 'ready' };
  }

  warmup(): void {
    this.ensureReady().catch((err: unknown) =>
      this.o.logger.warn('speech warmup failed', { error: String(err) }),
    );
  }

  async recognize(samples: Float32Array, sampleRate: number): Promise<string> {
    if (isSilent(samples, sampleRate)) return '';
    if (this.tooManyCrashes())
      throw new AppError('SPEECH_UNAVAILABLE', '语音识别暂时不可用，请先用"自己评分"。');
    await this.ensureReady();
    const res = await this.request(
      { type: 'recognize', id: this.nextId++, samples, sampleRate },
      this.o.timeoutMs,
    );
    if (res.type !== 'result') throw new AppError('SPEECH_FAILED', '没能识别这段录音，请再试一次。');
    this.o.logger.info('speech recognised', {
      ms: res.decodeMs,
      audioMs: Math.round((samples.length / sampleRate) * 1000),
    });
    return res.text;
  }

  dispose(): void {
    this.stopChild();
  }

  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.start();
      const res = await this.request(
        { type: 'init', id: this.nextId++, model: this.o.model, numThreads: this.o.numThreads },
        this.o.initTimeoutMs,
      );
      if (res.type !== 'ready') throw new AppError('SPEECH_FAILED', '语音识别模型加载失败。');
      this.loaded = true;
      this.o.logger.info('speech model loaded', { ms: res.loadMs });
    })();
    this.ready.catch(() => {
      this.ready = null;
    });
    return this.ready;
  }

  private start(): void {
    if (this.child) return;
    const child = this.o.fork();
    this.child = child;
    child.on('message', (msg) => {
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      if (msg.type === 'error') {
        this.o.logger.error('speech host error', { message: msg.message });
        p.reject(new AppError('SPEECH_FAILED', '没能识别这段录音，请再试一次。'));
      } else {
        p.resolve(msg);
      }
    });
    child.on('exit', (code) => {
      if (this.child !== child) return;
      const intentional = this.killing;
      this.killing = false;
      this.child = null;
      this.ready = null;
      this.loaded = false;
      if (!intentional) {
        this.crashes.push(this.o.clock.now().getTime());
        this.o.logger.error('speech host exited unexpectedly', { code });
      }
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new AppError('SPEECH_FAILED', '语音识别中断了，请再试一次。'));
        this.pending.delete(id);
      }
    });
  }

  private request(req: HostRequest, timeoutMs: number): Promise<HostResponse> {
    const child = this.child;
    if (!child) return Promise.reject(new AppError('SPEECH_FAILED', '语音识别没有启动。'));
    return new Promise<HostResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        this.o.logger.warn('speech request timed out; restarting host', { type: req.type, timeoutMs });
        reject(new AppError('SPEECH_FAILED', '识别时间太长了，请再说一次。'));
        this.stopChild();
      }, timeoutMs);
      this.pending.set(req.id, { resolve, reject, timer });
      child.postMessage(req);
    });
  }

  private stopChild(): void {
    if (!this.child) return;
    this.killing = true;
    this.child.kill();
  }

  private tooManyCrashes(): boolean {
    const now = this.o.clock.now().getTime();
    this.crashes = this.crashes.filter((t) => now - t < this.o.crashWindowMs);
    return this.crashes.length >= this.o.maxCrashes;
  }
}
