// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRecording } from './recorder';
import { player } from './player';

const opts = { silenceMs: 1000, autoStop: true, maxMs: 15000, noSpeechMs: 7000 };
let stop: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;
let addModule: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let nodes: FakeNode[];
class FakeNode {
  port = { onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null };
  gain = { value: 1 };
  disconnect = vi.fn();
  connect() {
    return this;
  }
  constructor() {
    nodes.push(this);
  }
}
beforeEach(() => {
  nodes = [];
  stop = vi.fn();
  close = vi.fn(async () => {});
  addModule = vi.fn(async () => {});
  getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal(
    'AudioContext',
    class {
      sampleRate = 48000;
      destination = {};
      audioWorklet = { addModule };
      resume = vi.fn(async () => {});
      close = close;
      createMediaStreamSource = () => new FakeNode();
      createGain = () => new FakeNode();
    },
  );
  vi.stubGlobal('AudioWorkletNode', FakeNode);
  vi.spyOn(player, 'stop').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('microphone lifecycle', () => {
  it('reports permission refusal and closes the gesture-created context', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(startRecording(opts)).rejects.toMatchObject({ kind: 'denied' });
    expect(close).toHaveBeenCalled();
  });
  it('releases tracks when addModule fails', async () => {
    addModule.mockRejectedValue(new Error('worklet failed'));
    await expect(startRecording(opts)).rejects.toThrow('worklet failed');
    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalled();
  });
  it('releases tracks granted after initialization was cancelled', async () => {
    const abort = new AbortController();
    let grant!: (stream: unknown) => void;
    getUserMedia.mockImplementation(
      () =>
        new Promise((r) => {
          grant = r;
        }),
    );
    const pending = startRecording(opts, abort.signal);
    abort.abort();
    expect(close).toHaveBeenCalled();
    grant({ getTracks: () => [{ stop }] });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
  it('stops tracks before returning resampled PCM and cleans every node', async () => {
    const session = await startRecording(opts);
    nodes[1]!.port.onmessage?.({ data: new Float32Array(4800).fill(0.1) } as MessageEvent<Float32Array>);
    session.stop();
    const recording = await session.done;
    expect(recording.samples.length).toBe(1600);
    expect(recording.sampleRate).toBe(16000);
    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(nodes.every((n) => n.disconnect.mock.calls.length === 1)).toBe(true);
  });
  it('releases tracks on pagehide', async () => {
    const session = await startRecording(opts);
    window.dispatchEvent(new Event('pagehide'));
    await session.done;
    expect(stop).toHaveBeenCalledOnce();
  });
});
