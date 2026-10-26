import { describe, expect, it } from 'vitest';
import { matchFrame, matchFrames } from './pattern';
import { tokenize } from './tokenize';

const m = (frame: string, sentence: string) => matchFrame(frame, tokenize(sentence));

describe('matchFrame', () => {
  it('finds the slot between the fixed words, ignoring case and punctuation', () => {
    expect(m('Can you ___?', 'Can you say that again?')).toEqual([2, 5]);
    expect(m('Can I have ___, please?', 'can I have a kopi, please?')).toEqual([3, 5]);
  });

  it('allows words before the frame but not after it', () => {
    expect(m('Can you ___?', 'Sorry, can you say that again?')).toEqual([3, 6]);
    expect(m('Can I have ___, please?', 'Can I have a kopi?')).toBeNull();
  });

  it('handles a slot at the start or in the middle', () => {
    expect(m('___ is waiting at the front desk.', 'Your mummy is waiting at the front desk.')).toEqual([0, 2]);
    expect(m('Is ___ okay for you?', 'Is Friday okay for you?')).toEqual([1, 2]);
  });

  it('needs at least one word in the slot', () => {
    expect(m('Can you ___?', 'Can you?')).toBeNull();
  });

  it('matches contractions and numbers', () => {
    expect(m("I'm ___.", "I'm from China.")).toEqual([1, 3]);
    expect(m('How much is ___?', 'How much is the $5 one?')).toEqual([3, 6]);
  });
});

describe('matchFrames', () => {
  it('returns the first frame that fits', () => {
    const frames = [{ frame: 'What did you ___?' }, { frame: 'I ___ yesterday.' }];
    expect(matchFrames(frames, tokenize('I went to the park yesterday.'))).toEqual({ frame: 1, slot: [1, 5] });
    expect(matchFrames(frames, tokenize('See you!'))).toBeNull();
  });
});
