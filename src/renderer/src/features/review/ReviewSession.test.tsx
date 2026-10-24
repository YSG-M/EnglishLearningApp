// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCardView } from '@shared/ipc';
import type { MockApi } from '../../api/mockApi';
import { renderWithApp } from '../../test-utils';
import { ReviewSession } from './ReviewSession';

afterEach(cleanup);

const card = (over: Partial<ReviewCardView>): ReviewCardView => ({
  cardId: 'chunk:u01.c02',
  kind: 'chunk',
  itemId: 'u01.c02',
  reps: 0,
  lapses: 0,
  exercise: 'listen-choose',
  ...over,
});

const submits = (api: MockApi) =>
  api.calls
    .filter((c) => c.channel === 'review.submit')
    .map((c) => c.args[0] as { cardId: string; grade: string });

describe('<ReviewSession>', () => {
  it('listen-choose: picking the right meaning submits "good"', async () => {
    const onDone = vi.fn();
    const { api } = renderWithApp(<ReviewSession cards={[card({})]} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: '很高兴认识你。' }));
    await waitFor(() =>
      expect(submits(api)).toEqual([expect.objectContaining({ cardId: 'chunk:u01.c02', grade: 'good' })]),
    );
    fireEvent.click(screen.getByRole('button', { name: /下一张/ }));
    expect(onDone).toHaveBeenCalledWith({ reviewed: 1, correct: 1 });
  });

  it('listen-choose: a wrong pick submits "again" and the card comes back once as practice', async () => {
    const onDone = vi.fn();
    const { api } = renderWithApp(<ReviewSession cards={[card({})]} onDone={onDone} />);
    const wrong = screen
      .getAllByRole('button')
      .find((b) => b.classList.contains('choice') && b.textContent !== '很高兴认识你。');
    fireEvent.click(wrong!);
    await waitFor(() => expect(submits(api)[0]?.grade).toBe('again'));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /下一张/ }));
    // Practice round: answering does not submit again.
    fireEvent.click(screen.getByRole('button', { name: '很高兴认识你。' }));
    fireEvent.click(screen.getByRole('button', { name: /下一张/ }));
    expect(submits(api)).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith({ reviewed: 1, correct: 0 });
  });

  it('recall-self-rate maps 😅 忘了 to "again"', async () => {
    const { api } = renderWithApp(
      <ReviewSession cards={[card({ exercise: 'recall-self-rate', reps: 3 })]} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    fireEvent.click(screen.getByRole('button', { name: /忘了/ }));
    await waitFor(() => expect(submits(api)[0]?.grade).toBe('again'));
  });

  it('speak-from-zh degrades to self-rating when speech is unavailable', () => {
    renderWithApp(<ReviewSession cards={[card({ exercise: 'speak-from-zh', reps: 3 })]} onDone={vi.fn()} />, {
      speech: { state: 'unavailable' },
    });
    expect(screen.getByRole('button', { name: '显示答案' })).toBeInTheDocument();
  });

  it('speak-from-zh: giving up submits "again" and shows the answer', async () => {
    const { api } = renderWithApp(
      <ReviewSession cards={[card({ exercise: 'speak-from-zh', reps: 3 })]} onDone={vi.fn()} />,
    );
    expect(screen.getByText('很高兴认识你。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '不会，看答案' }));
    await waitFor(() => expect(submits(api)[0]?.grade).toBe('again'));
    expect(screen.getByText('meet')).toBeInTheDocument();
  });

  it('pair-discriminate: choosing the played word submits "good"', async () => {
    const { api } = renderWithApp(
      <ReviewSession
        cards={[
          card({ cardId: 'pair:p01.m01', kind: 'pair', itemId: 'p01.m01', exercise: 'pair-discriminate' }),
        ]}
        onDone={vi.fn()}
      />,
    );
    // The played word is deterministic per seed; try one option and check the graded outcome matches it.
    fireEvent.click(screen.getByRole('button', { name: /^ship/ }));
    await waitFor(() => expect(submits(api)).toHaveLength(1));
    const correct = screen.getByRole('button', { name: /^ship/ }).classList.contains('correct');
    expect(submits(api)[0]?.grade).toBe(correct ? 'good' : 'again');
  });

  it('extra practice sets never submit', () => {
    const { api } = renderWithApp(<ReviewSession cards={[card({})]} submit={false} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '很高兴认识你。' }));
    expect(submits(api)).toHaveLength(0);
  });
});
