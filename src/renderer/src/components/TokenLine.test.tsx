// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { tokenize } from '@shared/content/tokenize';
import { HINT_FADE_AFTER } from '@shared/domain/hints';
import { fixtureBundle } from '../api/mockApi';
import { renderWithApp } from '../test-utils';
import { hintVisibility, TokenLine } from './TokenLine';

const lexicon = fixtureBundle().lexicon;

afterEach(cleanup);

describe('hintVisibility', () => {
  it('shows green/yellow hints until the word was said correctly enough times', () => {
    expect(hintVisibility(lexicon['hi'], 0, true)).toBe('shown');
    expect(hintVisibility(lexicon["i'm"], HINT_FADE_AFTER - 1, true)).toBe('shown');
    expect(hintVisibility(lexicon["i'm"], HINT_FADE_AFTER, true)).toBe('faded');
  });

  it('never gives red words a 谐音, even with hints on', () => {
    expect(hintVisibility(lexicon['thank'], 0, true)).toBe('red');
    expect(hintVisibility(lexicon['thank'], 0, false)).toBe('red');
  });

  it('respects the global switch and unknown tokens', () => {
    expect(hintVisibility(lexicon['hi'], 0, false)).toBe('off');
    expect(hintVisibility(undefined, 0, true)).toBe('none');
  });
});

describe('<TokenLine>', () => {
  const draw = (sentence: string, hintProgress: Record<string, number> = {}, showHints = true) =>
    renderWithApp(
      <TokenLine
        tokens={tokenize(sentence)}
        lexicon={lexicon}
        hintProgress={hintProgress}
        showHints={showHints}
      />,
    );

  it('renders the pinyin 谐音 under each word, without the 汉字', () => {
    draw("Hi, I'm Amy.");
    expect(screen.getByText('hāi')).toBeInTheDocument();
    expect(screen.getByText('ài(m)')).toBeInTheDocument();
    expect(screen.queryByText('嗨')).not.toBeInTheDocument();
    expect(screen.getByText('Hi,')).toBeInTheDocument();
  });

  it('hides a faded hint until the word is tapped', () => {
    draw("Hi, I'm Amy.", { hi: HINT_FADE_AFTER });
    expect(screen.queryByText('hāi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Hi,'));
    expect(screen.getByText('hāi')).toBeInTheDocument();
  });

  it('shows only a marker for red words and the mouth note on tap', () => {
    draw('Thank you.');
    expect(screen.getByTestId('hint-0')).toHaveAttribute('data-visibility', 'red');
    expect(screen.queryByText(/舌尖/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Thank'));
    expect(screen.getByRole('note')).toHaveTextContent('舌尖放在上下牙齿之间吹气');
  });

  it('shows no 谐音 when hints are switched off', () => {
    draw("Hi, I'm Amy.", {}, false);
    expect(screen.queryByText('hāi')).not.toBeInTheDocument();
  });

  it('shows the meaning of any tapped word', () => {
    draw("Hi, I'm Amy.");
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Hi,'));
    expect(screen.getByRole('note')).toHaveTextContent(lexicon['hi']!.zh);
  });

  it('shows every meaning when glosses are on, and marks the pattern slot', () => {
    renderWithApp(
      <TokenLine
        tokens={tokenize("Hi, I'm Amy.")}
        lexicon={lexicon}
        hintProgress={{}}
        showHints
        showGlosses
        slot={[2, 3]}
      />,
    );
    expect(screen.getByText(lexicon['hi']!.zh)).toHaveClass('token-gloss');
    expect(screen.getByText('Amy.').closest('.token')).toHaveClass('slot');
    expect(screen.getByText('Hi,').closest('.token')).toHaveClass('frame');
  });
});
