// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenize } from '@shared/content/tokenize';
import { createMockApi } from '../api/mockApi';
import { SpeakPanel } from '../components/SpeakPanel';
import { renderWithApp } from '../test-utils';
import { zh } from '../i18n/zh';

const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock('../hooks/useRecorder', () => ({
  useRecorder: () => ({ state: 'idle', level: 0, error: null, record, stop: vi.fn() }),
}));
beforeEach(() => {
  record.mockResolvedValue({
    samples: new Float32Array(16000).fill(0.1),
    sampleRate: 16000,
    hadSpeech: true,
    durationMs: 1000,
    stoppedBy: 'manual',
  });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:own') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const panel = (onResult = vi.fn()) => (
  <SpeakPanel
    targets={['Hi.']}
    tokens={tokenize('Hi.')}
    itemId="test"
    reference={{ clip: 'hi', text: 'Hi.' }}
    onResult={onResult}
  />
);

describe('SpeakPanel fallback', () => {
  it.each(['SPEECH_FAILED', 'SPEECH_UNAVAILABLE', 'INTERNAL'])(
    'keeps playback and self-rating after %s',
    async (code) => {
      const api = createMockApi();
      api.speech.recognize = vi.fn().mockRejectedValue(Object.assign(new Error('failed'), { code }));
      const annotate = vi.spyOn(api.speech, 'annotateRecording');
      const result = vi.fn();
      renderWithApp(panel(result), { api });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(zh.speak.record) }));
      const rate = await screen.findByRole('button', { name: zh.speak.selfGood });
      expect(screen.getByRole('button', { name: new RegExp(zh.common.playOwn) })).toBeEnabled();
      expect(screen.getByRole('button', { name: `▶▶ ${zh.common.compare}` })).toBeEnabled();
      fireEvent.click(rate);
      expect(result).toHaveBeenCalledWith(
        expect.objectContaining({ passed: true, score: null, heardText: '', selfRated: true }),
      );
      expect(annotate).not.toHaveBeenCalled();
    },
  );
  it('offers self-rating when no model exists and never calls recognize', async () => {
    const api = createMockApi();
    const recognize = vi.spyOn(api.speech, 'recognize');
    renderWithApp(panel(), { api, speech: { state: 'unavailable' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(zh.speak.record) }));
    await screen.findByRole('button', { name: zh.speak.selfGood });
    expect(recognize).not.toHaveBeenCalled();
  });
  it('ignores a result delivered after leaving the screen', async () => {
    const api = createMockApi();
    let resolve!: (r: { text: string; recordingId: null; durationMs: number }) => void;
    api.speech.recognize = vi.fn(
      () =>
        new Promise<{ text: string; recordingId: null; durationMs: number }>((r) => {
          resolve = r;
        }),
    );
    const result = vi.fn();
    const { unmount } = renderWithApp(panel(result), { api });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(zh.speak.record) }));
    await waitFor(() => expect(api.speech.recognize).toHaveBeenCalled());
    unmount();
    resolve({ text: 'Hi.', recordingId: null, durationMs: 1000 });
    await Promise.resolve();
    expect(result).not.toHaveBeenCalled();
  });
});
