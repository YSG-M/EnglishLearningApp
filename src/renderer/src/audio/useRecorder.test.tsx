// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRecorder } from '../hooks/useRecorder';
import type { Recording, RecordingSession } from './recorder';
import type * as RecorderModule from './recorder';

const { start } = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock('./recorder', async (importOriginal) => ({
  ...(await importOriginal<typeof RecorderModule>()),
  startRecording: start,
}));
vi.mock('./player', () => ({ player: { stop: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useRecorder cancellation', () => {
  it('returns null for an initialization which completes after unmount', async () => {
    let initialized!: (session: RecordingSession) => void;
    start.mockImplementation(
      () =>
        new Promise((r) => {
          initialized = r;
        }),
    );
    const stop = vi.fn();
    const { result, unmount } = renderHook(useRecorder);
    let pending!: Promise<Recording | null>;
    act(() => {
      pending = result.current.record({ silenceMs: 1000 });
    });
    const signal = start.mock.calls[0]![1] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    initialized({ stop, done: new Promise(() => {}) });
    await expect(pending).resolves.toBeNull();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('does not return a recording for asynchronous challenge saving after unmount', async () => {
    let finish!: (recording: Recording) => void;
    start.mockResolvedValue({
      stop: vi.fn(),
      done: new Promise<Recording>((r) => {
        finish = r;
      }),
    });
    const { result, unmount } = renderHook(useRecorder);
    let pending!: Promise<Recording | null>;
    await act(async () => {
      pending = result.current.record({ silenceMs: 1000 });
      await Promise.resolve();
    });
    unmount();
    finish({
      samples: new Float32Array(16000),
      sampleRate: 16000,
      durationMs: 1000,
      hadSpeech: true,
      stoppedBy: 'manual',
    });
    await expect(pending).resolves.toBeNull();
  });
});
