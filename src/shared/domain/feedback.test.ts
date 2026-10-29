import { describe, expect, it } from 'vitest';
import type { WordEntry } from '../content/bundle';
import { tokenize } from '../content/tokenize';
import { buildFeedback } from './feedback';
import { matchSpeech } from './speechMatch';

const lexicon: Record<string, WordEntry> = {
  thank: {
    key: 'thank',
    text: 'thank',
    zh: '谢谢',
    hint: { grade: 'red', note: '舌尖放在上下牙之间' },
    audio: 'x',
  },
  you: { key: 'you', text: 'you', zh: '你', hint: { grade: 'green', hanzi: '优' }, audio: 'x' },
  "i'm": {
    key: "i'm",
    text: "I'm",
    zh: '我是',
    hint: { grade: 'yellow', hanzi: '爱', note: 'm 闭嘴' },
    audio: 'x',
  },
  fine: { key: 'fine', text: 'fine', zh: '好', hint: { grade: 'green', hanzi: '法因' }, audio: 'x' },
};

const fb = (target: string, heard: string) =>
  buildFeedback(matchSpeech(target, heard), tokenize(target), lexicon);

describe('buildFeedback', () => {
  it('praises a perfect answer with no tip', () => {
    const f = fb('Thank you', 'thank you');
    expect(f.tone).toBe('great');
    expect(f.tip).toBeUndefined();
  });

  it('points at the first problem word using its mouth note', () => {
    const f = fb('Thank you', 'sank you');
    expect(f.tone).toBe('retry');
    expect(f.tip).toContain('舌尖放在上下牙之间');
    expect(f.focusKeys).toEqual(['thank']);
  });

  it('maps an expanded contraction back to the word she saw', () => {
    const f = fb("I'm fine", 'fine');
    expect(f.focusKeys).toEqual(["i'm"]);
    expect(f.tip).toContain("I'm");
  });

  it('asks to try again when nothing was heard', () => {
    expect(fb('Thank you', '   ').tone).toBe('silent');
  });

  it('never returns more than one tip', () => {
    const f = fb("Thank you, I'm fine", 'you');
    expect(typeof f.tip).toBe('string');
    expect(f.focusKeys.length).toBeLessThanOrEqual(1);
  });
});
