import { describe, expect, it } from 'vitest';
import { planAudio, speakerId } from '../../scripts/lib/audio-plan';

const clips = {
  bf_emma_aaa: { text: 'Hi', voice: 'bf_emma' as const },
  bf_emma_bbb: { text: 'Bye', voice: 'bf_emma' as const },
  bm_george_ccc: { text: 'Hello', voice: 'bm_george' as const },
};

describe('planAudio', () => {
  it('lists clips without a wav file as missing, in stable order', () => {
    const plan = planAudio(clips, ['bf_emma_bbb.wav']);
    expect(plan.missing).toEqual(['bf_emma_aaa', 'bm_george_ccc']);
    expect(plan.existing).toBe(1);
  });

  it('reports wav files that no clip refers to as orphans', () => {
    const plan = planAudio(clips, ['bf_emma_aaa.wav', 'bf_emma_old.wav']);
    expect(plan.orphans).toEqual(['bf_emma_old.wav']);
  });

  it('ignores non-wav files such as leftovers from an interrupted run', () => {
    const plan = planAudio(clips, ['bf_emma_aaa.wav.tmp', 'notes.txt']);
    expect(plan.orphans).toEqual([]);
    expect(plan.missing).toHaveLength(3);
  });
});

describe('speakerId', () => {
  it('maps Kokoro voice names to speaker ids', () => {
    expect(speakerId('bf_emma')).toBe(7);
    expect(speakerId('bm_george')).toBe(9);
  });

  it('rejects unknown voices instead of silently using the default', () => {
    expect(() => speakerId('xx_nobody')).toThrow(/Unknown Kokoro voice/);
  });
});
