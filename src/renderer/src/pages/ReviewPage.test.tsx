// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReviewCardView } from '@shared/ipc';
import { createMockApi } from '../api/mockApi';
import { renderWithApp } from '../test-utils';
import { ReviewPage } from './ReviewPage';

afterEach(cleanup);

const card: ReviewCardView = {
  cardId: 'example:u01.e01',
  kind: 'example',
  itemId: 'u01.e01',
  reps: 0,
  lapses: 0,
  exercise: 'listen-choose',
};

describe('<ReviewPage>', () => {
  it('shows today, recent and everything learned', async () => {
    renderWithApp(<ReviewPage />, {
      api: createMockApi({ queue: [], practice: [card], completed: ['u01:learn'] }),
    });
    expect(await screen.findByText(/今天的复习/)).toBeInTheDocument();
    expect(screen.getByText(/最近学的/)).toBeInTheDocument();
    expect(screen.getByText(/全部学过的/)).toBeInTheDocument();
    expect(screen.getByText('打招呼')).toBeInTheDocument();
  });

  it('practice from a unit never submits to the schedule', async () => {
    const api = createMockApi({ queue: [], practice: [card], completed: ['u01:learn'] });
    renderWithApp(<ReviewPage />, { api });
    fireEvent.click(await screen.findByRole('button', { name: /练一练/ }));
    await screen.findByRole('button', { name: '早上好。' });
    expect(
      api.calls.find(
        (c) => c.channel === 'review.getPracticeSet' && (c.args[0] as { scope: string }).scope === 'unit',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '早上好。' }));
    fireEvent.click(screen.getByRole('button', { name: /下一张/ }));
    await waitFor(() => expect(screen.getByText(/练习完成/)).toBeInTheDocument());
    expect(api.calls.some((c) => c.channel === 'review.submit')).toBe(false);
  });
});
