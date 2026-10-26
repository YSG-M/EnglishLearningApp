// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureBundle } from '../../api/mockApi';
import { renderWithApp } from '../../test-utils';
import { LearnPart, learnSteps } from './LearnPart';

afterEach(cleanup);

describe('learnSteps', () => {
  it('puts the daily words after the sentences and before the word list', () => {
    const steps = learnSteps(fixtureBundle().units.u01!).map((s) => s.type);
    expect(steps).toEqual(['intro', 'chunk', 'chunk', 'chunk', 'chunk', 'daily', 'words']);
  });
});

describe('<LearnPart>', () => {
  it('teaches each daily word in its scene, with the word highlighted', () => {
    renderWithApp(<LearnPart unit={fixtureBundle().units.u01!} onFinish={vi.fn()} />);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
    expect(screen.getByText('🏠 日常用词：nice = 好的')).toBeInTheDocument();
    expect(screen.getByText('周末在楼下认识了新邻居。')).toBeInTheDocument();
    expect(screen.getByText('Nice').closest('.token')).toHaveClass('slot');
  });
});
