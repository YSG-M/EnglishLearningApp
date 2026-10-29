import { describe, expect, it } from 'vitest';
import { bestMatch, matchSpeech, PASS_SCORE } from './speechMatch';

describe('matchSpeech', () => {
  it('passes an exact match with full score', () => {
    const r = matchSpeech('Nice to meet you.', 'nice to meet you');
    expect(r.score).toBe(1);
    expect(r.passed).toBe(true);
    expect(r.words.every((w) => w.status === 'ok')).toBe(true);
    expect(r.extra).toEqual([]);
  });

  it('accepts the recogniser writing digits for spoken numbers', () => {
    const r = matchSpeech('The fee is two hundred and eighty dollars a month.', 'The fee is $280 a month.');
    expect(r.passed).toBe(true);
    expect(r.score).toBe(1);
  });

  it('reports a missed word and fails when too much is missing', () => {
    const r = matchSpeech('Can I have a cup of tea?', 'can I tea');
    expect(r.passed).toBe(false);
    const missed = r.words.filter((w) => w.status === 'missed').map((w) => w.word);
    expect(missed).toEqual(expect.arrayContaining(['have', 'cup', 'of']));
  });

  it('still passes when one short word is dropped from a long sentence', () => {
    const r = matchSpeech('I work at a learning centre.', 'I work at learning centre');
    expect(r.score).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(r.words.find((w) => w.word === 'a')?.status).toBe('missed');
  });

  it('gives half credit to a near miss', () => {
    const r = matchSpeech('See you tomorrow', 'see you tomorow');
    expect(r.words.find((w) => w.word === 'tomorrow')?.status).toBe('close');
    expect(r.score).toBeCloseTo(2.5 / 3);
  });

  it('gives local words the recogniser cannot spell partial credit', () => {
    // Real Whisper output for a perfectly spoken "My aircon is not working." (2026-10-24).
    const r = matchSpeech('My aircon is not working.', 'My eirken is not working.');
    expect(r.words.find((w) => w.word === 'aircon')?.status).toBe('close');
    expect(r.passed).toBe(true);
  });

  it('does not treat words with different consonants as close', () => {
    expect(matchSpeech('Thursday', 'Tuesday').words[0]?.status).toBe('missed');
    expect(matchSpeech('fever', 'never').words[0]?.status).toBe('close'); // one letter apart
    expect(matchSpeech('kitchen', 'chicken').words[0]?.status).toBe('missed');
  });

  it('does not treat unrelated short words as close', () => {
    const r = matchSpeech('ship', 'sheep');
    expect(r.words[0]?.status).toBe('missed');
    expect(r.passed).toBe(false);
  });

  it('penalises a ramble so it cannot pass by containing the target', () => {
    const r = matchSpeech('Thank you', 'um thank you very much for everything today my friend');
    expect(r.passed).toBe(false);
  });

  it('handles silence', () => {
    const r = matchSpeech('Hello', '');
    expect(r.score).toBe(0);
    expect(r.words).toEqual([{ index: 0, word: 'hello', status: 'missed' }]);
  });

  it('keeps word order in the result', () => {
    const r = matchSpeech('How are you', 'how you');
    expect(r.words.map((w) => w.word)).toEqual(['how', 'are', 'you']);
  });
});

describe('bestMatch', () => {
  it('picks the reply she actually said', () => {
    const replies = ['Two years.', 'Three years.'];
    expect(bestMatch(replies, 'three years').index).toBe(1);
    expect(bestMatch(replies, '2 years').index).toBe(0);
  });

  it('returns the first target when nothing matches at all', () => {
    const r = bestMatch(['Hello', 'Goodbye'], '');
    expect(r.index).toBe(0);
    expect(r.result.score).toBe(0);
  });
});
