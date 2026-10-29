// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createMockApi } from '../../api/mockApi';
import { renderWithApp } from '../../test-utils';
import { ChallengePart } from './ChallengePart';

vi.mock('../../hooks/useRecorder', () => ({
  useRecorder: () => ({
    state: 'idle',
    level: 0,
    error: null,
    stop: vi.fn(),
    record: async () => ({ samples: new Float32Array([0.1, 0.2]), sampleRate: 16000, hadSpeech: true }),
  }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('requires recording, playback and a successful save before completion', async () => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:challenge') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  const api = createMockApi();
  const save = api.recordings.saveChallenge;
  api.recordings.saveChallenge = vi
    .fn()
    .mockRejectedValueOnce(new Error('Storage full'))
    .mockImplementation(save);
  const onFinish = vi.fn();
  renderWithApp(
    <ChallengePart
      challenge={{ id: 'c1', title: '开口挑战', intro: '介绍自己', maxSeconds: 30, prompts: [] }}
      onFinish={onFinish}
    />,
    { api },
  );
  expect(screen.getByRole('button', { name: /完成/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /录音/ }));
  const saveButton = await screen.findByRole('button', { name: '保存这次录音' });
  expect(api.recordings.saveChallenge).not.toHaveBeenCalled();
  expect(saveButton).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /这一次/ }));
  fireEvent.click(saveButton);
  await waitFor(() => expect(api.recordings.saveChallenge).toHaveBeenCalledOnce());
  expect(screen.getByRole('button', { name: /完成/ })).toBeDisabled();
  await waitFor(() => expect(saveButton).toBeEnabled());
  fireEvent.click(saveButton);
  await waitFor(() => expect(screen.getByRole('button', { name: /完成/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /完成/ }));
  expect(onFinish).toHaveBeenCalledOnce();
});
