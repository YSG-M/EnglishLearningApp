// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configurePlayer, player } from './player';
import { registerRecording } from './session';

let audio: HTMLAudioElement;
let play: ReturnType<typeof vi.fn>;
beforeEach(() => {
  play = vi.fn(async () => {});
  vi.stubGlobal(
    'Audio',
    class {
      src = '';
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = play;
      pause = vi.fn();
      constructor() {
        audio = this as unknown as HTMLAudioElement;
      }
    },
  );
  configurePlayer({ resolveClip: (k) => `https://example.test/${k}.m4a`, allowSpeechSynthesis: false });
});
afterEach(() => {
  player.stop();
  registerRecording(null);
  vi.unstubAllGlobals();
});
describe('shared player', () => {
  it('uses injected clip URLs and releases the microphone before playback', async () => {
    const stop = vi.fn();
    registerRecording(stop);
    const done = player.play({ clip: 'one' });
    expect(stop).toHaveBeenCalledOnce();
    expect(audio.src).toBe('https://example.test/one.m4a');
    audio.onended?.(new Event('ended'));
    await done;
  });
  it('reports play rejection and stops the rest of a sequence', async () => {
    const onError = vi.fn();
    configurePlayer({ resolveClip: (k) => k, allowSpeechSynthesis: false, onError });
    // The singleton keeps its first element across tests.
    vi.spyOn(audio, 'play').mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    await player.playSequence([{ clip: 'one', text: 'hello' }, { clip: 'two' }], 0);
    expect(onError).toHaveBeenCalledWith({ kind: 'gesture', request: { clip: 'one', text: 'hello' } });
    expect(player.current).toBeNull();
  });
  it('reports missing audio without invoking speechSynthesis', async () => {
    const onError = vi.fn();
    const synth = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: synth });
    configurePlayer({
      resolveClip: () => {
        throw Error('missing');
      },
      allowSpeechSynthesis: false,
      onError,
    });
    await player.play({ clip: 'missing', text: 'hello' });
    expect(onError).toHaveBeenCalled();
    expect(synth).not.toHaveBeenCalled();
  });
});
