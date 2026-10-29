import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../clock';
import { silentLogger } from '../logger';
import type { HostRequest, HostResponse } from './host/protocol';
import { isSilent } from './silence';
import { WhisperAsrProvider, type HostProcess } from './whisperAsrProvider';

type Behaviour = (req: HostRequest, host: FakeHost) => void;

class FakeHost extends EventEmitter implements HostProcess {
  readonly received: HostRequest[] = [];
  killed = false;
  constructor(private readonly behave: Behaviour) {
    super();
  }
  postMessage(message: HostRequest): void {
    this.received.push(message);
    queueMicrotask(() => this.behave(message, this));
  }
  reply(msg: HostResponse): void {
    this.emit('message', msg);
  }
  kill(): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit('exit', 0));
    return true;
  }
  crash(): void {
    this.emit('exit', 1);
  }
}

const normal: Behaviour = (req, host) => {
  if (req.type === 'init') host.reply({ type: 'ready', id: req.id, loadMs: 5 });
  else host.reply({ type: 'result', id: req.id, text: 'hello', decodeMs: 3 });
};

const speech = Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i / 3) * 0.3);
const model = { encoder: 'e', decoder: 'd', tokens: 't' };

afterEach(() => vi.useRealTimers());

describe('WhisperAsrProvider', () => {
  it('starts the host lazily, loads once, then recognises', async () => {
    const hosts: FakeHost[] = [];
    const p = new WhisperAsrProvider({
      model,
      logger: silentLogger,
      fork: () => (hosts.push(new FakeHost(normal)), hosts.at(-1)!),
    });
    expect(hosts).toHaveLength(0);
    expect(await p.recognize(speech, 16000)).toBe('hello');
    expect(await p.recognize(speech, 16000)).toBe('hello');
    expect(hosts).toHaveLength(1);
    expect(hosts[0]!.received.map((r) => r.type)).toEqual(['init', 'recognize', 'recognize']);
    expect(p.getStatus().state).toBe('ready');
  });

  it('returns empty text for silence without touching the model', async () => {
    const fork = vi.fn(() => new FakeHost(normal));
    const p = new WhisperAsrProvider({ model, logger: silentLogger, fork });
    expect(await p.recognize(new Float32Array(16000), 16000)).toBe('');
    expect(fork).not.toHaveBeenCalled();
  });

  it('times out a stuck decode, kills the host, and recovers on the next call', async () => {
    vi.useFakeTimers();
    let stuck = true;
    const hosts: FakeHost[] = [];
    const behave: Behaviour = (req, host) => {
      if (req.type === 'init') host.reply({ type: 'ready', id: req.id, loadMs: 1 });
      else if (!stuck) host.reply({ type: 'result', id: req.id, text: 'ok', decodeMs: 1 });
    };
    const p = new WhisperAsrProvider({
      model,
      logger: silentLogger,
      timeoutMs: 1000,
      fork: () => (hosts.push(new FakeHost(behave)), hosts.at(-1)!),
    });
    const pending = p.recognize(speech, 16000);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'SPEECH_FAILED' });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(hosts[0]!.killed).toBe(true);
    stuck = false;
    await expect(p.recognize(speech, 16000)).resolves.toBe('ok');
    expect(hosts).toHaveLength(2);
    // An intentional kill is not a crash.
    expect(p.getStatus().state).toBe('ready');
  });

  it('reports an error state after repeated crashes, then recovers after the window', async () => {
    const clock = new FakeClock('2026-11-02T09:00:00');
    let host: FakeHost | null = null;
    const crashing: Behaviour = (req, h) => {
      if (req.type === 'init') h.reply({ type: 'ready', id: req.id, loadMs: 1 });
      else h.crash();
    };
    const p = new WhisperAsrProvider({
      model,
      logger: silentLogger,
      clock,
      fork: () => (host = new FakeHost(crashing)),
    });
    for (let i = 0; i < 3; i++)
      await expect(p.recognize(speech, 16000)).rejects.toMatchObject({ code: 'SPEECH_FAILED' });
    expect(p.getStatus().state).toBe('error');
    await expect(p.recognize(speech, 16000)).rejects.toMatchObject({ code: 'SPEECH_UNAVAILABLE' });
    clock.advanceMs(121_000);
    expect(p.getStatus().state).toBe('ready');
    expect(host).not.toBeNull();
  });

  it('turns host errors into SPEECH_FAILED', async () => {
    const p = new WhisperAsrProvider({
      model,
      logger: silentLogger,
      fork: () =>
        new FakeHost((req, h) =>
          req.type === 'init'
            ? h.reply({ type: 'ready', id: req.id, loadMs: 1 })
            : h.reply({ type: 'error', id: req.id, message: 'x' }),
        ),
    });
    await expect(p.recognize(speech, 16000)).rejects.toMatchObject({ code: 'SPEECH_FAILED' });
  });
});

describe('silence guard', () => {
  it('treats very short or very quiet audio as silence', () => {
    expect(isSilent(new Float32Array(16000), 16000)).toBe(true);
    expect(
      isSilent(
        Float32Array.from({ length: 16000 }, () => 0.003),
        16000,
      ),
    ).toBe(true);
    expect(isSilent(speech.subarray(0, 2000), 16000)).toBe(true);
    expect(isSilent(speech, 16000)).toBe(false);
  });

  it('a short loud word inside a long quiet recording is speech', () => {
    const a = new Float32Array(16000 * 4);
    a.set(speech.subarray(0, 4000), 16000);
    expect(isSilent(a, 16000)).toBe(false);
  });
});
