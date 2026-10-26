// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureBundle } from '../../api/mockApi';
import { renderWithApp } from '../../test-utils';
import { PracticePart } from './PracticePart';

afterEach(cleanup);

const unit = fixtureBundle().units.u01!;
const next = () => fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

describe('<PracticePart> (句型课)', () => {
  it('starts with the frame and its usage', () => {
    renderWithApp(<PracticePart unit={unit} onFinish={vi.fn()} />);
    expect(screen.getByText('Good ______.')).toBeInTheDocument();
    expect(screen.getByText('不同时间的问候')).toBeInTheDocument();
  });

  it('shows each example in its scene, with the slot highlighted and the phrase note', () => {
    renderWithApp(<PracticePart unit={unit} onFinish={vi.fn()} />);
    next();
    expect(screen.getByText('早上到补习中心，看到同事。')).toBeInTheDocument();
    expect(screen.getByText('morning.').closest('.token')).toHaveClass('slot');
    expect(screen.getByText('Good').closest('.token')).toHaveClass('frame');
    next();
    expect(screen.getByText(/Amy 换成对方的名字/)).toBeInTheDocument();
  });

  it('then asks for every scene from memory, falling back to self-rating without speech', () => {
    renderWithApp(<PracticePart unit={unit} onFinish={vi.fn()} />, { speech: { state: 'unavailable' } });
    next();
    next();
    next();
    expect(screen.getByText('第 1 / 2 个场景')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '显示答案' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /下一个场景/ }));
    expect(screen.getByText('第 2 / 2 个场景')).toBeInTheDocument();
  });

  it('toggles word meanings and remembers it in settings', () => {
    const { api } = renderWithApp(<PracticePart unit={unit} onFinish={vi.fn()} />);
    next();
    expect(screen.queryByText('早上')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /逐词意思/ }));
    expect(screen.getByText('早上')).toHaveClass('token-gloss');
    expect(api.calls.some((c) => c.channel === 'settings.update')).toBe(true);
  });
});
