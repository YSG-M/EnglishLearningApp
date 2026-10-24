import { describe, expect, it } from 'vitest';
import { normalizeWords } from './normalize';

describe('normalizeWords', () => {
  it('lower-cases and strips punctuation', () => {
    expect(normalizeWords('Hi, how are you?')).toEqual(['hi', 'how', 'are', 'you']);
  });

  it('expands contractions so both forms match', () => {
    expect(normalizeWords("I'm fine")).toEqual(normalizeWords('I am fine'));
    expect(normalizeWords("I don't understand")).toEqual(['i', 'do', 'not', 'understand']);
    expect(normalizeWords('I’m Amy')).toEqual(['i', 'am', 'amy']);
  });

  it('reads money the way Whisper writes it', () => {
    expect(normalizeWords('The fee is $280 a month.')).toEqual([
      'the',
      'fee',
      'is',
      '2',
      '8',
      '0',
      'dollars',
      'a',
      'month',
    ]);
    expect(normalizeWords('The fee is two hundred and eighty dollars a month')).toEqual(
      normalizeWords('The fee is $280 a month.'),
    );
  });

  it('collapses number words and compares integers digit by digit', () => {
    expect(normalizeWords('twenty five')).toEqual(['2', '5']);
    expect(normalizeWords('one thousand two hundred')).toEqual(['1', '2', '0', '0']);
    expect(normalizeWords('three years')).toEqual(['3', 'years']);
    expect(normalizeWords('I have 3 children')).toEqual(['i', 'have', '3', 'children']);
  });

  it('agrees on a block number however it is written', () => {
    const target = normalizeWords('I live in Block 123.');
    expect(normalizeWords('I live in block one two three')).toEqual(target);
    expect(normalizeWords('I live in block one hundred and twenty three')).toEqual(target);
  });

  it('handles percent and ordinals', () => {
    expect(normalizeWords('10% discount')).toEqual(normalizeWords('ten percent discount'));
    expect(normalizeWords('on 15 December')).toEqual(
      normalizeWords('on the 15th December').filter((w) => w !== 'the'),
    );
    expect(normalizeWords('15th')).toEqual(['1', '5']);
  });

  it('keeps "oh" as a word when it is not part of a number', () => {
    expect(normalizeWords('Oh, nice!')).toEqual(['oh', 'nice']);
  });

  it('splits times like 4pm and handles a.m./p.m.', () => {
    expect(normalizeWords('Class is at 4pm')).toEqual(['class', 'is', 'at', '4', 'pm']);
    expect(normalizeWords('Class is at 4 p.m.')).toEqual(['class', 'is', 'at', '4', 'pm']);
    expect(normalizeWords('at 10:30am')).toEqual(['at', '10:30', 'am']);
  });

  it('treats okay and OK as the same word', () => {
    expect(normalizeWords('Okay!')).toEqual(normalizeWords('OK'));
  });

  it('splits hyphenated words', () => {
    expect(normalizeWords('make-up class')).toEqual(['make', 'up', 'class']);
  });

  it('keeps decimals in prices', () => {
    expect(normalizeWords('It is $12.50')).toEqual(['it', 'is', '12.50', 'dollars']);
  });
});
